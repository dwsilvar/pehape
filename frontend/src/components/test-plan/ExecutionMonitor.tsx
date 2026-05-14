import React, { useMemo } from 'react';
import {
  Box, Typography, alpha, useTheme, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon        from '@mui/icons-material/CancelRounded';
import RemoveCircleRoundedIcon  from '@mui/icons-material/RemoveCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { TestPlan } from '../../types';
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
  flowName: string;
}

interface ExecutionMonitorProps {
  plans: TestPlan[];
  selectedPlanId: string | null;
  taskId: string | null;
  isExecuting: boolean;
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
  plans, selectedPlanId, taskId, isExecuting,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ── Derive flat scenario list from the selected plan ───────────────────────
  const { flatScenarios, plan } = useMemo(() => {
    const plan = plans.find(p => p.id === selectedPlanId) ?? null;
    if (!plan) return { flatScenarios: [], plan: null };

    const flat: FlatScenario[] = [];
    for (const cycle of plan.cycles ?? []) {
      for (const flow of cycle.flows ?? []) {
        for (const s of flow.scenarios ?? []) {
          flat.push({
            id:           s.id,
            scenarioName: s.scenarioName,
            featureName:  s.featureName || s.featurePath.split('/').pop() || s.featurePath,
            featurePath:  s.featurePath,
            planName:     plan.name,
            cycleName:    cycle.name,
            flowName:     flow.name,
          });
        }
      }
    }
    return { flatScenarios: flat, plan };
  }, [plans, selectedPlanId]);

  const scenarioNames = useMemo(
    () => flatScenarios.map(s => s.scenarioName),
    [flatScenarios],
  );

  const statusMap = useExecutionScenarioStatus(isExecuting ? taskId : null, scenarioNames);

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

  // ── Empty state ────────────────────────────────────────────────────────────
  if (totalScenarios === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
          {selectedPlanId
            ? 'Este plan no tiene scenarios configurados.'
            : 'Selecciona un plan para ver sus scenarios.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Summary chips ───────────────────────────────────────────────────── */}
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mr: 0.5, display: 'flex', alignItems: 'center' }}>
          {totalScenarios} total
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
              <TableCell sx={{ width: 40, bgcolor: 'background.paper' }}></TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Test Plan</TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Test Cycle</TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Test Flow</TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Feature</TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: '100%' }}>Scenario</TableCell>
              <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>Resultado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flatScenarios.map((fs, idx) => {
              const status: ScenarioExecStatus = statusMap.get(fs.scenarioName) ?? 'pending';
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
                  <TableCell
                    align="center"
                    sx={{
                      borderLeft: `2px solid ${isRunning ? theme.palette.warning.main : isFailed ? theme.palette.error.main : 'transparent'}`,
                      p: 1
                    }}
                  >
                    <StatusBadge status={status} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.planName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.cycleName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{fs.flowName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    <Tooltip title={fs.featurePath} placement="top-start" arrow enterDelay={400}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                        <FeatureIcon size={11} color={theme.palette.text.disabled} />
                        {fs.featureName}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: isRunning ? 700 : 500,
                        color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : 'text.primary',
                      }}
                    >
                      {fs.scenarioName}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: isRunning ? 'warning.main' : isFailed ? 'error.main' : status === 'passed' ? 'success.main' : 'text.disabled',
                      }}
                    >
                      {status}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ExecutionMonitor;
