import { useEffect, useRef, useState } from 'react';

export type ScenarioExecStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Hook que suscribe al SSE de ejecución y parsea la salida estándar de Behave
 * para actualizar el estado de cada scenario en tiempo real.
 *
 * Parsing strategy (standard Behave output):
 *   "  Scenario: <name>"              → mark as 'running'
 *   "  Scenario Outline: <name>"      → mark as 'running'
 *   AssertionError / Error: / FAILED  → current running → will be 'failed'
 *   Next Scenario / done              → finalize current
 */
export function useExecutionScenarioStatus(
  taskId: string | null,
  scenarioNames: string[],
): Map<string, ScenarioExecStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, ScenarioExecStatus>>(new Map());
  const currentRunning = useRef<string | null>(null);
  const hasError      = useRef(false);
  const esRef         = useRef<EventSource | null>(null);

  useEffect(() => {
    // Reset map whenever taskId or scenarios change
    const initial = new Map<string, ScenarioExecStatus>();
    scenarioNames.forEach(n => initial.set(n, 'pending'));
    setStatusMap(initial);
    currentRunning.current = null;
    hasError.current = false;

    if (!taskId) return;

    const finalizeRunning = (overrideStatus?: ScenarioExecStatus) => {
      const name = currentRunning.current;
      if (!name) return;
      const status = overrideStatus ?? (hasError.current ? 'failed' : 'passed');
      setStatusMap(prev => {
        const next = new Map(prev);
        if (next.get(name) === 'running') next.set(name, status);
        return next;
      });
      currentRunning.current = null;
      hasError.current = false;
    };

    const markRunning = (name: string) => {
      // Finalize previous
      finalizeRunning();
      currentRunning.current = name;
      hasError.current = false;
      setStatusMap(prev => {
        const next = new Map(prev);
        // Match by exact name or contained name (handles long/trimmed names)
        const key = [...next.keys()].find(k => k === name || name.includes(k) || k.includes(name));
        if (key) next.set(key, 'running');
        return next;
      });
    };

    const es = new EventSource(`/api/execution-status/${taskId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.line) {
          const line: string = data.line;

          // ── Scenario start detection (JSON Logger) ─────────────────────────
          try {
            const parsedLine = JSON.parse(line);
            if (parsedLine.type === 'scenario_status') {
              if (parsedLine.status === 'running') {
                markRunning(parsedLine.scenario_name);
              }
              return;
            }
          } catch {
            // Not a JSON line, proceed with text parsing
          }

          // ── Scenario start detection (Text Formatter) ─────────────────────────
          const scenMatch = line.match(/^\s*Scenario(?:\s+Outline)?:\s+(.+?)(?:\s+#.*)?$/);
          if (scenMatch) {
            markRunning(scenMatch[1].trim());
            return;
          }

          // ── Failure indicators ─────────────────────────────────────────────
          // En behave formatter "plain", un step fallido dice "... FAILED" o "... failed"
          if (
            line.includes('AssertionError') ||
            line.includes('Error:') ||
            line.includes('FAILED') ||
            line.includes('failed') ||
            /^\s*Failing\s+scenarios/i.test(line)
          ) {
            hasError.current = true;
          }

          // ── Explicit scenario result line (some formatters) ─────────────────
          const resultMatch = line.match(/^\s*Scenario.*?:\s+(.+?)\s+\.\.\.\s+(passed|failed|skipped)/i);
          if (resultMatch) {
            const name   = resultMatch[1].trim();
            const status = resultMatch[2].toLowerCase() as ScenarioExecStatus;
            setStatusMap(prev => {
              const next = new Map(prev);
              const key = [...next.keys()].find(k => k === name || name.includes(k) || k.includes(name));
              if (key) next.set(key, status);
              return next;
            });
            if (currentRunning.current && (
              currentRunning.current === name ||
              name.includes(currentRunning.current) ||
              currentRunning.current.includes(name)
            )) {
              currentRunning.current = null;
              hasError.current = false;
            }
          }

          // ── Summary line ──────────────────────────────────────────────────
          const summaryMatch = line.match(/(\d+)\s+scenario.*?passed.*?(\d+)\s+failed.*?(\d+)\s+skipped/i);
          if (summaryMatch) {
            finalizeRunning();
          }
        }

        if (data.done) {
          finalizeRunning();
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      finalizeRunning();
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return statusMap;
}
