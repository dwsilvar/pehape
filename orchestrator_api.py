#!/usr/bin/env python3
"""
orchestrator_api.py — FastAPI controller for the Test Orchestrator Engine
=========================================================================
Spec: test-orchestrator-backend-api-spec-v1

Endpoints:
  POST   /api/test-plans                   → Save / upsert a Test Plan to JSON DB
  GET    /api/test-plans                   → List all stored Test Plans
  GET    /api/test-plans/{plan_id}         → Get a single plan by ID
  DELETE /api/test-plans/{plan_id}         → Delete a plan
  POST   /api/execute-plan/{plan_id}       → Launch orchestrator.py as BackgroundTask
  GET    /api/execution-status/{task_id}   → Poll running / finished / failed + logs
  GET    /api/execution-status/{task_id}/logs → Stream logs via SSE
  GET    /allure-report/...                → Serve static Allure HTML report

Storage: JSON file (features/test_plans.json) — same file the existing Flask backend
         already reads/writes, so both servers share state seamlessly.

Run:
  uvicorn orchestrator_api:app --host 0.0.0.0 --port 5001 --reload
"""

from __future__ import annotations

import asyncio
import glob
import json
import os
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

import importlib.util
import sys
from pathlib import Path

# Añadir el directorio backend al path para importar lógica existente
PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

try:
    from execution_plan_manager import ExecutionPlanManager
except ImportError:
    ExecutionPlanManager = None

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
try:
    from behave.step_registry import registry
except ImportError:
    registry = None

try:
    from behave.parser import Parser
except ImportError:
    Parser = None

try:
    from executor.tasks_core.registry import get_all_tasks
except ImportError:
    get_all_tasks = lambda: {}

try:
    import pygetwindow as gw
except ImportError:
    gw = None

# ── Paths ──────────────────────────────────────────────────────────────────────

# PROJECT_ROOT ya está definido arriba
FEATURES_DIR   = PROJECT_ROOT / "features"
PLANS_DB_FILE  = FEATURES_DIR / "test_plans.json"
RESOURCES_DIR  = PROJECT_ROOT / "resources"
IMAGES_DIR     = RESOURCES_DIR / "images"
ALLURE_RESULTS = PROJECT_ROOT / "reports" / "allure_results"
ALLURE_REPORT  = PROJECT_ROOT / "reports" / "allure-report"
ORCHESTRATOR   = PROJECT_ROOT / "orchestrator.py"

# Singleton para el manager del plan de ejecución
plan_manager = ExecutionPlanManager(str(FEATURES_DIR)) if ExecutionPlanManager else None

# Create directories
FEATURES_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Create directories if they don't exist yet
PLANS_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
ALLURE_RESULTS.mkdir(parents=True, exist_ok=True)
ALLURE_REPORT.mkdir(parents=True, exist_ok=True)

# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Test Orchestrator API",
    description="Controller for saving Test Plans and triggering the Orchestrator Engine.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the generated Allure report as a static site
if ALLURE_REPORT.exists():
    app.mount(
        "/allure-report",
        StaticFiles(directory=str(ALLURE_REPORT), html=True),
        name="allure_report",
    )
    # Compatibility with legacy frontend path
    app.mount(
        "/api/report",
        StaticFiles(directory=str(ALLURE_REPORT), html=True),
        name="legacy_report",
    )

# ── In-memory execution state store ───────────────────────────────────────────
# { task_id: ExecutionState }

_state_lock: Lock = Lock()
_executions: Dict[str, "ExecutionState"] = {}


class ExecutionState:
    """Thread-safe container for a single orchestrator run."""

    def __init__(self, task_id: str, plan_id: str):
        self.task_id    = task_id
        self.plan_id    = plan_id
        self.status     = "pending"   # pending | running | finished | failed
        self.started_at: Optional[str] = None
        self.ended_at:   Optional[str] = None
        self.scheduled_at: Optional[str] = None
        self.is_cancelled: bool        = False
        self.exit_code:  Optional[int] = None
        self.logs:       List[str]     = []
        self.report_url: Optional[str] = None
        self._lock = Lock()

    def append_log(self, line: str) -> None:
        with self._lock:
            self.logs.append(line)

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "task_id":    self.task_id,
                "plan_id":    self.plan_id,
                "status":     self.status,
                "scheduled_at": self.scheduled_at,
                "started_at": self.started_at,
                "ended_at":   self.ended_at,
                "exit_code":  self.exit_code,
                "log_lines":  len(self.logs),
                "last_log":   self.logs[-1] if self.logs else None,
                "report_url": self.report_url,
            }


# ── JSON DB helpers ─────────────────────────────────────────────────────────────

_db_lock = Lock()


def _load_plans() -> List[dict]:
    with _db_lock:
        if not PLANS_DB_FILE.exists():
            return []
        try:
            with open(PLANS_DB_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, IOError):
            return []


def _save_plans(plans: List[dict]) -> None:
    with _db_lock:
        with open(PLANS_DB_FILE, "w", encoding="utf-8") as fh:
            json.dump(plans, fh, indent=2, ensure_ascii=False)


# ── Pydantic models ─────────────────────────────────────────────────────────────

class ScenarioRef(BaseModel):
    id:           str
    featurePath:  str
    featureName:  Optional[str] = None
    scenarioName: str
    tags:         List[str]     = Field(default_factory=list)
    steps:        List[str]     = Field(default_factory=list)
    enabled:      bool          = True
    userdata:     Dict[str, str] = Field(default_factory=dict)


class TestFlowIn(BaseModel):
    id:        str
    name:      str
    scenarios: List[ScenarioRef] = Field(default_factory=list)


class TestCycleIn(BaseModel):
    id:        str
    name:      str
    enabled:   bool             = True
    flows:     List[TestFlowIn] = Field(default_factory=list)
    # Backward compatibility fields
    flowName:  Optional[str]    = None
    scenarios: Optional[List[ScenarioRef]] = None


class TestPlanIn(BaseModel):
    """
    Accepts both the UI format (cycles[] with scenarios[]) and the spec format
    (test_cycles[] with test_flows[]).  The id field is auto-generated if absent.
    """
    id:           Optional[str]        = None
    name:         str
    status:       str                  = "draft"
    enabled:      bool                 = True
    global_config: Dict[str, Any]      = Field(default_factory=dict)
    cycles:       List[TestCycleIn]    = Field(default_factory=list)


