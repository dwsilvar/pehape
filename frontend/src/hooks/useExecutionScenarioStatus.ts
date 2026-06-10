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
 *  - An async event queue (with a small inter-event delay) ensures React renders
 *    each status transition separately, so "running" is visible before "passed/failed".
 */
export function useExecutionScenarioStatus(
  taskId: string | null,
  scenarioIds: string[],           // unique IDs matching FlatScenario.id
  scenarioNames: string[],         // parallel array for text-based name matching
) {

  const [statusMap, setStatusMap] = useState<Map<string, ScenarioExecStatus>>(new Map());
  const statusMapRef      = useRef<Map<string, ScenarioExecStatus>>(new Map()); // sync ref for resolveId
  const [taskStatusMap, setTaskStatusMap] = useState<Map<string, 'pending' | 'running' | 'passed' | 'failed'>>(new Map());
  const taskStatusMapRef  = useRef<Map<string, 'pending' | 'running' | 'passed' | 'failed'>>(new Map());
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

    taskStatusMapRef.current = new Map();
    setTaskStatusMap(new Map());

    currentRunningId.current  = null;
    currentRunningName.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ── SSE subscription ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Resolve scenario ID from an emitted scenario_id or by name fallback. */
    const resolveId = (scenarioId?: string, name?: string): string | undefined => {
      // 1. Exact ID match — always preferred
      if (scenarioId && scenarioIds.includes(scenarioId)) return scenarioId;

      // 2. Name-based fallback — find the first slot with this name that is
      //    still pending or running (i.e. not yet terminated).
      if (name) {
        const matchingIndices: number[] = [];
        for (let i = 0; i < scenarioNames.length; i++) {
          const n = scenarioNames[i];
          if (n === name || name.includes(n) || n.includes(name)) {
            matchingIndices.push(i);
          }
        }
        if (matchingIndices.length === 0) return undefined;
        if (matchingIndices.length === 1) return scenarioIds[matchingIndices[0]];

        for (const idx of matchingIndices) {
          const id = scenarioIds[idx];
          const currentStatus = statusMapRef.current.get(id);
          if (!currentStatus || currentStatus === 'pending' || currentStatus === 'running') {
            return id;
          }
        }
        return scenarioIds[matchingIndices[matchingIndices.length - 1]];
      }
      return undefined;
    };

    const applyRunning = (scenarioId?: string, name?: string) => {
      // Finalize any previous running scenario first
      const prevId = currentRunningId.current;
      if (prevId && statusMapRef.current.get(prevId) === 'running') {
        statusMapRef.current.set(prevId, 'passed');
      }
      currentRunningId.current  = null;
      currentRunningName.current = null;

      const id = resolveId(scenarioId, name);
      if (!id) return;
      currentRunningId.current   = id;
      currentRunningName.current = name ?? null;
      statusMapRef.current.set(id, 'running');
      setStatusMap(new Map(statusMapRef.current));
    };

    const applyStatus = (status: ScenarioExecStatus, scenarioId?: string, name?: string) => {
      const id = resolveId(scenarioId, name);
      if (!id) return;
      statusMapRef.current.set(id, status);
      setStatusMap(new Map(statusMapRef.current));
      if (currentRunningId.current === id) {
        currentRunningId.current  = null;
        currentRunningName.current = null;
      }
    };

    const applyFinalize = (overrideStatus?: ScenarioExecStatus) => {
      const id = currentRunningId.current;
      if (id && statusMapRef.current.get(id) === 'running') {
        statusMapRef.current.set(id, overrideStatus ?? 'passed');
        setStatusMap(new Map(statusMapRef.current));
      }
      currentRunningId.current  = null;
      currentRunningName.current = null;
    };

    // ── Async event queue ─────────────────────────────────────────────────────
    // Each scenario_status event from the SSE stream is queued and processed
    // with a 120 ms gap.  This breaks React's automatic batching so that
    // "running" always triggers its own render before "passed/failed" arrives,
    // making the pulse animation consistently visible to the user.
    type QueuedEvt =
      | { kind: 'running';  sid?: string; name?: string }
      | { kind: 'terminal'; status: ScenarioExecStatus; sid?: string; name?: string }
      | { kind: 'task_status'; key: string; status: 'running' | 'passed' | 'failed' }
      | { kind: 'finalize' };

    const queue: QueuedEvt[] = [];
    let draining = false;

    const drain = () => {
      if (draining || queue.length === 0) return;
      draining = true;
      const evt = queue.shift()!;

      if (evt.kind === 'running') {
        applyRunning(evt.sid, evt.name);
      } else if (evt.kind === 'terminal') {
        applyStatus(evt.status, evt.sid, evt.name);
      } else if (evt.kind === 'task_status') {
        taskStatusMapRef.current.set(evt.key, evt.status);
        setTaskStatusMap(new Map(taskStatusMapRef.current));
      } else {
        applyFinalize();
      }

      if (queue.length > 0) {
        // 120 ms gap so React flushes the previous render before we apply the next state
        setTimeout(() => { draining = false; drain(); }, 120);
      } else {
        draining = false;
      }
    };

    const enqueue = (evt: QueuedEvt) => {
      queue.push(evt);
      drain();
    };

    // ── Connect EventSource ───────────────────────────────────────────────────
    const es = new EventSource(`/api/execution-status/${taskId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.line) {
          const line: string = data.line;

          // JSON event from orchestrator.py
          try {
            // Remove the "    │ " prefix if present from Behave output
            let cleanLine = line.trim();
            if (cleanLine.startsWith('│')) {
              cleanLine = cleanLine.substring(1).trim();
            }
            const ev = JSON.parse(cleanLine);
            if (ev.type === 'scenario_status') {
              const sid  = ev.scenario_id;
              const name = ev.scenario_name;
              if (ev.status === 'running') {
                enqueue({ kind: 'running', sid, name });
              } else if (['passed', 'failed', 'skipped'].includes(ev.status)) {
                enqueue({ kind: 'terminal', status: ev.status as ScenarioExecStatus, sid, name });
              }
            } else if (ev.type === 'task_status' && ev.scenario_id && ev.task?.id) {
              const compositeKey = `${ev.scenario_id}::${ev.task.id}`;
              const taskStatus = ev.task.status as 'running' | 'passed' | 'failed';
              enqueue({ kind: 'task_status', key: compositeKey, status: taskStatus });
            }
          } catch {
            // non-JSON line — ignore
          }
        }

        // Execution finished signal
        if (data.done || data.status === 'finished' || data.status === 'failed') {
          enqueue({ kind: 'finalize' });
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      enqueue({ kind: 'finalize' });
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return { statusMap, taskStatusMap };
}

