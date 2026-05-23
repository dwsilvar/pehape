import { useEffect, useRef, useState } from 'react';

export type ScenarioExecStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Tracks real-time execution status per scenario row.
 *
 * Key design decisions:
 *  - Map key is the SCENARIO ID (not name) → avoids collisions when the same
 *    scenario name appears in multiple flows/cycles.
 *  - Status is PRESERVED after execution finishes (taskId becomes null).
 *    Only a NEW non-null taskId resets everything to 'pending'.
 *  - The orchestrator emits JSON events with scenario_id so we can match exactly.
 *    Falls back to name-matching for text-only formatters.
 */
export function useExecutionScenarioStatus(
  taskId: string | null,
  scenarioIds: string[],           // unique IDs matching FlatScenario.id
  scenarioNames: string[],         // parallel array for text-based name matching
): Map<string, ScenarioExecStatus> {

  const [statusMap, setStatusMap] = useState<Map<string, ScenarioExecStatus>>(new Map());
  const statusMapRef      = useRef<Map<string, ScenarioExecStatus>>(new Map()); // sync ref for resolveId
  const currentRunningId  = useRef<string | null>(null);  // ID of the running scenario
  const currentRunningName = useRef<string | null>(null); // name, for text-based matching
  const esRef             = useRef<EventSource | null>(null);
  const lastTaskId        = useRef<string | null>(null);

  // ── Reset map only when a NEW task starts ──────────────────────────────────
  useEffect(() => {
    if (!taskId) return; // taskId → null after execution: keep existing states
    if (taskId === lastTaskId.current) return; // same task, no reset

    lastTaskId.current = taskId;

    // Reset all to pending for the new run
    const initial = new Map<string, ScenarioExecStatus>();
    scenarioIds.forEach(id => initial.set(id, 'pending'));
    statusMapRef.current = initial;
    setStatusMap(new Map(initial));
    currentRunningId.current  = null;
    currentRunningName.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ── SSE subscription ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Resolve scenario ID from an emitted scenario_id or by name fallback.
     *
     * When scenario_id is provided it matches exactly (O(1)).
     * When only the name is available we do a sequential scan, but we skip IDs
     * that have already been assigned a terminal status (passed/failed/skipped)
     * so duplicate scenario names advance to the next unresolved slot rather
     * than always colliding on the first one.
     */
    const resolveId = (scenarioId?: string, name?: string): string | undefined => {
      // 1. Exact ID match — always preferred
      if (scenarioId && scenarioIds.includes(scenarioId)) return scenarioId;

      // 2. Name-based fallback — find the first slot with this name that is
      //    still pending or running (i.e. not yet terminated).
      if (name) {
        // Collect all indices that match the name
        const matchingIndices: number[] = [];
        for (let i = 0; i < scenarioNames.length; i++) {
          const n = scenarioNames[i];
          if (n === name || name.includes(n) || n.includes(name)) {
            matchingIndices.push(i);
          }
        }
        if (matchingIndices.length === 0) return undefined;
        if (matchingIndices.length === 1) return scenarioIds[matchingIndices[0]];

        // Multiple slots share this name — prefer the first one that is not
        // yet in a terminal state so we don't clobber an already-resolved slot.
        // We read the current statusMap via a ref to avoid capturing stale closure.
        // (statusMap ref is kept up-to-date via the setter pattern below.)
        for (const idx of matchingIndices) {
          const id = scenarioIds[idx];
          const currentStatus = statusMapRef.current.get(id);
          if (!currentStatus || currentStatus === 'pending' || currentStatus === 'running') {
            return id;
          }
        }
        // All slots are in terminal state → fall back to the last one
        return scenarioIds[matchingIndices[matchingIndices.length - 1]];
      }
      return undefined;
    };

    const finalizeRunning = (overrideStatus?: ScenarioExecStatus) => {
      const id = currentRunningId.current;
      if (!id) return;
      
      if (statusMapRef.current.get(id) === 'running') {
        statusMapRef.current.set(id, overrideStatus ?? 'passed');
        setStatusMap(new Map(statusMapRef.current));
      }
      
      currentRunningId.current   = null;
      currentRunningName.current = null;
    };

    const markRunning = (scenarioId?: string, name?: string) => {
      finalizeRunning(); // close previous
      const id = resolveId(scenarioId, name);
      if (!id) return;
      currentRunningId.current   = id;
      currentRunningName.current = name ?? null;
      
      statusMapRef.current.set(id, 'running');
      setStatusMap(new Map(statusMapRef.current));
    };

    const markStatus = (status: ScenarioExecStatus, scenarioId?: string, name?: string) => {
      const id = resolveId(scenarioId, name);
      if (!id) return;
      
      statusMapRef.current.set(id, status);
      setStatusMap(new Map(statusMapRef.current));
      
      if (currentRunningId.current === id) {
        currentRunningId.current   = null;
        currentRunningName.current = null;
      }
    };

    // ── Connect EventSource ───────────────────────────────────────────────────
    const es = new EventSource(`/api/execution-status/${taskId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.line) {
          const line: string = data.line;
          console.debug('[ExecutionMonitor SSE]', line);

          // ── 1. JSON event from orchestrator.py ────────────────────────────
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'scenario_status') {
              const sid  = ev.scenario_id;
              const name = ev.scenario_name;
              if (ev.status === 'running') {
                markRunning(sid, name);
              } else if (['passed', 'failed', 'skipped'].includes(ev.status)) {
                markStatus(ev.status as ScenarioExecStatus, sid, name);
              }
            }
          } catch {
            // Ignore parse errors for non-JSON lines
          }
        }

        // Execution finished signal
        if (data.done || data.status === 'finished' || data.status === 'failed') {
          finalizeRunning();
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Connection dropped — finalize any still-running scenario
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
