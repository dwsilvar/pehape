import React, { useMemo } from 'react';
import {
  Box, Typography, alpha, useTheme, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress,
} from '@mui/material';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon        from '@mui/icons-material/CancelRounded';
import RemoveCircleRoundedIcon  from '@mui/icons-material/RemoveCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import LibraryBooksRoundedIcon  from '@mui/icons-material/LibraryBooksRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { BlueprintsData, BlueprintRef, PlanBlueprint } from '../../types';
import { ScenarioIcon, FeatureIcon, CycleIcon, FlowIcon } from '../PehapeIcons';
import { useExecutionScenarioStatus, ScenarioExecStatus } from '../../hooks/useExecutionScenarioStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlatScenario {
  id: string;
  scenarioName: string;
  featureName: string;
  featurePath: string;
  planName: string;
  cycleName: string;
  setName: string;
  setDetail: string;
  flowName: string;
}

interface ExecutionMonitorProps {
  blueprints: BlueprintsData;
  selectedPlanId: string | null;
  taskId: string | null;
  isExecuting: boolean;
  isGeneratingReport?: boolean;
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
            '50%':       { opacity: 0.4, transform: 'scale(0.75)' },
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
    passed:  theme.palette.success.main,
    failed:  theme.palette.error.main,
    skipped: theme.palette.text.disabled,
    pending: theme.palette.text.disabled,
  };
  const labels: Record<string, string> = {
    running: '▶',
    passed:  '✓',
    failed:  '✗',
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

// ── Main component ────────────────────────────────────────────────────────────

const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  blueprints, selectedPlanId, taskId, isExecuting, isGeneratingReport = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ── Derive flat scenario list from the selected plan ───────────────────────
  const { flatScenarios, plan } = useMemo(() => {
    const plan = blueprints.plans.find(p => p.id === selectedPlanId) ?? null;
    if (!plan) return { flatScenarios: [], plan: null };

    const flat: FlatScenario[] = [];

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
              flat.push({
                id: s.id,
                scenarioName: s.scenarioName || s.name,
                featureName: s.featurePath ? s.featurePath.split('/').pop()! : '',
                featurePath: s.featurePath || '',
                planName: plan.name,
                cycleName: cycle.name,
                setName: '—',
                setDetail: '—',
                flowName: flow.name,
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
                  const enhancedItems = flow.items.map(i => ({ ...i, sourceName: flow.name, sourceType: 'flow' }));
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
                    sourceType: 'feature'
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
                combo.forEach((s, sIdx) => {
                  flat.push({
                    id: `${s.id}-${idx}-${sIdx}`,
                    scenarioName: s.scenarioName || s.name,
                    featureName: s.featurePath ? s.featurePath.split('/').pop()! : '',
                    featurePath: s.featurePath || '',
                    planName: plan.name,
                    cycleName: cycle.name,
                    setName: set.name,
                    setDetail: s.sourceName || '—',
                    flowName: s.sourceType === 'flow' ? s.sourceName : `${s.sourceName || set.name} (Matriz ${idx + 1})`,
                  });
                });
              });
            }
          }
        }
      }
    }
    return { flatScenarios: flat, plan };
  }, [blueprints, selectedPlanId]);

  const scenarioIds = useMemo(
    () => flatScenarios.map(s => s.id),
    [flatScenarios],
  );
  const scenarioNames = useMemo(
    () => flatScenarios.map(s => s.scenarioName),
    [flatScenarios],
  );

  // Always pass taskId (never null-ify on finish) so states are preserved after execution
  const statusMap = useExecutionScenarioStatus(taskId, scenarioIds, scenarioNames);

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
        <SummaryChip count={counts.passed}  status="passed" />
        <SummaryChip count={counts.failed}  status="failed" />
        <SummaryChip count={counts.skipped} status="skipped" />
        <SummaryChip count={counts.pending} status="pending" />
      </Box>

      {/* ── Scenario rows (Table) ────────────────────────────────────────────────────── */}
      <TableContainer component={Box} sx={{ flex: 1, overflowY: 'auto' }}>
        <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.75rem', fontFamily: 'inherit', borderColor: 'divider', py: 0.8 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CycleIcon size={14} color={theme.palette.text.secondary} />
                  Test Cycle
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <LibraryBooksRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  Test Set
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ViewListRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  Test Set Detail
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FlowIcon size={14} color={theme.palette.text.secondary} />
                  Test Flow
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: '50%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ScenarioIcon size={14} color={theme.palette.text.secondary} />
                  Scenario
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: '30%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FeatureIcon size={14} color={theme.palette.text.secondary} />
                  Feature
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Resultado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flatScenarios.map((fs, idx) => {
              // Use scenario ID as map key for precise matching
              const status: ScenarioExecStatus = statusMap.get(fs.id) ?? 'pending';
              const isRunning = status === 'running';
              const isFailed  = status === 'failed';
              const bg = isRunning
                ? alpha(theme.palette.warning.main, isDark ? 0.08 : 0.05)
                : isFailed
                  ? alpha(theme.palette.error.main, isDark ? 0.07 : 0.04)
                  : 'transparent';

              return (
                <TableRow
                  key={`${fs.id}-${idx}`}
                  sx={{
                    bgcolor: bg,
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: isRunning || isFailed ? bg : alpha(theme.palette.action.hover, 0.5) },
                  }}
                >
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', borderLeft: `2px solid ${isRunning ? theme.palette.warning.main : isFailed ? theme.palette.error.main : 'transparent'}` }}>{fs.cycleName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.setName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.setDetail}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.flowName}</TableCell>
                  <TableCell sx={{ width: '50%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusBadge status={status} />
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: isRunning ? 700 : 500,
                          color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : 'text.primary',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}
                      >
                        {fs.scenarioName}
                      </Typography>
                      {/* Instance badge — only shown when this name appears > 1 time */}
                      {duplicateNames.has(fs.scenarioName) && (
                        <Box
                          component="span"
                          sx={{
                            flexShrink: 0,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            letterSpacing: 0.3,
                            px: 0.6,
                            py: 0.15,
                            borderRadius: '4px',
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: 'primary.main',
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                            lineHeight: 1.5,
                            userSelect: 'none',
                          }}
                        >
                          #{instanceIndexMap.get(fs.id) ?? 1}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', width: '30%', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <Tooltip title={fs.featurePath} placement="top-start" arrow enterDelay={400}>
                      <Box component="span" sx={{ cursor: 'help', lineHeight: 1.2 }}>
                        {fs.featureName}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : status === 'skipped' ? 'text.disabled' : 'text.disabled',
                      }}
                    >
                      {status}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}

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
                <TableCell colSpan={2}>
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
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: '#818cf8',
                    }}
                  >
                    building
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ExecutionMonitor;
