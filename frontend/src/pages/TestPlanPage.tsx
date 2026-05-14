import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, useTheme } from '@mui/material';
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import { TestPlan, TestCycle, TestFlow, ScenarioRef, FeatureWithScenarios } from '../types';
import PlanHeader from '../components/test-plan/PlanHeader';
import PlanHierarchyPanel from '../components/test-plan/PlanHierarchyPanel';
import FlowCanvas from '../components/test-plan/FlowCanvas';
import AssetLibraryPanel from '../components/test-plan/AssetLibraryPanel';
import ExecutionDrawer from '../components/test-plan/ExecutionDrawer';

// ── Resize constants ─────────────────────────────────────────────────────────
const LEFT_WIDTH_DEFAULT = 260;
const RIGHT_WIDTH_DEFAULT = 320;
const MIN_PANEL_WIDTH = 180;

const TestPlanPage: React.FC = () => {
  // ── Plans state ─────────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('idle');

  // ── Library state ───────────────────────────────────────────────────────────
  const [features, setFeatures] = useState<FeatureWithScenarios[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);

  // ── Resize state ────────────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(LEFT_WIDTH_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_WIDTH_DEFAULT);
  const theme = useTheme();
  const layoutRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null;
  const selectedCycle = selectedPlan?.cycles.find(c => c.id === selectedCycleId) ?? null;
  const selectedFlow = selectedCycle?.flows?.find(f => f.id === selectedFlowId) ?? null;

  // ── Load plans ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/test-plans')
      .then(r => r.ok ? r.json() : [])
      .then((data: TestPlan[]) => {
        setPlans(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setSelectedPlanId(data[0].id);
          if (data[0].cycles?.length > 0) {
            setSelectedCycleId(data[0].cycles[0].id);
            if (data[0].cycles[0].flows?.length > 0) {
              setSelectedFlowId(data[0].cycles[0].flows[0].id);
            }
          }
        }
      })
      .catch(() => setPlans([]));
  }, []);

  // ── Load features with scenarios ─────────────────────────────────────────────
  useEffect(() => {
    setIsLibraryLoading(true);
    fetch('/api/features-with-scenarios')
      .then(r => r.ok ? r.json() : [])
      .then((data: FeatureWithScenarios[]) => setFeatures(Array.isArray(data) ? data : []))
      .catch(() => setFeatures([]))
      .finally(() => setIsLibraryLoading(false));
  }, []);

  // ── Persistence ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/test-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plans),
      });
      setIsSaved(true);
    } catch (e) {
      console.error('Failed to save test plans', e);
    }
  }, [plans]);

  const markDirty = useCallback(() => setIsSaved(false), []);

  // ── Plan CRUD ─────────────────────────────────────────────────────────────────
  const handleAddPlan = useCallback((name: string) => {
    const newPlan: TestPlan = { id: uuidv4(), name, status: 'draft', cycles: [] };
    setPlans(prev => [...prev, newPlan]);
    setSelectedPlanId(newPlan.id);
    setSelectedCycleId(null);
    setSelectedFlowId(null);
    markDirty();
  }, [markDirty]);

  const handleAddCycle = useCallback((planId: string, name: string) => {
    const newCycle: TestCycle = { id: uuidv4(), name, flows: [] };
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, cycles: [...(p.cycles || []), newCycle] } : p
    ));
    setSelectedCycleId(newCycle.id);
    setSelectedFlowId(null);
    markDirty();
  }, [markDirty]);

  const handleAddFlow = useCallback((planId: string, cycleId: string, name: string) => {
    const newFlow: TestFlow = { id: uuidv4(), name, scenarios: [] };
    setPlans(prev => prev.map(p =>
      p.id === planId ? {
        ...p,
        cycles: p.cycles.map(c =>
          c.id === cycleId ? { ...c, flows: [...(c.flows || []), newFlow] } : c
        )
      } : p
    ));
    setSelectedFlowId(newFlow.id);
    markDirty();
  }, [markDirty]);

  const handleDeletePlan = useCallback((planId: string) => {
    setPlans(prev => prev.filter(p => p.id !== planId));
    if (selectedPlanId === planId) {
      setSelectedPlanId(null);
      setSelectedCycleId(null);
      setSelectedFlowId(null);
    }
    markDirty();
  }, [selectedPlanId, markDirty]);

  const handleDeleteCycle = useCallback((planId: string, cycleId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? { ...p, cycles: p.cycles.filter(c => c.id !== cycleId) } : p
    ));
    if (selectedCycleId === cycleId) {
      setSelectedCycleId(null);
      setSelectedFlowId(null);
    }
    markDirty();
  }, [selectedCycleId, markDirty]);

  const handleDeleteFlow = useCallback((planId: string, cycleId: string, flowId: string) => {
    setPlans(prev => prev.map(p =>
      p.id === planId ? {
        ...p,
        cycles: p.cycles.map(c =>
          c.id === cycleId ? { ...c, flows: (c.flows || []).filter(f => f.id !== flowId) } : c
        )
      } : p
    ));
    if (selectedFlowId === flowId) setSelectedFlowId(null);
    markDirty();
  }, [selectedFlowId, markDirty]);

  const handleSelectNode = useCallback((planId: string, cycleId: string | null, flowId: string | null) => {
    setSelectedPlanId(planId);
    setSelectedCycleId(cycleId);
    setSelectedFlowId(flowId);
  }, []);

  // ── Scenario CRUD inside flow ─────────────────────────────────────────────
  const updateFlowScenarios = useCallback((updater: (prev: ScenarioRef[]) => ScenarioRef[]) => {
    if (!selectedPlanId || !selectedCycleId || !selectedFlowId) return;
    setPlans(prev => prev.map(p =>
      p.id === selectedPlanId
        ? {
            ...p,
            cycles: p.cycles.map(c =>
              c.id === selectedCycleId
                ? {
                    ...c,
                    flows: (c.flows || []).map(f =>
                      f.id === selectedFlowId
                        ? { ...f, scenarios: updater(f.scenarios || []) }
                        : f
                    )
                  }
                : c
            ),
          }
        : p
    ));
    markDirty();
  }, [selectedPlanId, selectedCycleId, selectedFlowId, markDirty]);

  const handleFlowNameChange = useCallback((newName: string) => {
    if (!selectedPlanId || !selectedCycleId || !selectedFlowId) return;
    setPlans(prev => prev.map(p =>
      p.id === selectedPlanId
        ? {
            ...p,
            cycles: p.cycles.map(c =>
              c.id === selectedCycleId
                ? {
                    ...c,
                    flows: (c.flows || []).map(f =>
                      f.id === selectedFlowId
                        ? { ...f, name: newName }
                        : f
                    )
                  }
                : c
            ),
          }
        : p
    ));
    markDirty();
  }, [selectedPlanId, selectedCycleId, selectedFlowId, markDirty]);

  const handleRemoveScenario = useCallback((id: string) => {
    updateFlowScenarios(prev => prev.filter(s => s.id !== id));
  }, [updateFlowScenarios]);

  const handleMoveUp = useCallback((id: string) => {
    updateFlowScenarios(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx <= 0) return prev;
      return arrayMove(prev, idx, idx - 1);
    });
  }, [updateFlowScenarios]);

  const handleMoveDown = useCallback((id: string) => {
    updateFlowScenarios(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      return arrayMove(prev, idx, idx + 1);
    });
  }, [updateFlowScenarios]);

  // ── DnD ───────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedPlanId || !selectedCycleId || !selectedFlowId) return;

    // Case 1: Drop from library into canvas
    if (active.data.current?.type === 'library-scenario' &&
        (over.id === 'flow-canvas-drop' || over.data.current?.type === 'flow-scenario')) {
      const { featurePath, featureName, featureTitle, scenario } = active.data.current;
      const newRef: ScenarioRef = {
        id: uuidv4(),
        featurePath,
        featureName: featureTitle || featureName,
        scenarioName: scenario.name,
        tags: scenario.tags,
        steps: scenario.steps,
      };
      updateFlowScenarios(prev => {
        // If dropped on a specific node, insert before it; otherwise append
        if (over.data.current?.type === 'flow-scenario') {
          const overIdx = prev.findIndex(s => s.id === over.id);
          const next = [...prev];
          next.splice(overIdx >= 0 ? overIdx : next.length, 0, newRef);
          return next;
        }
        return [...prev, newRef];
      });
      return;
    }

    // Case 2: Reorder within canvas
    if (active.data.current?.type === 'flow-scenario' && over.data.current?.type === 'flow-scenario' && active.id !== over.id) {
      updateFlowScenarios(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, [selectedPlanId, selectedCycleId, selectedFlowId, updateFlowScenarios]);

  // ── Execution ───────────────────────────────────────────────────────────────
  const handleExecute = useCallback(async (scheduledAt?: string) => {
    if (!selectedPlanId) return;
    setIsExecuting(true);
    setIsDrawerOpen(true);
    setCurrentTaskId(null); // Reset
    
    try {
      const url = scheduledAt
        ? `/api/execute-plan/${selectedPlanId}?scheduled_at=${encodeURIComponent(scheduledAt)}`
        : `/api/execute-plan/${selectedPlanId}`;
      const res = await fetch(url, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentTaskId(data.task_id);
        setExecutionStatus(data.status || (scheduledAt ? 'scheduled' : 'pending'));
      } else {
        console.error('Failed to start execution');
        setIsExecuting(false);
      }
    } catch (e) {
      console.error('Error starting execution', e);
      setIsExecuting(false);
    }
  }, [selectedPlanId]);

  // ── Resize handlers ─────────────────────────────────────────────────────────
  const makeResizeHandler = useCallback((side: 'left' | 'right') => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = side === 'left' ? leftWidth : rightWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newW = Math.max(MIN_PANEL_WIDTH, startWidth + (side === 'left' ? delta : -delta));
        if (side === 'left') setLeftWidth(newW);
        else setRightWidth(newW);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  }, [leftWidth, rightWidth]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <Box
        ref={layoutRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          bgcolor: theme.palette.custom.bgMain,
        }}
      >
        {/* ── Top header bar ── */}
        <PlanHeader
          plan={selectedPlan}
          cycle={selectedCycle}
          flow={selectedFlow}
          isSaved={isSaved}
          onSave={handleSave}
          onExecute={handleExecute}
          isExecuting={isExecuting}
          executionStatus={executionStatus}
        />

        {/* ── Three-column workspace ── */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Left: Plan Hierarchy */}
          <Box sx={{ width: leftWidth, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PlanHierarchyPanel
              plans={plans}
              selectedPlanId={selectedPlanId}
              selectedCycleId={selectedCycleId}
              selectedFlowId={selectedFlowId}
              onSelectNode={handleSelectNode}
              onAddPlan={handleAddPlan}
              onAddCycle={handleAddCycle}
              onAddFlow={handleAddFlow}
              onDeletePlan={handleDeletePlan}
              onDeleteCycle={handleDeleteCycle}
              onDeleteFlow={handleDeleteFlow}
            />
          </Box>

          {/* Left resize handle */}
          <Box
            onMouseDown={makeResizeHandler('left')}
            sx={{
              width: 4,
              cursor: 'col-resize',
              bgcolor: theme.palette.custom.border,
              flexShrink: 0,
              '&:hover': { bgcolor: 'primary.main' },
              transition: 'background-color 0.15s ease',
            }}
          />

          {/* Center: Flow Canvas */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <FlowCanvas
              flow={selectedFlow}
              noFlowSelected={!selectedFlowId}
              onRemoveScenario={handleRemoveScenario}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onFlowNameChange={handleFlowNameChange}
            />
          </Box>

          {/* Right resize handle */}
          <Box
            onMouseDown={makeResizeHandler('right')}
            sx={{
              width: 4,
              cursor: 'col-resize',
              bgcolor: theme.palette.custom.border,
              flexShrink: 0,
              '&:hover': { bgcolor: 'primary.main' },
              transition: 'background-color 0.15s ease',
            }}
          />

          {/* Right: Asset Library */}
          <Box sx={{ width: rightWidth, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AssetLibraryPanel
              features={features}
              isLoading={isLibraryLoading}
            />
          </Box>
        </Box>

        {/* ── Execution Drawer (bottom) ── */}
        <ExecutionDrawer 
          isOpen={isDrawerOpen} 
          onToggle={() => setIsDrawerOpen(v => !v)}
          taskId={currentTaskId}
          onExecutionFinished={() => setIsExecuting(false)}
          onStatusChange={setExecutionStatus}
        />
      </Box>
    </DndContext>
  );
};

export default TestPlanPage;
