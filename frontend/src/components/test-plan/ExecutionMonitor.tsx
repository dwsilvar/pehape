import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, alpha, useTheme, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, IconButton,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { BlueprintsData, BlueprintRef, PlanBlueprint, PlanTask } from '../../types';
import { ScenarioIcon, FeatureIcon, CycleIcon, FlowIcon } from '../PehapeIcons';
import { useExecutionScenarioStatus, ScenarioExecStatus } from '../../hooks/useExecutionScenarioStatus';
import TaskAssociationDialog from './TaskAssociationDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlatScenario {
  id: string;
  scenarioName: string;
  featureName: string;
  featurePath: string;
  planName: string;
  cycleName: string;
  cycleId?: string;
  setName: string;
  setId?: string;
  flowName: string;
  flowId?: string;
  parentGroupId?: string;
  parentGroupName?: string;
  groupId: string;
  groupName: string;
  isSetCombo: boolean;
  sourceType: string;
  sourceName: string;
  tasks: PlanTask[];
  featureRefId?: string;
  featureScenarios?: string[];
  scenarioRefId?: string;
}

interface ExecutionMonitorProps {
  blueprints: BlueprintsData;
  selectedPlanId: string | null;
  taskId: string | null;
  isExecuting: boolean;
  isGeneratingReport?: boolean;
  onUpdateTasksAtLevel?: (
    level: 'scenario' | 'flow' | 'set' | 'cycle',
    targetId: string,
    tasks: PlanTask[],
    applyToAll?: boolean,
    cycleId?: string,
    blueprintId?: string
  ) => void;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ScenarioExecStatus }> = ({ status }) => {
  const theme = useTheme();

  if (status === 'running') {
    return (
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: theme.palette.warning.main,
          flexShrink: 0,
          animation: 'executionPulse 1s ease-in-out infinite',
          '@keyframes executionPulse': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.4, transform: 'scale(0.75)' },
          },
        }}
      />
    );
  }
  if (status === 'passed') {
    return <CheckCircleRoundedIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />;
  }
  if (status === 'failed') {
    return <CancelRoundedIcon sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />;
  }
  if (status === 'skipped') {
    return <RemoveCircleRoundedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />;
  }
  // pending
  return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />;
};

// ── Status chip (summary) ─────────────────────────────────────────────────────

const SummaryChip: React.FC<{ count: number; status: ScenarioExecStatus }> = ({ count, status }) => {
  const theme = useTheme();
  if (count === 0) return null;

  const colors: Record<string, string> = {
    running: theme.palette.warning.main,
    passed: theme.palette.success.main,
    failed: theme.palette.error.main,
    skipped: theme.palette.text.disabled,
    pending: theme.palette.text.disabled,
  };
  const labels: Record<string, string> = {
    running: '▶',
    passed: '✓',
    failed: '✗',
    skipped: '—',
    pending: '○',
  };

  const color = colors[status];
  return (
    <Chip
      label={`${labels[status]} ${count}`}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.6rem',
        fontWeight: 700,
        bgcolor: alpha(color, 0.12),
        color,
        border: `1px solid ${alpha(color, 0.3)}`,
        '& .MuiChip-label': { px: 0.6 },
      }}
    />
  );
};

const getTaskChipStyles = (status: 'pending' | 'running' | 'passed' | 'failed', theme: any) => {
  const isDark = theme.palette.mode === 'dark';

  if (status === 'running') {
    return {
      bgcolor: alpha(theme.palette.warning.main, 0.12),
      color: theme.palette.warning.main,
      border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
      animation: 'taskPulse 1.5s ease-in-out infinite',
      '@keyframes taskPulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.6 },
      },
    };
  }
  if (status === 'passed') {
    return {
      bgcolor: alpha(theme.palette.success.main, 0.12),
      color: theme.palette.success.main,
      border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
    };
  }
  if (status === 'failed') {
    return {
      bgcolor: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.main,
      border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
    };
  }
  // pending
  return {
    bgcolor: isDark ? alpha(theme.palette.text.disabled, 0.05) : alpha(theme.palette.text.disabled, 0.1),
    color: theme.palette.text.secondary,
    border: `1px solid ${alpha(theme.palette.text.disabled, 0.2)}`,
  };
};

const toSentenceCase = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

// ── Main component ────────────────────────────────────────────────────────────