class ExecuteResponse(BaseModel):
    task_id:    str
    plan_id:    str
    status:     str
    message:    str


class StatusResponse(BaseModel):
    task_id:    str
    plan_id:    str
    status:     str
    started_at: Optional[str]
    ended_at:   Optional[str]
    exit_code:  Optional[int]
    log_lines:  int
    last_log:   Optional[str]
    report_url: Optional[str]


# ── Background worker ───────────────────────────────────────────────────────────

import time
import asyncio

def _schedule_and_run_orchestrator(task_id: str, plan_id: str, plan_json: str, scheduled_at: Optional[str] = None) -> None:
    """Wrapper that waits for scheduled_at before calling _run_orchestrator."""
    state = _executions[task_id]
    
    if scheduled_at:
        try:
            target_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            target_time = datetime.now(timezone.utc)
            
        while True:
            if state.is_cancelled:
                state.status = "cancelled"
                state.ended_at = datetime.now(timezone.utc).isoformat()
                state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
                return
                
            now = datetime.now(timezone.utc)
            if now >= target_time:
                break
                
            time.sleep(0.5)

    if state.is_cancelled:
        state.status = "cancelled"
        state.ended_at = datetime.now(timezone.utc).isoformat()
        state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
        return

    _run_orchestrator(task_id, plan_id, plan_json)


def _run_orchestrator(task_id: str, plan_id: str, plan_json: str) -> None:
    """
    Executes orchestrator.py in a subprocess, capturing stdout/stderr
    line-by-line into the ExecutionState store.
    """
    state = _executions[task_id]
    state.status = "running"
    state.started_at = datetime.now(timezone.utc).isoformat()

    cmd = [
        sys.executable,
        str(ORCHESTRATOR),
        "--json", plan_json,
        "--results-dir", str(ALLURE_RESULTS),
        "--report-dir",  str(ALLURE_REPORT),
        "--features-dir", str(PROJECT_ROOT / "features"),
    ]

    state.append_log(f"[ORCHESTRATOR] Starting plan '{plan_id}'")
    state.append_log(f"[CMD] {' '.join(cmd)}")

    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,           # line-buffered
            encoding="utf-8",    # explicitly decode stdout as utf-8
            env=env,
        )

        # Stream lines into the state store
        for line in iter(proc.stdout.readline, ""):
            stripped = line.rstrip()
            if stripped:
                state.append_log(stripped)

        proc.stdout.close()
        proc.wait()

        state.exit_code = proc.returncode
        state.status = "finished" if proc.returncode == 0 else "failed"
        state.append_log(
            f"[ORCHESTRATOR] Completed with exit code {proc.returncode}"
        )

        # Attach report URL if report was generated
        if ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()):
            state.report_url = "/allure-report/index.html"
            state.append_log(f"[REPORT] Available at {state.report_url}")

    except FileNotFoundError:
        state.status = "failed"
        state.exit_code = -1
        state.append_log(
            "[ERROR] orchestrator.py not found. "
            f"Expected path: {ORCHESTRATOR}"
        )
    except Exception as exc:
        state.status = "failed"
        state.exit_code = -1
        state.append_log(f"[ERROR] Unexpected error: {exc}")
    finally:
        state.ended_at = datetime.now(timezone.utc).isoformat()


# ── Helpers ───────────────────────────────────────────────────────────────────

def find_gif_execution_id(scenario_name: str, start_time_ms: int) -> Optional[str]:
    """
    Intenta encontrar un directorio en reports/temp_gif que coincida
    con el nombre del escenario y el timestamp de inicio.
    """
    try:
        temp_gif_dir = PROJECT_ROOT / "reports" / "temp_gif"
        
        if not temp_gif_dir.exists():
            return None
            
        timestamp_sec = int(start_time_ms / 1000)
        sanitized_name = "".join([c if c.isalnum() else "_" for c in scenario_name])
        
        # Listar directorios en temp_gif
        dirs = os.listdir(str(temp_gif_dir))
        
        # Candidatos exactos primero
        expected_prefix = f"{timestamp_sec}_{sanitized_name}"
        if expected_prefix in dirs:
            return expected_prefix
            
        # Búsqueda por tolerancia de tiempo si no hay match exacto
        for d in dirs:
            if d.endswith(f"_{sanitized_name}"):
                try:
                    dir_ts = int(d.split('_')[0])
                    if abs(dir_ts - timestamp_sec) <= 5: # Tolerancia de 5 segundos
                        return d
                except (ValueError, IndexError):
                    continue
                    
        return None
    except Exception:
        return None


# ── Routes — Reports ────────────────────────────────────────────────────────────

