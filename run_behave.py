import subprocess
import sys
from pathlib import Path


def parse_failures(output: str):
    """Busca bloques de fallo en la salida de behave."""
    lines = output.splitlines()
    fail_blocks = []
    current = []
    in_fail = False

    for ln in lines:
        ln_stripped = ln.strip()
        # Behave output contains "Fail" keyword en la descripción o report.
        if ln_stripped.startswith("Fail") or ln_stripped.startswith("failed") or ln_stripped.startswith("Scenario") and "failed" in ln_stripped.lower():
            in_fail = True
            current = [ln]
            continue

        if in_fail:
            if ln_stripped == "":
                if current:
                    fail_blocks.append("\n".join(current))
                    current = []
                    in_fail = False
            else:
                current.append(ln)

    if current:
        fail_blocks.append("\n".join(current))

    return fail_blocks


def run_behave(features_dir="features", stop_on_failure=False, json_report=None, junit_report=None):
    cmd = ["behave", features_dir]
    if stop_on_failure:
        cmd.append("--stop")

    if json_report:
        cmd.extend(["--format", "json.pretty", "--outfile", str(Path(json_report).absolute())])

    if junit_report:
        cmd.extend(["--junit", "--junit-directory", str(Path(junit_report).absolute())])

    print(f"\nEjecutando: {' '.join(cmd)}\n")
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    print(proc.stdout, end="")
    if proc.stderr:
        print("\n--- STDERR ---")
        print(proc.stderr, end="")

    if proc.returncode == 0:
        print("\n✅ Behave completó correctamente.")
        return 0

    print(f"\n❌ Behave falló con código {proc.returncode}.")
    fail_blocks = parse_failures(proc.stdout + "\n" + proc.stderr)
    if fail_blocks:
        print("\n--- BLOQUES DE FALLO DETECTADOS ---")
        for i, block in enumerate(fail_blocks, 1):
            print(f"\n### FALLA #{i} ###\n{block}\n")
    else:
        print("\nNo se detectaron bloques de fallo específicos; revisa la salida completa.")

    if json_report and Path(json_report).exists():
        print("\n--- ANALIZANDO JSON PARA FALLAS DETALLADAS ---")
        try:
            import json
            with open(json_report, 'r', encoding='utf-8') as f:
                data = json.load(f)
            failed_scenarios = []
            for feature in data:
                feature_name = feature.get('name')
                for element in feature.get('elements', []):
                    if element.get('type') != 'scenario':
                        continue
                    status = element.get('status')
                    # Para behave json, puede venir como "failed" en steps o status global
                    step_statuses = [step.get('result', {}).get('status') for step in element.get('steps', [])]
                    if status == 'failed' or any(s == 'failed' for s in step_statuses if s):
                        failed_steps = [step for step in element.get('steps', []) if step.get('result', {}).get('status') == 'failed']
                        failed_scenarios.append({
                            'feature': feature_name,
                            'scenario': element.get('name'),
                            'line': element.get('line'),
                            'failed_steps': failed_steps,
                        })
            if failed_scenarios:
                for idx, sc in enumerate(failed_scenarios, 1):
                    print(f"\n### ESCENARIO FALLIDO #{idx}: {sc['scenario']} (Feature: {sc['feature']} line {sc['line']}) ###")
                    for fs in sc['failed_steps']:
                        msg = fs.get('name') or fs.get('keyword') or '<step>'
                        err = fs.get('result', {}).get('error_message', '').strip()
                        print(f" - {msg}\n   > {err}")
                        
                        # Análisis con GitHub Copilot CLI
                        if err:
                            print(f"\n--- ANÁLISIS DE COPILOT PARA ERROR EN '{sc['scenario']}' ---")
                            prompt = f"Analiza este error de una prueba Behave y determina si es un error de código (bug en el código bajo prueba) o un error ajeno (problema de entorno, configuración, etc.): {err}"
                            try:
                                result = subprocess.run(['gh', 'copilot', 'explain', prompt], capture_output=True, text=True, timeout=30)
                                if result.returncode == 0:
                                    analysis = result.stdout.strip()
                                    print(analysis)
                                    
                                    # Si es error de código, pedir más info y analizar
                                    if "error de código" in analysis.lower() or "bug en el código" in analysis.lower():
                                        print("\nEl error parece ser de código. Proporciona información adicional para análisis detallado.")
                                        fuentes = input("Proporciona la URL, path o nombre de la clase: ").strip()
                                        logs_path = input("Proporciona la ruta de los logs de la aplicación: ").strip()
                                        
                                        # Analizar fuentes
                                        if fuentes.startswith("http"):
                                            print(f"URL proporcionada: {fuentes} (no se puede leer automáticamente)")
                                        elif Path(fuentes).exists():
                                            try:
                                                with open(fuentes, 'r', encoding='utf-8') as f:
                                                    code_content = f.read()
                                                print(f"\n--- CONTENIDO DEL ARCHIVO {fuentes} (primeros 1000 caracteres) ---")
                                                print(code_content[:1000])
                                            except Exception as e:
                                                print(f"Error al leer el archivo: {e}")
                                        else:
                                            print(f"No se encontró el archivo o clase: {fuentes}")
                                        
                                        # Analizar logs
                                        if Path(logs_path).exists():
                                            try:
                                                with open(logs_path, 'r', encoding='utf-8') as f:
                                                    logs_content = f.read()
                                                print(f"\n--- LÍNEAS RELEVANTES EN LOGS {logs_path} ---")
                                                relevant_logs = [line for line in logs_content.splitlines() if any(word in line.lower() for word in err.lower().split())]
                                                if relevant_logs:
                                                    for line in relevant_logs[:10]:
                                                        print(line)
                                                else:
                                                    print("No se encontraron líneas relevantes en logs basadas en el error.")
                                            except Exception as e:
                                                print(f"Error al leer logs: {e}")
                                        else:
                                            print(f"No se encontró la ruta de logs: {logs_path}")
                                        
                                        # Análisis con Gherkin
                                        feature_file = Path("features") / f"{sc['feature'].replace(' ', '_').lower()}.feature"
                                        if feature_file.exists():
                                            try:
                                                with open(feature_file, 'r', encoding='utf-8') as f:
                                                    gherkin = f.read()
                                                print(f"\n--- GHERKIN DEL FEATURE '{sc['feature']}' ---")
                                                print(gherkin)
                                                
                                                print("\n--- ANÁLISIS INTEGRADO ---")
                                                print(f"Error detectado: {err}")
                                                print(f"Escenario fallido: {sc['scenario']}")
                                                print("Compara el Gherkin con el código y logs para identificar discrepancias.")
                                                # Análisis simple: buscar términos comunes
                                                gherkin_words = set(gherkin.lower().split())
                                                code_words = set(code_content.lower().split()) if 'code_content' in locals() else set()
                                                common = gherkin_words & code_words
                                                if common:
                                                    print(f"Términos comunes entre Gherkin y código: {list(common)[:10]}")
                                                else:
                                                    print("No se encontraron términos comunes directos.")
                                            except Exception as e:
                                                print(f"Error al leer o analizar feature: {e}")
                                        else:
                                            print(f"No se encontró el archivo feature: {feature_file}")
                                else:
                                    print(f"Error al ejecutar Copilot: {result.stderr.strip()}")
                            except subprocess.TimeoutExpired:
                                print("Tiempo de espera agotado para Copilot.")
                            except Exception as e:
                                print(f"No se pudo ejecutar Copilot: {e}")
            else:
                print("No se encontraron escenarios fallidos en el reporte JSON.")
        except Exception as e:
            print(f"No se pudo analizar el reporte JSON: {e}")

    if json_report:
        print(f"\nSe generó reporte JSON en: {Path(json_report).absolute()}")
    if junit_report:
        print(f"\nSe generó reporte JUnit en: {Path(junit_report).absolute()}")

    return proc.returncode


if __name__ == "__main__":
    stop_on_failure = "--stop" in sys.argv
    json_report = None
    junit_report = None
    features = "features"

    args = [arg for arg in sys.argv[1:] if arg not in ("--stop", "--json", "--junit") and not arg.startswith("--json=") and not arg.startswith("--junit=")]

    for arg in sys.argv[1:]:
        if arg.startswith("--json="):
            json_report = arg.split("=", 1)[1]
        if arg.startswith("--junit="):
            junit_report = arg.split("=", 1)[1]

    if len(args) > 0:
        # Primer valor posicional -> ruta de features
        features = args[0]

    code = run_behave(features_dir=features, stop_on_failure=stop_on_failure, json_report=json_report, junit_report=junit_report)
    sys.exit(code)