const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  blueprints, selectedPlanId, taskId, isExecuting, isGeneratingReport = false, onUpdateTasksAtLevel,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const headerBg = theme.palette.custom?.tableHeaderBg || theme.palette.custom?.bgCanvas || (isDark ? '#0b1120' : '#f1f5f9');

  // State to store resizable column widths
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({
    cycle: 130,
    set: 130,
    flow: 130,
    scenario: 320,
    feature: 180,
    tareas: 220,
    resultado: 120,
  });

  // Handler for mouse column resizing
  const startResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = colWidths[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(70, startWidth + deltaX), // minimum width of 70px
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ── Derive flat scenario list from the selected plan ───────────────────────
  const { flatScenarios, plan } = useMemo(() => {
    const plan = blueprints.plans.find(p => p.id === selectedPlanId) ?? null;
    if (!plan) return { flatScenarios: [], plan: null };

    const flat: FlatScenario[] = [];

    const mergeAndStampTasks = (
      scenarioId: string,
      scenarioName: string,
      pTasks: PlanTask[] = [],
      cTasks: PlanTask[] = [],
      fTasks: PlanTask[] = [],
      sTasks: PlanTask[] = []
    ) => {
      // 1. Check if there are any instance-specific tasks in the containers
      const hasInstanceOverride = [pTasks, cTasks, fTasks].some(tasksList =>
        Array.isArray(tasksList) && tasksList.some(t => t.targetScenario === scenarioId)
      );

      const merged: PlanTask[] = [];

      // 2. Process container tasks (plan, cycle, flow)
      [pTasks, cTasks, fTasks].forEach(tasksList => {
        if (Array.isArray(tasksList)) {
          tasksList.forEach(t => {
            const targetS = t.targetScenario;
            const matchesInstance = targetS === scenarioId;
            const matchesName = targetS === scenarioName;
            const isGlobal = !targetS || targetS === 'all';

            if (matchesInstance || matchesName || isGlobal) {
              if (t.name === '__none__') {
                return;
              }
              merged.push({ ...t, id: t.id || `${scenarioId}-${t.name}` });
            }
          });
        }
      });

      // 3. Process scenario-level blueprint tasks only if there is no instance override
      if (!hasInstanceOverride && Array.isArray(sTasks)) {
        sTasks.forEach(t => {
          const targetS = t.targetScenario;
          if (!targetS || targetS === 'all' || targetS === scenarioName || targetS === scenarioId) {
            if (t.name === '__none__') return;
            merged.push({ ...t, id: t.id || `${scenarioId}-${t.name}` });
          }
        });
      }

      return merged;
    };

    const product = (arr: any[][][]): any[][] => {
      if (arr.length === 0) return [];
      if (arr.length === 1) return arr[0];
      const result: any[][] = [];
      const allCasesOfRest = product(arr.slice(1));
      for (let i = 0; i < arr[0].length; i++) {
        for (let j = 0; j < allCasesOfRest.length; j++) {
          result.push([...arr[0][i], ...allCasesOfRest[j]]);
        }
      }
      return result;
    };

    for (const cRef of plan.items ?? []) {
      if (cRef.type !== 'cycle') continue;
      const cycle = blueprints.cycles.find(c => c.id === cRef.refId);
      if (!cycle) continue;

      for (const ref of cycle.items ?? []) {
        if (ref.type === 'flow') {
          const flow = blueprints.flows.find(f => f.id === ref.refId);
          if (flow) {
            for (const s of flow.items ?? []) {
              const pTasks = plan.tasks ?? [];
              const cTasks = cycle.tasks ?? [];
              const fTasks = flow.tasks ?? [];
              const sTasks = s.tasks ?? [];
              const scenarioInstanceId = `flow-${cRef.id}-${ref.id}-${s.id}`;
              const scenarioTasks = mergeAndStampTasks(scenarioInstanceId, s.scenarioName || s.name, pTasks, cTasks, fTasks, sTasks);

              flat.push({
                id: scenarioInstanceId,
                scenarioName: s.scenarioName || s.name,
                featureName: s.featurePath ? s.featurePath.split('/').pop()! : '',
                featurePath: s.featurePath || '',
                planName: plan.name,
                cycleName: cycle.name,
                cycleId: cycle.id,
                setName: '—',
                flowName: flow.name,
                flowId: flow.id,
                groupId: `flow-${cRef.id}-${ref.id}`,
                groupName: flow.name,
                isSetCombo: false,
                sourceType: 'flow',
                sourceName: flow.name,
                tasks: scenarioTasks,
                scenarioRefId: s.id,
              });
            }
          }
        } else if (ref.type === 'set') {
          const set = blueprints.sets.find(s => s.id === ref.refId);
          if (set) {
            const choicesPerItem: any[][][] = [];
            for (const setRef of set.items ?? []) {
              if (setRef.type === 'flow') {
                const flow = blueprints.flows.find(f => f.id === setRef.refId);
                if (flow && flow.items.length > 0) {
                  const enhancedItems = flow.items.map(i => ({
                    ...i,
                    sourceName: flow.name,
                    sourceType: 'flow',
                    flow_tasks: flow.tasks ?? [],
                    flowId: flow.id,
                  }));
                  choicesPerItem.push([enhancedItems]);
                }
              } else if (setRef.type === 'feature') {
                const scenarios: any[][] = [];
                for (const sname of setRef.steps ?? []) {
                  scenarios.push([{
                    id: `${setRef.refId}-${sname}`,
                    refId: '',
                    type: 'scenario',
                    scenarioName: sname,
                    name: sname,
                    featurePath: setRef.featurePath || setRef.refId,
                    sourceName: setRef.name || setRef.refId.split('/').pop(),
                    sourceType: 'feature',
                    feature_tasks: setRef.tasks ?? [],
                    featureRefId: setRef.id,
                    featureScenarios: setRef.steps,
                  }]);
                }
                if (scenarios.length > 0) {
                  choicesPerItem.push(scenarios);
                }
              }
            }

            if (choicesPerItem.length > 0) {
              const combinations = product(choicesPerItem);
              combinations.forEach((combo, idx) => {
                const groupId = `set-${cRef.id}-${ref.id}-combo-${idx}`;
                const translatedCase = t('common.case', 'case');
                const capitalizedCase = translatedCase.charAt(0).toUpperCase() + translatedCase.slice(1);
                const groupName = `${capitalizedCase} ${idx + 1}`;
                combo.forEach((s, sIdx) => {
                  const scenarioId = `set-${cRef.id}-${ref.id}-${idx}-${sIdx}-${s.id}`;
                  const pTasks = plan.tasks ?? [];
                  const cTasks = cycle.tasks ?? [];
                  const setTasks = set.tasks ?? [];

                  let fTasks = [...setTasks];
                  let sTasks: PlanTask[] = [];
                  if (s.sourceType === 'flow') {
                    fTasks = [...fTasks, ...(s.flow_tasks ?? [])];
                    sTasks = s.tasks ?? [];
                  } else {
                    fTasks = [...fTasks, ...(s.feature_tasks ?? [])];
                  }

                  const scenarioTasks = mergeAndStampTasks(scenarioId, s.scenarioName || s.name, pTasks, cTasks, fTasks, sTasks);

                  flat.push({
                    id: scenarioId,
                    scenarioName: s.scenarioName || s.name,
                    featureName: s.featurePath ? s.featurePath.split('/').pop()! : '',
                    featurePath: s.featurePath || '',
                    planName: plan.name,
                    cycleName: cycle.name,
                    cycleId: cycle.id,
                    setName: set.name,
                    setId: set.id,
                    flowName: s.sourceType === 'flow' ? s.sourceName : `${s.sourceName || set.name} (${capitalizedCase} ${idx + 1})`,
                    flowId: s.sourceType === 'flow' ? s.flowId : undefined,
                    parentGroupId: `set-${cRef.id}-${ref.id}`,
                    parentGroupName: set.name,
                    groupId,
                    groupName,
                    isSetCombo: true,
                    sourceType: s.sourceType,
                    sourceName: s.sourceName,
                    tasks: scenarioTasks,
                    featureRefId: s.sourceType === 'feature' ? s.featureRefId : undefined,
                    featureScenarios: s.sourceType === 'feature' ? s.featureScenarios : undefined,
                    scenarioRefId: s.id,
                  });
                });
              });
            }
          }
        }
      }
    }
    return { flatScenarios: flat, plan };
  }, [blueprints, selectedPlanId, t]);

  const scenarioIds = useMemo(
    () => flatScenarios.map(s => s.id),
    [flatScenarios],
  );
  const scenarioNames = useMemo(
    () => flatScenarios.map(s => s.scenarioName),
    [flatScenarios],
  );

  // Always pass taskId (never null-ify on finish) so states are preserved after execution
  const { statusMap, taskStatusMap } = useExecutionScenarioStatus(taskId, scenarioIds, scenarioNames);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // State for the Task Association Dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [dialogNodeName, setDialogNodeName] = useState('');
  const [dialogNodeType, setDialogNodeType] = useState('');
  const [dialogInitialTasks, setDialogInitialTasks] = useState<PlanTask[]>([]);
  const [dialogScenarios, setDialogScenarios] = useState<string[]>([]);
  const [dialogTargetId, setDialogTargetId] = useState('');
  const [dialogLevel, setDialogLevel] = useState<'scenario' | 'flow' | 'set' | 'cycle'>('scenario');
  const [dialogCycleId, setDialogCycleId] = useState<string | undefined>(undefined);
  const [dialogBlueprintId, setDialogBlueprintId] = useState<string | undefined>(undefined);
  const [dialogInitialScope, setDialogInitialScope] = useState<'instance' | 'all'>('instance');

  const handleOpenTaskDialog = (
    level: 'scenario' | 'flow' | 'set' | 'cycle',
    targetId: string,
    nodeName: string,
    nodeType: string,
    scenarios?: string[],
    cycleId?: string,
    blueprintId?: string
  ) => {
    let initialTasks: PlanTask[] = [];
    let initialScope: 'instance' | 'all' = 'instance';

    if (level === 'cycle') {
      initialTasks = blueprints.cycles.find(c => c.id === targetId)?.tasks || [];
    } else if (level === 'set') {
      initialTasks = blueprints.sets.find(s => s.id === targetId)?.tasks || [];
    } else if (level === 'flow') {
      initialTasks = blueprints.flows.find(f => f.id === targetId)?.tasks || [];
    } else if (level === 'scenario') {
      // 1. Check if there are cycle-level tasks targeting this unique instance ID
      const cycle = blueprints.cycles.find(c => c.id === cycleId);
      const cycleTasks = cycle?.tasks || [];
      const instanceTasks = cycleTasks.filter(t => t.targetScenario === targetId);

      if (instanceTasks.length > 0) {
        initialTasks = instanceTasks.filter(t => t.name !== '__none__');
        initialScope = 'instance';
      } else {
        // 2. Fallback to scenario blueprint level tasks
        let found = false;
        if (blueprintId) {
          for (const flow of blueprints.flows) {
            const item = flow.items.find(i => i.id === blueprintId);
            if (item) {
              initialTasks = item.tasks || [];
              found = true;
              break;
            }
          }
          if (!found) {
            for (const set of blueprints.sets) {
              const item = set.items.find(i => i.id === blueprintId);
              if (item) {
                initialTasks = item.tasks || [];
                found = true;
                break;
              }
            }
          }
          if (!found) {
            for (const cycleBp of blueprints.cycles) {
              const item = cycleBp.items.find(i => i.id === blueprintId);
              if (item) {
                initialTasks = item.tasks || [];
                found = true;
                break;
              }
            }
          }
          if (!found) {
            for (const p of blueprints.plans) {
              const item = p.items.find(i => i.id === blueprintId);
              if (item) {
                initialTasks = item.tasks || [];
                found = true;
                break;
              }
            }
          }
        }
        initialScope = 'all';
      }
    }

    setDialogLevel(level);
    setDialogTargetId(targetId);
    setDialogNodeName(nodeName);
    setDialogNodeType(nodeType);
    setDialogInitialTasks(initialTasks);
    setDialogScenarios(scenarios || []);
    setDialogCycleId(cycleId);
    setDialogBlueprintId(blueprintId);
    setDialogInitialScope(initialScope);
    setTaskDialogOpen(true);
  };

  const handleSaveTasks = (updatedTasks: PlanTask[], applyToAll?: boolean) => {
    if (onUpdateTasksAtLevel) {
      onUpdateTasksAtLevel(
        dialogLevel,
        dialogTargetId,
        updatedTasks,
        applyToAll,
        dialogCycleId,
        dialogBlueprintId
      );
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── Counters ───────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { pending: 0, running: 0, passed: 0, failed: 0, skipped: 0 };
    statusMap.forEach(s => { c[s] = (c[s] ?? 0) + 1; });
    // If not executing, all are pending
    if (!isExecuting && !taskId) {
      c.pending = flatScenarios.length;
    }
    return c;
  }, [statusMap, flatScenarios.length, isExecuting, taskId]);

  const totalScenarios = flatScenarios.length;

  // ── Instance index map ──────────────────────────────────────────────────────
  // For each scenario row, record its ordinal position among rows sharing the
  // same scenarioName. Used to show "(#2)", "(#3)" badges for duplicate entries.
  const instanceIndexMap = useMemo(() => {
    const counter: Record<string, number> = {};
    const map = new Map<string, number>();   // key: FlatScenario.id → instance index
    for (const fs of flatScenarios) {
      counter[fs.scenarioName] = (counter[fs.scenarioName] ?? 0) + 1;
      map.set(fs.id, counter[fs.scenarioName]);
    }
    return map;
  }, [flatScenarios]);

  // Pre-compute which names appear more than once (to avoid rendering the badge
  // on unique scenarios where it would just add visual noise).
  const duplicateNames = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const fs of flatScenarios) counts[fs.scenarioName] = (counts[fs.scenarioName] ?? 0) + 1;
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n));
  }, [flatScenarios]);

  // ── Empty state (or generating-report-only state) ─────────────────────────
  if (totalScenarios === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Show generating indicator even when there are no scenario rows */}
        {isGeneratingReport ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              m: 2,
              px: 2,
              py: 1.25,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'rgba(129,140,248,0.35)',
              bgcolor: 'rgba(129,140,248,0.07)',
              animation: 'reportPulse 1.8s ease-in-out infinite',
              '@keyframes reportPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.55 },
              },
            }}
          >
            <CircularProgress size={13} thickness={4.5} sx={{ color: '#818cf8', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#818cf8' }}>
              Generando reporte Allure...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
              {selectedPlanId
                ? 'Este plan no tiene scenarios configurados.'
                : 'Selecciona un plan para ver sus scenarios.'}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Summary chips ───────────────────────────────────────────────────── */}
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mr: 0.5, display: 'flex', alignItems: 'center' }}>
          {plan ? `${plan.name} • ` : ''}{totalScenarios} total
        </Typography>
        <SummaryChip count={counts.running} status="running" />
        <SummaryChip count={counts.passed} status="passed" />
        <SummaryChip count={counts.failed} status="failed" />
        <SummaryChip count={counts.skipped} status="skipped" />
        <SummaryChip count={counts.pending} status="pending" />
      </Box>

      {/* ── Scenario rows (Table) ────────────────────────────────────────────────────── */}
      <TableContainer component={Box} sx={{ flex: 1, overflow: 'auto', mb: '5px' }}>
        <Table 
          stickyHeader 
          size="small" 
          sx={{ 
            tableLayout: 'fixed', 
            width: '100%', 
            '& .MuiTableCell-root': { fontSize: '0.75rem', fontFamily: 'inherit', borderColor: 'divider', py: 0.8 },
            '& .MuiTableBody-root .MuiTableCell-root': { backgroundColor: 'inherit' }
          }}
        >
          <TableHead>
            <TableRow>
              {/* Test Cycle */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.cycle,
                  minWidth: colWidths.cycle,
                  maxWidth: colWidths.cycle,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <CycleIcon size={14} color={theme.palette.text.secondary} />
                  <Tooltip title="Test Cycle" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Test Cycle</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('cycle', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Test Set */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.set,
                  minWidth: colWidths.set,
                  maxWidth: colWidths.set,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <LibraryBooksRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Tooltip title="Test Set" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Test Set</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('set', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Test Flow */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.flow,
                  minWidth: colWidths.flow,
                  maxWidth: colWidths.flow,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <FlowIcon size={14} color={theme.palette.text.secondary} />
                  <Tooltip title="Test Flow" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Test Flow</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('flow', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Scenario */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: isDark ? alpha(theme.palette.primary.main, 0.16) : alpha(theme.palette.primary.main, 0.08), // Highlight column header
                  position: 'relative',
                  width: colWidths.scenario,
                  minWidth: colWidths.scenario,
                  maxWidth: colWidths.scenario,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <ScenarioIcon size={14} color={theme.palette.text.secondary} />
                  <Tooltip title="Scenario" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>Scenario</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('scenario', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Feature */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.feature,
                  minWidth: colWidths.feature,
                  maxWidth: colWidths.feature,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <FeatureIcon size={14} color={theme.palette.text.secondary} />
                  <Tooltip title="Feature" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Feature</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('feature', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Tareas */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.tareas,
                  minWidth: colWidths.tareas,
                  maxWidth: colWidths.tareas,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  pr: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                  <AssignmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Tooltip title="Tareas" placement="top" arrow enterDelay={200}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tareas</span>
                  </Tooltip>
                </Box>
                <Box
                  onMouseDown={(e) => startResize('tareas', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>

              {/* Resultado */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: headerBg,
                  position: 'relative',
                  width: colWidths.resultado,
                  minWidth: colWidths.resultado,
                  maxWidth: colWidths.resultado,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                <Tooltip title="Resultado" placement="top" arrow enterDelay={200}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Resultado</span>
                </Tooltip>
                <Box
                  onMouseDown={(e) => startResize('resultado', e)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 10,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', borderRightWidth: '2px' },
                    '&:active': { borderColor: 'primary.main', borderRightWidth: '2px' }
                  }}
                />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(() => {
              let currentSetId: string | null = null;
              let currentGroupId: string | null = null;
              const rows: React.ReactNode[] = [];

              flatScenarios.forEach((fs, idx) => {
                const statusColors: Record<string, string> = {
                  running: theme.palette.warning.main,
                  passed: theme.palette.success.main,
                  failed: theme.palette.error.main,
                  skipped: theme.palette.text.disabled,
                  pending: theme.palette.text.disabled,
                };

                const isFirstOfSet = fs.parentGroupId && fs.parentGroupId !== currentSetId;
                if (isFirstOfSet) {
                  currentSetId = fs.parentGroupId ?? null;
                } else if (!fs.parentGroupId && currentSetId !== null) {
                  currentSetId = null;
                }

                const isSetCollapsed = fs.parentGroupId ? collapsedGroups.has(fs.parentGroupId) : false;

                // If set is collapsed, and this is NOT the first matrix, SKIP it completely
                if (isSetCollapsed && !isFirstOfSet) {
                  currentGroupId = fs.groupId; // keep it in sync
                  return;
                }

                // Render Matrix / Flow Group Header
                if (fs.groupId !== currentGroupId) {
                  currentGroupId = fs.groupId;
                  const isCollapsed = collapsedGroups.has(fs.groupId);

                  const groupScenarios = (isSetCollapsed && fs.parentGroupId)
                    ? flatScenarios.filter(s => s.parentGroupId === fs.parentGroupId)
                    : flatScenarios.filter(s => s.groupId === fs.groupId);
                  const groupStatuses = groupScenarios.map(s => statusMap.get(s.id) ?? 'pending');
                  let groupStatus = 'pending';
                  if (groupStatuses.some(s => s === 'running')) groupStatus = 'running';
                  else if (groupStatuses.some(s => s === 'failed')) groupStatus = 'failed';
                  else if (groupStatuses.every(s => s === 'skipped')) groupStatus = 'skipped';
                  else if (groupStatuses.every(s => s === 'passed' || s === 'skipped')) groupStatus = 'passed';

                  const statusColor = statusColors[groupStatus];
                  const totalGroupTasks = groupScenarios.reduce((sum: number, s: FlatScenario) => sum + (s.tasks?.length || 0), 0);

                  // Define beautiful hierarchial backgrounds based on grouping type
                  const isSetGroup = !!fs.parentGroupId;
                  const groupBgColor = isSetGroup
                    ? (isDark ? '#311f54' : '#eedcff')
                    : (isDark ? '#183152' : '#dbebff');

                  // Left border bar to visually anchor the group header row
                  const groupBorderLeft = isSetGroup
                    ? `4px solid ${theme.palette.secondary.main}`
                    : `4px solid ${theme.palette.primary.main}`;

                  rows.push(
                    <TableRow key={`group-${fs.groupId}`} sx={{ bgcolor: groupBgColor }}>
                      {/* Test Cycle */}
                      <TableCell
                        sx={{
                          width: colWidths.cycle,
                          minWidth: colWidths.cycle,
                          maxWidth: colWidths.cycle,
                          py: 0,
                          fontWeight: 600,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          borderLeft: groupBorderLeft,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
                          <Tooltip title={fs.parentGroupId ? (isFirstOfSet ? fs.cycleName : '') : fs.cycleName} placement="top-start" arrow enterDelay={200}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                              {fs.parentGroupId ? (isFirstOfSet ? fs.cycleName : '') : fs.cycleName}
                            </Typography>
                          </Tooltip>
                          {((fs.parentGroupId && isFirstOfSet) || !fs.parentGroupId) && fs.cycleId && (
                            <Tooltip title="Configurar Tareas de Ciclo">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenTaskDialog('cycle', fs.cycleId!, fs.cycleName, 'cycle')}
                                sx={{ p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                              >
                                <AssignmentIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      {/* Test Set */}
                      <TableCell
                        sx={{
                          width: colWidths.set,
                          minWidth: colWidths.set,
                          maxWidth: colWidths.set,
                          py: 0,
                          fontWeight: 600,
                          color: 'text.secondary',
                          overflow: 'hidden'
                        }}
                      >
                        {isFirstOfSet ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
                            <Box
                              onClick={() => toggleGroup(fs.parentGroupId!)}
                              sx={{ display: 'flex', alignItems: 'center', py: 0.8, cursor: 'pointer', userSelect: 'none', gap: 0.5, overflow: 'hidden', flex: 1 }}
                            >
                              {isSetCollapsed ? <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />}
                              <LibraryBooksRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                              <Tooltip title={fs.parentGroupName} placement="top-start" arrow enterDelay={200}>
                                <Typography sx={{ fontWeight: 400, fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {fs.parentGroupName}
                                </Typography>
                              </Tooltip>
                            </Box>
                            {fs.setId && (
                              <Tooltip title="Configurar Tareas de Suite (Set)">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenTaskDialog('set', fs.setId!, fs.parentGroupName!, 'set')}
                                  sx={{ p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                                >
                                  <AssignmentIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ) : (fs.parentGroupId ? '' : '—')}
                      </TableCell>
                      {/* Test Flow / Combo Group */}
                      <TableCell
                        sx={{
                          width: colWidths.flow,
                          minWidth: colWidths.flow,
                          maxWidth: colWidths.flow,
                          py: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {!isSetCollapsed && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
                            <Box
                              onClick={() => toggleGroup(fs.groupId)}
                              sx={{ display: 'flex', alignItems: 'center', py: 0.8, cursor: 'pointer', userSelect: 'none', gap: 0.5, overflow: 'hidden', flex: 1 }}
                            >
                              {isCollapsed ? <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />}
                              <Tooltip title={fs.groupName} placement="top-start" arrow enterDelay={200}>
                                <Typography sx={{ fontWeight: fs.isSetCombo ? 600 : 400, fontSize: '0.75rem', color: fs.isSetCombo ? theme.palette.primary.main : 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {fs.groupName}
                                </Typography>
                              </Tooltip>
                            </Box>
                            {fs.flowId && (
                              <Tooltip title="Configurar Tareas de Flujo">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenTaskDialog('flow', fs.flowId!, fs.groupName, 'flow')}
                                  sx={{ p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                                >
                                  <AssignmentIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      {/* Scenario Summary */}
                      <TableCell
                        sx={{
                          width: colWidths.scenario,
                          minWidth: colWidths.scenario,
                          maxWidth: colWidths.scenario,
                          py: 0,
                          overflow: 'hidden'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={`${groupScenarios.length} ${groupScenarios.length === 1 ? 'scenario' : 'scenarios'}`}
                            size="small"
                            sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(theme.palette.text.secondary, 0.1) }}
                          />
                        </Box>
                      </TableCell>
                      {/* Feature column (empty for group) */}
                      <TableCell
                        sx={{
                          width: colWidths.feature,
                          minWidth: colWidths.feature,
                          maxWidth: colWidths.feature,
                          py: 0,
                        }}
                      ></TableCell>
                      {/* Tareas column */}
                      <TableCell
                        sx={{
                          width: colWidths.tareas,
                          minWidth: colWidths.tareas,
                          maxWidth: colWidths.tareas,
                          py: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {totalGroupTasks > 0 && (
                          <Chip
                            label={`${totalGroupTasks} ${totalGroupTasks === 1 ? 'tarea' : 'tareas'}`}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.65rem',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 500,
                            }}
                          />
                        )}
                      </TableCell>
                      {/* Status Summary */}
                      <TableCell
                        sx={{
                          width: colWidths.resultado,
                          minWidth: colWidths.resultado,
                          maxWidth: colWidths.resultado,
                          py: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {groupStatus !== 'pending' && <Chip label={toSentenceCase(groupStatus)} size="small" sx={{ height: 18, fontSize: '0.75rem', color: statusColor, bgcolor: alpha(statusColor, 0.1), border: `1px solid ${alpha(statusColor, 0.3)}` }} />}
                      </TableCell>
                    </TableRow>
                  );
                }

                // If Matrix / Flow is collapsed OR Set is collapsed, skip rendering scenarios
                if (collapsedGroups.has(fs.groupId) || isSetCollapsed) {
                  return;
                }
                const status: ScenarioExecStatus = statusMap.get(fs.id) ?? 'pending';
                const isRunning = status === 'running';
                const isFailed = status === 'failed';
                const bg = isRunning
                  ? alpha(theme.palette.warning.main, isDark ? 0.08 : 0.05)
                  : isFailed
                    ? alpha(theme.palette.error.main, isDark ? 0.07 : 0.04)
                    : 'transparent';

                // Establish the row background and hover colors based on the hierarchical level of the scenario
                const isSetGroup = !!fs.parentGroupId;
                const rowBg = bg !== 'transparent'
                  ? bg
                  : (isSetGroup
                    ? (isDark ? '#22163b' : '#f7edff')
                    : (isDark ? '#112239' : '#eef6ff')
                  );

                const rowHoverBg = bg !== 'transparent'
                  ? bg
                  : (isSetGroup
                    ? (isDark ? '#311f54' : '#eedcff')
                    : (isDark ? '#183152' : '#dbebff')
                  );

                // Highlighting the scenario column by giving it a sutil primary (blue) or secondary (purple) background tint based on grouping
                const scenarioColBg = bg !== 'transparent'
                  ? bg
                  : (isSetGroup
                    ? (isDark ? '#3d2569' : '#e5cbff')
                    : (isDark ? '#1f3e6a' : '#cce3ff')
                  );

                rows.push(
                  <TableRow
                    key={`${fs.id}-${idx}`}
                    sx={{
                      bgcolor: rowBg,
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: rowHoverBg },
                    }}
                  >
                    {/* Tree guides: Cycle, Set and Flow to create a gorgeous visual hierarchy */}
                    <TableCell
                      sx={{
                        width: colWidths.cycle,
                        minWidth: colWidths.cycle,
                        maxWidth: colWidths.cycle,
                        borderLeft: `3px solid ${isRunning ? theme.palette.warning.main : isFailed ? theme.palette.error.main : alpha(theme.palette.text.disabled, 0.15)}`,
                        overflow: 'hidden'
                      }}
                    ></TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.set,
                        minWidth: colWidths.set,
                        maxWidth: colWidths.set,
                        borderLeft: fs.parentGroupId ? (isDark ? '2px solid #5d3f8c' : '2px solid #b388ff') : 'none',
                        overflow: 'hidden'
                      }}
                    ></TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.flow,
                        minWidth: colWidths.flow,
                        maxWidth: colWidths.flow,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        borderLeft: isDark ? '2px solid #1f3e6a' : '2px solid #90caf9',
                        pl: 1.5,
                      }}
                    >
                      <Tooltip title={fs.sourceName} placement="top-start" arrow enterDelay={200}>
                        <Box component="span" sx={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {fs.sourceName}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.scenario,
                        minWidth: colWidths.scenario,
                        maxWidth: colWidths.scenario,
                        overflow: 'hidden',
                        bgcolor: scenarioColBg, // Resaltar columna
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
                        <StatusBadge status={status} />
                        <Tooltip title={fs.scenarioName} placement="top-start" arrow enterDelay={200}>
                          <Typography
                            sx={{
                              fontSize: '0.75rem', // Same size as others (0.75rem)
                              fontWeight: isRunning ? 700 : 600, // Bolder font weight to stand out
                              color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : 'text.primary',
                              whiteSpace: 'nowrap', // No word wrap
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                            }}
                          >
                            {fs.scenarioName}
                          </Typography>
                        </Tooltip>
                        <Tooltip title={fs.sourceType === 'feature' ? "Configurar Tareas de Feature (Suite)" : "Configurar Tareas de Escenario"}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenTaskDialog(
                              'scenario',
                              fs.id,
                              fs.sourceType === 'feature' ? fs.sourceName : fs.scenarioName,
                              fs.sourceType === 'feature' ? 'feature' : 'scenario',
                              fs.featureScenarios,
                              fs.cycleId,
                              fs.sourceType === 'feature' ? fs.featureRefId! : fs.scenarioRefId || fs.id
                            )}
                            sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                          >
                            <AssignmentIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.feature,
                        minWidth: colWidths.feature,
                        maxWidth: colWidths.feature,
                        color: 'text.secondary',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        fontSize: '0.65rem', // Smaller by 1 (0.65rem)
                      }}
                    >
                      <Tooltip title={fs.featurePath} placement="top-start" arrow enterDelay={200}>
                        <Box
                          component="span"
                          sx={{
                            cursor: 'help',
                            lineHeight: 1.2,
                            display: 'block',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            fontSize: '0.65rem',
                          }}
                        >
                          {fs.featureName}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.tareas,
                        minWidth: colWidths.tareas,
                        maxWidth: colWidths.tareas,
                        overflow: 'hidden'
                      }}
                    >
                      {/* Rendering of associated tasks */}
                      {fs.tasks && fs.tasks.length > 0 ? (
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Tareas asociadas:</Typography>
                              {fs.tasks.map(t => (
                                <Box key={t.id} sx={{ mb: 0.5, borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 0.5 }}>
                                  <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                                    @{t.name} ({t.hook.toUpperCase()})
                                  </Typography>
                                  {t.args && Object.keys(t.args).length > 0 && (
                                    <Typography variant="caption" display="block">
                                      Parámetros: {JSON.stringify(t.args)}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          }
                          arrow
                          placement="top"
                          enterDelay={300}
                        >
                          <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 0.5, overflow: 'hidden' }}>
                            {fs.tasks.map((task) => {
                              const taskKey = `${fs.id}::${task.id}`;
                              const taskStatus = taskStatusMap.get(taskKey) || 'pending';
                              return (
                                <Chip
                                  key={task.id}
                                  size="small"
                                  icon={<AssignmentIcon sx={{ fontSize: '10px !important' }} />}
                                  label={`@${task.name}`}
                                  sx={{
                                    height: 18,
                                    fontSize: '0.65rem', // Smaller by 1 (0.65rem)
                                    fontWeight: 400,
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    ...getTaskChipStyles(taskStatus, theme)
                                  }}
                                />
                              );
                            })}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontStyle: 'italic' }}>
                          Sin tareas
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        width: colWidths.resultado,
                        minWidth: colWidths.resultado,
                        maxWidth: colWidths.resultado,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem', // Same size as others (0.75rem)
                          fontWeight: 700,
                          color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : status === 'skipped' ? 'text.disabled' : 'text.disabled',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {toSentenceCase(status)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              });

              return rows;
            })()}

            {/* ── Allure report generation row ──────────────────────────────── */}
            {isGeneratingReport && (
              <TableRow
                sx={{
                  bgcolor: alpha('#818cf8', isDark ? 0.08 : 0.04),
                  animation: 'reportPulse 1.8s ease-in-out infinite',
                  '@keyframes reportPulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.55 },
                  },
                }}
              >
                {/* Left border accent */}
                <TableCell
                  colSpan={2}
                  sx={{
                    borderLeft: '2px solid #818cf8',
                    color: 'text.disabled',
                    fontSize: '0.7rem',
                    whiteSpace: 'nowrap',
                    fontStyle: 'italic',
                  }}
                >
                  — Sistema —
                </TableCell>
                <TableCell colSpan={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress
                      size={11}
                      thickness={4.5}
                      sx={{ color: '#818cf8', flexShrink: 0 }}
                    />
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#818cf8',
                        letterSpacing: 0.2,
                      }}
                    >
                      Generando reporte Allure...
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#818cf8',
                    }}
                  >
                    Building
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {onUpdateTasksAtLevel && (
        <TaskAssociationDialog
          open={taskDialogOpen}
          onClose={() => setTaskDialogOpen(false)}
          nodeName={dialogNodeName}
          initialTasks={dialogInitialTasks}
          onSave={handleSaveTasks}
          nodeType={dialogNodeType}
          scenarios={dialogScenarios}
          initialScope={dialogInitialScope}
        />
      )}
    </Box>
  );
};

export default ExecutionMonitor;