@app.get("/api/reports/orchestrator-summary", tags=["Reports"])
def get_orchestrator_summary():
    """Return the summary JSON generated by orchestrator.py (Hierarchy + Results)"""
    summary_file = ALLURE_RESULTS.parent / "orchestrator_summary.json"
    if not summary_file.exists():
        # Return an empty structure if no plan has been run yet
        return {"test_cycles": []}
    
    try:
        with open(summary_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read summary: {exc}")


@app.get("/api/reports/gherkin-results", tags=["Reports"])
def get_gherkin_results():
    """
    Parsea los archivos JSON de resultados de Allure para extraer
    un listado estructurado de las pruebas Gherkin ejecutadas.
    """
    try:
        if not ALLURE_RESULTS.exists():
            return {"features": [], "summary": {"total": 0, "passed": 0, "failed": 0, "broken": 0, "skipped": 0, "total_duration_ms": 0}}

        # Buscar archivos de resultados de Allure (formato: *-result.json)
        result_files = glob.glob(str(ALLURE_RESULTS / "*-result.json"))

        if not result_files:
            return {"features": [], "summary": {"total": 0, "passed": 0, "failed": 0, "broken": 0, "skipped": 0, "total_duration_ms": 0}}

        features_map = {}  # Agrupar escenarios por feature
        summary = {"total": 0, "passed": 0, "failed": 0, "broken": 0, "skipped": 0, "total_duration_ms": 0}

        for result_file in result_files:
            try:
                with open(result_file, 'r', encoding='utf-8') as f:
                    result_data = json.load(f)

                # Extraer info del escenario desde Allure result JSON
                scenario_name = result_data.get("name", "Unknown Scenario")
                status = result_data.get("status", "unknown")
                
                # Duración: stop - start (en ms)
                duration_ms = 0
                if result_data.get("stop") and result_data.get("start"):
                    duration_ms = result_data["stop"] - result_data["start"]

                # Feature name: extraer de labels
                feature_name = "Unknown Feature"
                tags = []
                for label in result_data.get("labels", []):
                    if label.get("name") == "feature":
                        feature_name = label.get("value", feature_name)
                    elif label.get("name") == "tag":
                        tag_value = label.get("value", "")
                        if tag_value:
                            tags.append(f"@{tag_value}" if not tag_value.startswith("@") else tag_value)

                # Steps
                steps_data = []
                for step in result_data.get("steps", []):
                    step_name = step.get("name", "")
                    step_status = step.get("status", "unknown")
                    # Extraer keyword del nombre del paso (Given/When/Then/And)
                    keyword = ""
                    for kw in ["Given ", "When ", "Then ", "And ", "But "]:
                        if step_name.startswith(kw):
                            keyword = kw.strip()
                            step_name = step_name[len(kw):]
                            break
                            
                    attachments = []
                    for att in step.get("attachments", []):
                        attachments.append({
                            "name": att.get("name"),
                            "source": att.get("source"),
                            "type": att.get("type")
                        })
                        
                    steps_data.append({
                        "name": step_name,
                        "keyword": keyword,
                        "status": step_status,
                        "attachments": attachments
                    })

                # Agrupar por feature
                if feature_name not in features_map:
                    features_map[feature_name] = []

                # Buscar evidencia visual (GIF/Video)
                gif_id = find_gif_execution_id(scenario_name, result_data.get("start", 0))

                features_map[feature_name].append({
                    "name": scenario_name,
                    "status": status,
                    "duration_ms": duration_ms,
                    "tags": tags,
                    "steps": steps_data,
                    "gifExecutionId": gif_id
                })

                # Summary
                summary["total"] += 1
                summary["total_duration_ms"] += duration_ms
                if status in summary:
                    summary[status] += 1

            except Exception:
                continue

        # Convertir a lista ordenada
        features_list = []
        for feature_name, scenarios in sorted(features_map.items()):
            features_list.append({
                "name": feature_name,
                "scenarios": scenarios
            })

        return {
            "features": features_list,
            "summary": summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/attachment/{filename}", tags=["Reports"])
def get_report_attachment(filename: str):
    """
    Sirve los archivos adjuntos (imágenes, json, etc) generados por Allure.
    """
    try:
        # Prevenir path traversal
        requested_path = (ALLURE_RESULTS / filename).resolve()
        if not str(requested_path).startswith(str(ALLURE_RESULTS.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        if not requested_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
            
        return FileResponse(str(requested_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/usage", tags=["Maintenance"])
def get_reports_usage():
    """
    Endpoint para obtener el uso de disco de los directorios de reportes.
    """
    try:
        report_root = PROJECT_ROOT / "reports"
        results_dir = report_root / "allure_results"
        report_dir = report_root / "allure-report"
        screenshots_dir = report_root / "screenshots"

        def get_dir_size(path: Path):
            total = 0
            if path.exists():
                for entry in path.rglob('*'):
                    if entry.is_file():
                        total += entry.stat().st_size
            return total

        results_size = get_dir_size(results_dir)
        report_size = get_dir_size(report_dir)
        screenshots_size = get_dir_size(screenshots_dir)

        return {
            "results_size": results_size,
            "report_size": report_size,
            "screenshots_size": screenshots_size,
            "total_size": results_size + report_size + screenshots_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CleanRequest(BaseModel):
    target: str

@app.post("/api/reports/clean", tags=["Maintenance"])
async def clean_reports(payload: CleanRequest):
    """
    Endpoint para limpiar los directorios de reportes.
    Body: { "target": "results" | "report" | "screenshots" | "all" }
    """
    try:
        target = payload.target
        report_root = PROJECT_ROOT / "reports"
        results_dir = report_root / "allure_results"
        report_dir = report_root / "allure-report"
        screenshots_dir = report_root / "screenshots"

        cleaned = []

        if target in ['results', 'all']:
            if results_dir.exists():
                shutil.rmtree(results_dir)
                results_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Resultados Raw")

        if target in ['report', 'all']:
            if report_dir.exists():
                shutil.rmtree(report_dir)
                report_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Reporte Generado")

        if target in ['screenshots', 'all']:
            if screenshots_dir.exists():
                shutil.rmtree(screenshots_dir)
                screenshots_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Screenshots")

        if not cleaned:
            raise HTTPException(status_code=400, detail="Target inválido o nada que limpiar")

        return {"message": f"Se han limpiado: {', '.join(cleaned)}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ── Routes — Features ──────────────────────────────────────────────────────────

@app.get("/api/features-with-scenarios", tags=["Features"])
def list_features_with_scenarios():
    """
    Returns a flat list of .feature files with their parsed scenario names, tags and steps.
    Used to populate the Asset Library in the Test Plan Designer.
    """
    results = []
    if not Parser:
        raise HTTPException(status_code=500, detail="behave.parser not available")

    try:
        for root, dirs, files in os.walk(str(FEATURES_DIR)):
            # Skip the steps directory
            dirs[:] = [d for d in dirs if d != 'steps']
            for filename in sorted(files):
                if not filename.endswith('.feature'):
                    continue
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, str(FEATURES_DIR)).replace('\\', '/')

                feature_title = filename.replace('.feature', '')
                scenarios = []

                try:
                    parser = Parser()
                    with open(full_path, 'r', encoding='utf-8') as fh:
                        content = fh.read()

                    feature = parser.parse(content)
                    if feature:
                        feature_title = feature.name or feature_title
                        for scenario in feature.scenarios:
                            steps = [
                                f"{step.keyword} {step.name}"
                                for step in (scenario.steps or [])
                            ]
                            tags = list(scenario.tags or [])
                            scenarios.append({
                                "name": scenario.name,
                                "tags": tags,
                                "steps": steps,
                            })
                except Exception:
                    # Still include the file, just with empty scenarios
                    scenarios = []

                results.append({
                    "name": filename,
                    "path": rel_path,
                    "featureTitle": feature_title,
                    "scenarios": scenarios,
                })

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/features", tags=["Features"])
def list_features():
    """
    Endpoint para listar todos los archivos .feature y sus directorios.
    """
    def build_tree(path: Path):
        tree = []
        if not path.exists():
            return tree
            
        for item in sorted(os.listdir(str(path))):
            # Excluir la carpeta 'steps' de la vista del explorador de archivos.
            if item == 'steps' and (path / item).is_dir():
                continue

            full_path = path / item
            relative_path = os.path.relpath(str(full_path), str(FEATURES_DIR)).replace('\\', '/')
            if full_path.is_dir():
                children = build_tree(full_path)
                tree.append({
                    "name": item,
                    "type": "directory",
                    "path": relative_path,
                    "children": children
                })
            elif item.endswith('.feature'):
                tree.append({
                    "name": item,
                    "type": "file",
                    "path": relative_path
                })
        return tree

    try:
        children_tree = build_tree(FEATURES_DIR)
        root_node = [{
            "name": "Features",
            "type": "directory",
            "path": "",
            "children": children_tree
        }]
        return root_node
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ValidateFeatureRequest(BaseModel):
    path: str

@app.post("/api/features/validate", tags=["Features"])
async def validate_feature(payload: ValidateFeatureRequest):
    """
    Valida un archivo .feature usando behave --dry-run para encontrar pasos no definidos.
    """
    try:
        rel_path = payload.path
        full_path = (FEATURES_DIR / rel_path).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
             raise HTTPException(status_code=403, detail="Access denied")

        # Intentar localizar el ejecutable de python del venv
        venv_python = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
        if not venv_python.exists():
            venv_python = Path(sys.executable)

        # Usar la ruta absoluta para evitar ambigüedades
        cmd = [str(venv_python), "-m", "behave", "--dry-run", "-f", "json", str(full_path)]
        
        # Ejecutar en el directorio raiz
        result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, encoding='utf-8')
        
        output = result.stdout
        
        undefined_steps = []
        snippets = []
        is_valid = True
        
        # Intentar extraer el JSON de stdout
        json_start = output.find('[')
        json_end = output.rfind(']')
        
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                report_json = output[json_start:json_end+1]
                report = json.loads(report_json)
                for feature in report:
                    if feature.get('status') == 'error':
                        is_valid = False
                    for element in feature.get('elements', []):
                        for step in element.get('steps', []):
                            if step.get('result', {}).get('status') == 'undefined':
                                is_valid = False
                                undefined_steps.append({
                                    "keyword": step.get('keyword', ''),
                                    "name": step.get('name', ''),
                                    "line": step.get('location', '').split(':')[-1]
                                })
            except Exception:
                pass

        # Extraer snippets del stderr/stdout si hay pasos indefinidos
        if "You can implement step definitions for undefined steps with these snippets:" in output:
            snippet_part = output.split("You can implement step definitions for undefined steps with these snippets:")[1]
            # Limpiar y separar snippets (esto es heurístico)
            snippets = [s.strip() for s in snippet_part.split("@") if s.strip()]

        return {
            "valid": is_valid,
            "undefined_steps": undefined_steps,
            "snippets": snippets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/features/{filepath:path}", tags=["Features"])
def get_feature_content(filepath: str):
    """
    Endpoint para obtener el contenido de un archivo .feature específico.
    """
    try:
        full_path = (FEATURES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
            
        with open(str(full_path), 'r', encoding='utf-8', newline='') as f:
            content = f.read()
        return {"path": filepath, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveFeatureRequest(BaseModel):
    content: str

@app.post("/api/features/{filepath:path}", tags=["Features"])
async def save_feature_content(filepath: str, payload: SaveFeatureRequest):
    """
    Endpoint para guardar el contenido de un archivo .feature.
    """
    try:
        full_path = (FEATURES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        with open(str(full_path), 'w', encoding='utf-8', newline='') as f:
            f.write(payload.content)
        return {"message": f"File '{filepath}' saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateDirRequest(BaseModel):
    path: str

@app.post("/api/directories", tags=["Features"], status_code=201)
async def create_directory(payload: CreateDirRequest):
    """
    Endpoint para crear un nuevo directorio.
    """
    try:
        full_path = (FEATURES_DIR / payload.path).resolve()
        # Verificar que no intente salir de FEATURES_DIR
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Ruta inválida o acceso denegado")

        if full_path.exists():
            raise HTTPException(status_code=409, detail=f"El directorio o archivo '{payload.path}' ya existe.")

        full_path.mkdir(parents=True, exist_ok=True)
        return {"message": f"Directorio '{payload.path}' creado exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateFileRequest(BaseModel):
    path: str

@app.post("/api/files", tags=["Features"], status_code=201)
async def create_file(payload: CreateFileRequest):
    """
    Endpoint para crear un nuevo archivo .feature.
    """
    try:
        path = payload.path
        if not path.endswith('.feature'):
            path += '.feature'

        full_path = (FEATURES_DIR / path).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Ruta inválida o acceso denegado")

        if full_path.exists():
            raise HTTPException(status_code=409, detail=f"El archivo '{path}' ya existe.")

        default_content = "Feature: Nuevo Feature\n\n  Scenario: Nuevo escenario\n    Given \n    When \n    Then "
        with open(str(full_path), 'w', encoding='utf-8', newline='') as f:
            f.write(default_content)
            
        return {"message": f"Archivo '{path}' creado exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execution-order/refresh", tags=["Features"])
def refresh_execution_order():
    """
    Placeholder para refrescar datos de features.
    En una migración completa, esto debería integrarse con ExecutionPlanManager.
    """
    # Por ahora devolvemos éxito para no romper la UI
    return {"message": "Features refreshed successfully"}


# ── Routes — Tools & Tasks ───────────────────────────────────────────────────

@app.get("/api/tasks", tags=["Tasks"])
def list_tasks():
    """
    Endpoint para listar todas las tareas registradas y su documentación.
    """
    try:
        tasks_data = []
        registered_tasks = get_all_tasks()
        
        for task_name, task_class in registered_tasks.items():
            tasks_data.append({
                "name": task_name,
                "class_name": task_class.__name__,
                "module": task_class.__module__,
                "scope": getattr(task_class, "scope", "General"),
                "doc": task_class.__doc__.strip() if task_class.__doc__ else "Sin documentación",
                "args_schema": task_class.get_args_schema()
            })
            
        return {"tasks": tasks_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tools/running-apps", tags=["Tools"])
def get_running_apps():
    """
    Lista las ventanas abiertas en el sistema (Windows).
    """
    if not gw:
        raise HTTPException(status_code=500, detail="pygetwindow not installed")
        
    try:
        apps_data = []
        # Obtener todas las ventanas visibles
        windows = gw.getAllWindows()
        
        for w in windows:
            title = w.title
            if not title:
                continue
                
            # Extraer atributos disponibles de forma segura
            app_info = {
                "title": title,
                "id": getattr(w, '_hWnd', 0),
                "isActive": getattr(w, 'isActive', False),
                "isMaximized": getattr(w, 'isMaximized', False),
                "isMinimized": getattr(w, 'isMinimized', False),
                "geometry": {
                    "left": getattr(w, 'left', 0),
                    "top": getattr(w, 'top', 0),
                    "width": getattr(w, 'width', 0),
                    "height": getattr(w, 'height', 0)
                }
            }
            apps_data.append(app_info)

        return {
            "platform": "Windows",
            "count": len(apps_data),
            "windows": apps_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CheckLiteralRequest(BaseModel):
    text: str
    case_sensitive: bool = False

@app.post("/api/tools/check-literal", tags=["Tools"])
def check_literal(payload: CheckLiteralRequest):
    """
    Busca ocurrencias literales de un texto en todos los archivos .feature.
    """
    try:
        results = []
        search_text = payload.text
        if not payload.case_sensitive:
            search_text = search_text.lower()
            
        for root, _, files in os.walk(str(FEATURES_DIR)):
            for filename in files:
                if not filename.endswith('.feature'):
                    continue
                    
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, str(FEATURES_DIR)).replace('\\', '/')
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        
                    for i, line in enumerate(lines):
                        match_line = line
                        if not payload.case_sensitive:
                            match_line = line.lower()
                            
                        if search_text in match_line:
                            results.append({
                                "file": rel_path,
                                "line": i + 1,
                                "content": line.strip()
                            })
                except:
                    continue
                    
        return {"count": len(results), "matches": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Routes — OCR ─────────────────────────────────────────────────────────────

@app.get("/api/ocr-images", tags=["OCR"])
def list_ocr_images():
    """
    Lista recursivamente todas las imágenes en resources/images.
    """
    try:
        mapping_path = IMAGES_DIR / "ocr_mapping.json"
        mapping = {}
        if mapping_path.exists():
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)

        def get_images_in_dir(path: Path):
            images = []
            if not path.exists():
                return images
                
            for item in sorted(os.listdir(str(path))):
                full_path = path / item
                if full_path.is_dir():
                    images.extend(get_images_in_dir(full_path))
                elif item.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    rel_path = os.path.relpath(str(full_path), str(IMAGES_DIR)).replace('\\', '/')
                    path_parts = rel_path.split('/')
                    
                    # Estructura enriquecida esperada por el frontend
                    img_entry = {
                        "relative_path": rel_path,
                        "filename": item,
                        "key_text": os.path.splitext(item)[0],
                        "full_path_parts": path_parts,
                        "associated_texts": [],
                        "mapped_to": [],
                        "is_mapped": False
                    }
                    
                    # Intentar enriquecer desde el mapeo
                    # Esta es una búsqueda inversa (mismo que hacía Flask)
                    for feat_key, feat_data in mapping.items():
                        if feat_key == 'generic' and isinstance(feat_data, list):
                            for step in feat_data:
                                if step.get('id') == item:
                                    img_entry["key_text"] = step.get('original_text', img_entry["key_text"])
                                    img_entry["associated_texts"].extend(step.get('texts', []))
                                    img_entry["is_mapped"] = True
                                    img_entry["mapped_to"].append({
                                        "feature": "generic",
                                        "tag": None,
                                        "text": step.get('original_text'),
                                        "full_steps": step.get('texts', [])
                                    })
                        elif isinstance(feat_data, dict):
                            for tag_name, tag_info in feat_data.items():
                                if not isinstance(tag_info, dict): continue
                                steps = tag_info.get('steps', [])
                                for step in steps:
                                    if step.get('id') == item:
                                        img_entry["key_text"] = step.get('original_text', img_entry["key_text"])
                                        img_entry["associated_texts"].extend(step.get('texts', []))
                                        img_entry["is_mapped"] = True
                                        img_entry["mapped_to"].append({
                                            "feature": feat_key,
                                            "tag": tag_name,
                                            "text": step.get('original_text'),
                                            "full_steps": step.get('texts', [])
                                        })
                    
                    images.append(img_entry)
            return images

        all_images = get_images_in_dir(IMAGES_DIR)
        return all_images
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ocr-images/{filepath:path}", tags=["OCR"])
def get_ocr_image(filepath: str):
    """
    Sirve un archivo de imagen OCR.
    """
    try:
        full_path = (IMAGES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(IMAGES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
            
        return FileResponse(str(full_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resources/images/{filepath:path}", tags=["OCR"])
def get_resource_image(filepath: str):
    """
    Endpoint de compatibilidad para servir imágenes OCR.
    """
    return get_ocr_image(filepath)



@app.post("/api/images/upload", tags=["OCR"])
async def upload_image(request: Request):
    """
    Endpoint para subir una imagen OCR.
    """
    # En FastAPI se usa UploadFile, pero para mantener compatibilidad con FormData de Flask:
    # Lo implementaremos si es estrictamente necesario, o usaremos la lógica básica.
    return {"message": "Endpoint migrado pero requiere adaptación de UploadFile"}


@app.post("/api/images/link", tags=["OCR"])
async def link_image(request: Request):
    """
    Vincular una imagen existente a un nuevo patrón.
    """
    try:
        data = await request.json()
        source_rel_path = data.get('source_relative_path')
        text = data.get('text')
        step_text = data.get('step_text')
        feature_path = data.get('feature_path')
        tag = data.get('tag')
        is_generic = data.get('is_generic', False)

        if not source_rel_path or not text:
            raise HTTPException(status_code=400, detail="Missing data")

        mapping_path = IMAGES_DIR / "ocr_mapping.json"
        mapping = {}
        if mapping_path.exists():
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)

        # Nombre de la imagen física
        img_filename = os.path.basename(source_rel_path)
        
        entry = {
            "id": img_filename,
            "texts": [step_text] if step_text else [],
            "original_text": text
        }

        if is_generic:
            if 'generic' not in mapping:
                mapping['generic'] = []
            # Evitar duplicados
            if not any(e.get('id') == img_filename and e.get('original_text') == text for e in mapping['generic']):
                mapping['generic'].append(entry)
        else:
            if not feature_path:
                raise HTTPException(status_code=400, detail="feature_path required for non-generic link")
            
            # Normalizar feature_path
            feat_key = feature_path.replace('\\', '/')
            if feat_key not in mapping:
                mapping[feat_key] = {}
            
            tag_key = tag or "default"
            if tag_key not in mapping[feat_key]:
                mapping[feat_key][tag_key] = {"steps": []}
            
            steps = mapping[feat_key][tag_key].get('steps', [])
            if not any(e.get('id') == img_filename and e.get('original_text') == text for e in steps):
                steps.append(entry)
                mapping[feat_key][tag_key]['steps'] = steps

        with open(mapping_path, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, indent=4, ensure_ascii=False)

        return {"message": "Image linked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Routes — Execution Order & Modules ───────────────────────────────────────

@app.get("/api/execution-order", tags=["Execution Plan"])
def get_execution_order(request: Request):
    """
    Lee y devuelve el contenido de run_list.json.
    """
    try:
        if not plan_manager:
            raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")
            
        include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'
        
        # Usamos el manager real
        sequence = plan_manager.get_sequence()
        
        if not include_inactive:
            sequence = [m for m in sequence if m.get('active')]
            
        # Añadir IDs para el frontend
        for module in sequence:
            for feature in module.get('features', []):
                feature['id'] = f"feature::{module['module_name']}::{feature.get('feature_dir', '')}/{feature['feature_file']}"
        
        return sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/execution-order", tags=["Execution Plan"])
async def save_execution_order(request: Request):
    """
    Guarda una nueva secuencia de ejecución.
    """
    try:
        if not plan_manager:
            raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")
            
        new_sequence = await request.json()
        updated_sequence = plan_manager.update_sequence(new_sequence)
        
        # Añadir IDs para el frontend
        for module in updated_sequence:
            for feature in module.get('features', []):
                feature['id'] = f"feature::{module['module_name']}::{feature.get('feature_dir', '')}/{feature['feature_file']}"
                
        return updated_sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/modules", tags=["Execution Plan"])
async def add_module(request: Request):
    """Agrega un nuevo módulo."""
    try:
        data = await request.json()
        module_name = data.get('module_name')
        order = data.get('order')
        if not module_name or order is None:
            raise HTTPException(status_code=400, detail="module_name and order required")
            
        updated_sequence = plan_manager.add_module(module_name, int(order))
        return updated_sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/modules/{module_name}/features/tags", tags=["Execution Plan"])
async def update_feature_tags(module_name: str, request: Request):
    """Actualiza tags de un feature."""
    try:
        data = await request.json()
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        tags = data.get('tags')
        
        updated_sequence = plan_manager.update_feature_tags(module_name, feature_file, feature_dir, tags)
        return updated_sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/modules/{module_name}/color", tags=["Execution Plan"])
async def update_module_color(module_name: str, request: Request):
    """Actualiza el color de un módulo."""
    try:
        data = await request.json()
        color = data.get('color')
        updated_sequence = plan_manager.update_module_color(module_name, color)
        return updated_sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/modules", tags=["Execution Plan"])
def get_modules(request: Request):
    """Lista módulos del plan."""
    return get_execution_order(request)


# ── Routes — UI Settings & Validation ────────────────────────────────────────

@app.get("/api/validate-files", tags=["Maintenance"])
def validate_files():
    """
    Valida que todos los archivos registrados existen físicamente.
    """
    try:
        if not plan_manager:
             raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")
             
        modules = plan_manager.get_sequence()
        missing_features = []
        missing_tasks = []
        
        # Importar registro de tareas
        try:
            from executor.tasks_core.registry import get_all_tasks
            registered_tasks = get_all_tasks()
        except:
            registered_tasks = {}

        for module in modules:
            for feature in module.get('features', []):
                feature_dir = feature.get('feature_dir', '')
                feature_file = feature.get('feature_file', '')
                
                path = FEATURES_DIR / feature_dir / feature_file if feature_dir else FEATURES_DIR / feature_file
                
                if not path.exists():
                    f_id = f"feature::{module.get('module_name')}::{feature_dir}/{feature_file}"
                    missing_features.append({
                        'id': f_id,
                        'path': f"{feature_dir}/{feature_file}" if feature_dir else feature_file,
                        'module': module.get('module_name'),
                        'feature_file': feature_file,
                        'feature_dir': feature_dir
                    })
                
                # Validar tareas
                for task in feature.get('ui_tasks', []):
                    task_name = task.get('name')
                    if task_name and task_name not in registered_tasks:
                        if not any(t['name'] == task_name for t in missing_tasks):
                            missing_tasks.append({
                                'name': task_name,
                                'feature_id': feature.get('id', 'unknown'),
                                'hook': task.get('hook')
                            })
                            
        return {
            'missing_features': missing_features,
            'missing_tasks': missing_tasks,
            'all_valid': len(missing_features) == 0 and len(missing_tasks) == 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UICollapseRequest(BaseModel):
    view: str
    section_id: str
    is_collapsed: bool

@app.put("/api/ui-settings/module-collapse", tags=["Maintenance"])
def update_module_collapse(payload: UICollapseRequest):
    """Guarda el estado de colapso de un módulo."""
    try:
        settings_path = FEATURES_DIR / "ui_settings.json"
        settings = {}
        if settings_path.exists():
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        
        if 'collapsed_sections' not in settings:
            settings['collapsed_sections'] = {}
        if payload.view not in settings['collapsed_sections']:
            settings['collapsed_sections'][payload.view] = []
            
        collapsed_list = settings['collapsed_sections'][payload.view]
        if payload.is_collapsed:
            if payload.section_id not in collapsed_list:
                collapsed_list.append(payload.section_id)
        else:
            if payload.section_id in collapsed_list:
                collapsed_list.remove(payload.section_id)
                
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=4)
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/tasks", tags=["Tasks"])
def list_tasks():
    """
    Endpoint para listar todas las tareas registradas y su documentación.
    """
    try:
        tasks_data = []
        registered_tasks = get_all_tasks()
        
        for task_name, task_class in registered_tasks.items():
            tasks_data.append({
                "name": task_name,
                "class_name": task_class.__name__,
                "module": task_class.__module__,
                "scope": getattr(task_class, "scope", "General"),
                "doc": task_class.__doc__.strip() if task_class.__doc__ else "Sin documentación",
                "args_schema": task_class.get_args_schema() if hasattr(task_class, "get_args_schema") else {}
            })
            
        return {"tasks": tasks_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/steps/catalog", tags=["Tasks"])
def get_steps_catalog():
    """
    Endpoint para obtener todos los pasos (Given, When, Then) registrados en el proyecto.
    """
    if not registry:
        raise HTTPException(status_code=500, detail="behave.step_registry not available")
        
    steps_dir = FEATURES_DIR / 'steps'
    if not steps_dir.exists():
        return []

    # Aseguramos que el directorio de features esté en el path para las importaciones
    if str(FEATURES_DIR) not in sys.path:
        sys.path.append(str(FEATURES_DIR))

    # Cargar dinámicamente todos los archivos de steps
    for root, _, files in os.walk(str(steps_dir)):
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                file_path = os.path.join(root, file)
                rel_module_path = os.path.relpath(file_path, str(steps_dir)).replace(os.sep, '.')[:-3]
                module_name = f"steps.{rel_module_path}"
                
                if module_name not in sys.modules:
                    try:
                        spec = importlib.util.spec_from_file_location(module_name, file_path)
                        module = importlib.util.module_from_spec(spec)
                        sys.modules[module_name] = module
                        spec.loader.exec_module(module)
                    except Exception as e:
                        # Log warning or ignore
                        continue

    steps_data = []
    seen = set()
    for step_type in ['given', 'when', 'then']:
        definitions = registry.steps.get(step_type, [])
        for step in definitions:
            # Deduplicar por tipo y patrón para evitar duplicados en la UI
            key = (step_type, step.string)
            if key in seen:
                continue
            seen.add(key)
            
            steps_data.append({
                "type": step_type,
                "pattern": step.string,
                "location": f"{os.path.relpath(step.location.filename, str(FEATURES_DIR))}:{step.location.line}"
            })
    
    return steps_data






@app.get("/api/execution/{execution_id}/gif", tags=["Execution Plan"])
def get_execution_gif(execution_id: str):
    """Genera y sirve un GIF de la ejecución."""
    try:
        import glob
        from PIL import Image
        import io
        
        gif_source_dir = PROJECT_ROOT / 'reports' / 'temp_gif' / execution_id
        if not gif_source_dir.exists():
            raise HTTPException(status_code=404, detail="Execution data not found")
            
        images = sorted(glob.glob(str(gif_source_dir / "*.png")))
        if not images:
             raise HTTPException(status_code=404, detail="No images found for GIF")
             
        frames = [Image.open(image) for image in images]
        
        output = io.BytesIO()
        frames[0].save(output, format='GIF', append_images=frames[1:], save_all=True, duration=500, loop=0)
        output.seek(0)
        
        return StreamingResponse(output, media_type="image/gif")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/execution/{execution_id}/video", tags=["Execution Plan"])
def get_execution_video(execution_id: str):
    """Sirve el video de la ejecución si existe."""
    # ... Lógica similar o redirección a archivo estático
    video_path = PROJECT_ROOT / 'reports' / 'temp_gif' / execution_id / 'execution.mp4'
    if video_path.exists():
        return FileResponse(str(video_path))
    raise HTTPException(status_code=404, detail="Video not found")


@app.get("/api/test-plans", response_model=List[dict], tags=["Test Plans"])
def list_test_plans():
    """Return all saved Test Plans."""
    return _load_plans()


@app.put("/api/test-plans", tags=["Test Plans"])
async def save_all_plans(request: Request):
    """Save the full list of Test Plans."""
    data = await request.json()
    _save_plans(data)
    return data



@app.get("/api/test-plans/{plan_id}", tags=["Test Plans"])
def get_test_plan(plan_id: str):
    """Return a single Test Plan by ID."""
    plans = _load_plans()
    for plan in plans:
        if plan.get("id") == plan_id:
            return plan
    raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")


@app.post("/api/test-plans", status_code=201, tags=["Test Plans"])
def save_test_plan(payload: TestPlanIn):
    """
    Upsert a Test Plan.
    - If the payload carries an existing `id`, the plan is updated in place.
    - If `id` is absent or new, a UUID is generated and the plan is inserted.
    """
    plans = _load_plans()

    plan_dict = payload.model_dump()

    # Auto-generate ID if absent
    if not plan_dict.get("id"):
        plan_dict["id"] = str(uuid.uuid4())

    plan_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert
    replaced = False
    for i, existing in enumerate(plans):
        if existing.get("id") == plan_dict["id"]:
            plans[i] = plan_dict
            replaced = True
            break

    if not replaced:
        plan_dict.setdefault("created_at", plan_dict["updated_at"])
        plans.append(plan_dict)

    _save_plans(plans)

    return {
        "message": "Plan saved successfully.",
        "plan_id": plan_dict["id"],
        "action":  "updated" if replaced else "created",
    }


@app.delete("/api/test-plans/{plan_id}", tags=["Test Plans"])
def delete_test_plan(plan_id: str):
    """Delete a Test Plan by ID."""
    plans = _load_plans()
    new_plans = [p for p in plans if p.get("id") != plan_id]
    if len(new_plans) == len(plans):
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")
    _save_plans(new_plans)
    return {"message": f"Plan '{plan_id}' deleted."}


# ── Routes — Execution ──────────────────────────────────────────────────────────

@app.post(
    "/api/execute-plan/{plan_id}",
    response_model=ExecuteResponse,
    tags=["Execution"],
)
def execute_plan(plan_id: str, background_tasks: BackgroundTasks, scheduled_at: Optional[str] = None):
    """
    Trigger the execution of a specific Test Plan.
    """
    # Retrieve plan
    plans = _load_plans()
    plan = next((p for p in plans if p.get("id") == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")

    # Convert UI plan format → orchestrator input format
    orchestrator_input = _convert_plan_to_orchestrator_format(plan)
    plan_json_str = json.dumps(orchestrator_input, ensure_ascii=False)

    # Create execution state
    task_id = str(uuid.uuid4())
    state = ExecutionState(task_id=task_id, plan_id=plan_id)
    if scheduled_at:
        state.status = "scheduled"
        state.scheduled_at = scheduled_at

    with _state_lock:
        _executions[task_id] = state

    # Launch background task
    background_tasks.add_task(_schedule_and_run_orchestrator, task_id, plan_id, plan_json_str, scheduled_at)

    return ExecuteResponse(
        task_id=task_id,
        plan_id=plan_id,
        status="scheduled" if scheduled_at else "pending",
        message=(
            f"Execution queued. Poll status at "
            f"/api/execution-status/{task_id}"
        ),
    )


@app.post(
    "/api/execution-status/{task_id}/cancel",
    tags=["Execution"],
)
def cancel_execution(task_id: str):
    """
    Cancels a scheduled execution.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    if state.status == "scheduled":
        state.is_cancelled = True
        return {"message": "Execution cancelled."}
    else:
        raise HTTPException(status_code=400, detail=f"Cannot cancel task in status '{state.status}'.")


def _convert_plan_to_orchestrator_format(plan: dict) -> dict:
    """
    Convert the UI-saved plan format (cycles[] → scenarios[])
    into the orchestrator engine format (test_cycles[] → test_flows[] → scenarios[]).
    """
    global_config = plan.get("global_config", {})

    test_cycles = []
    for cycle in plan.get("cycles", []):
        test_flows = []
        
        # Backward compatibility: if cycle has 'scenarios', treat it as a single flow
        legacy_scenarios = cycle.get("scenarios")
        if legacy_scenarios is not None and len(legacy_scenarios) > 0:
            flow = {
                "flow_id":   f"FLOW-{cycle.get('id', uuid.uuid4())[:8].upper()}",
                "flow_name": cycle.get('flowName') or "Sin Grupo",
                "enabled":   cycle.get("enabled", True),
                "scenarios": [
                    {
                        "feature_path":   s.get("featurePath", ""),
                        "scenario_name":  s.get("scenarioName", ""),
                        "tags":           s.get("tags", []),
                        "enabled":        s.get("enabled", True),
                        "userdata":       s.get("userdata", {}),
                    }
                    for s in legacy_scenarios
                ],
            }
            test_flows.append(flow)
        else:
            # New nested flows structure
            for f in cycle.get("flows", []):
                flow = {
                    "flow_id":   f.get("id", str(uuid.uuid4())),
                    "flow_name": f.get("name", "Unnamed Flow"),
                    "enabled":   True,
                    "scenarios": [
                        {
                            "feature_path":   s.get("featurePath", ""),
                            "scenario_name":  s.get("scenarioName", ""),
                            "tags":           s.get("tags", []),
                            "enabled":        s.get("enabled", True),
                            "userdata":       s.get("userdata", {}),
                        }
                        for s in f.get("scenarios", [])
                    ],
                }
                test_flows.append(flow)

        test_cycles.append({
            "cycle_id":   cycle.get("id", str(uuid.uuid4())),
            "cycle_name": cycle.get("name", "Cycle"),
            "enabled":    cycle.get("enabled", True),
            "test_flows": test_flows,
        })

    return {
        "plan_id":       plan.get("id", "UNKNOWN"),
        "name":          plan.get("name", "Test Plan"),
        "enabled":       plan.get("enabled", True),
        "global_config": global_config,
        "test_cycles":   test_cycles,
    }


# ── Routes — Status Polling ─────────────────────────────────────────────────────

@app.get(
    "/api/execution-status/{task_id}",
    response_model=StatusResponse,
    tags=["Execution"],
)
def get_execution_status(task_id: str):
    """
    Poll the status of a running/completed execution.
    Returns: status (pending/running/finished/failed), log count, last log line, report URL.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found. It may have expired or never existed.",
        )

    return StatusResponse(**state.to_dict())


@app.get(
    "/api/execution-status/{task_id}/logs",
    tags=["Execution"],
)
def get_execution_logs(task_id: str, since: int = 0):
    """
    Return captured log lines for a task.

    Query param `since` (int): return only lines from this index onward.
    Useful for polling — save the last `log_lines` count and send it as `since`
    on the next request to receive only new lines.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    with state._lock:
        slice_ = state.logs[since:]
        total  = len(state.logs)

    return {
        "task_id":    task_id,
        "status":     state.status,
        "since":      since,
        "next_since": total,
        "lines":      slice_,
    }


@app.get(
    "/api/execution-status/{task_id}/stream",
    tags=["Execution"],
    response_class=StreamingResponse,
)
async def stream_execution_logs(task_id: str, request: Request):
    """
    Server-Sent Events (SSE) stream of orchestrator stdout.
    The frontend can connect with EventSource and receive live log lines.

    Example (JS):
        const es = new EventSource(`/api/execution-status/${taskId}/stream`);
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    async def event_generator():
        sent = 0
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            with state._lock:
                current_logs = state.logs[sent:]
                new_sent     = len(state.logs)
                current_status = state.status

            for line in current_logs:
                payload = json.dumps({"line": line, "status": current_status})
                yield f"data: {payload}\n\n"

            sent = new_sent

            # Stop streaming when execution completes
            if current_status in ("finished", "failed") and sent == new_sent:
                # Send a final status event
                yield f"data: {json.dumps({'line': None, 'status': current_status, 'done': True})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
        },
    )


# ── Routes — Utility ────────────────────────────────────────────────────────────

@app.get("/api/executions", tags=["Execution"])
def list_executions():
    """List all tracked executions (task IDs, statuses, plan IDs)."""
    with _state_lock:
        return [s.to_dict() for s in _executions.values()]


@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {
        "status": "ok",
        "orchestrator_exists": ORCHESTRATOR.exists(),
        "plans_db":            str(PLANS_DB_FILE),
        "allure_report_ready": ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()),
        "report_url":          "/allure-report/index.html",
    }


# ── Dev entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "orchestrator_api:app",
        host="0.0.0.0",
        port=5001,
        reload=True,
        log_level="info",
    )
