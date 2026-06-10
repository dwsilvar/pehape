import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, useTheme, alpha, FormControl, InputLabel, Select, MenuItem,
  Button, ButtonGroup, ClickAwayListener, Grow, Paper, Popper, MenuList,
  CircularProgress, Tooltip, Typography
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

import AppToolbar from '../components/AppToolbar';
import ExecutionMonitor from '../components/test-plan/ExecutionMonitor';
import ExecutionDrawer from '../components/test-plan/ExecutionDrawer';
import TestPlanScheduleDialog from '../components/test-plan/TestPlanScheduleDialog';
import { BlueprintsData, PlanTask } from '../types';

const ExecutionPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  // ── States ────────────────────────────────────────────────────────────
  const [blueprints, setBlueprints] = useState<BlueprintsData>({ plans: [], cycles: [], sets: [], flows: [] });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isBlueprintsLoading, setIsBlueprintsLoading] = useState(true);

  const [isSaved, setIsSaved] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('idle');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ── Dropdown and Schedule states ──────────────────────────────────────
  const [openScheduleMenu, setOpenScheduleMenu] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // ── Load Blueprints ───────────────────────────────────────────────────
  const fetchBlueprints = useCallback(() => {
    setIsBlueprintsLoading(true);
    fetch('/api/blueprints')
      .then(r => r.ok ? r.json() : { plans: [], cycles: [], sets: [], flows: [] })
      .then(data => {
        setBlueprints(data);
        if (data.plans && data.plans.length > 0) {
          // Keep current selection if valid, otherwise select first
          if (!selectedPlanId || !data.plans.find((p: any) => p.id === selectedPlanId)) {
            setSelectedPlanId(data.plans[0].id);
          }
        }
      })
      .catch(() => setBlueprints({ plans: [], cycles: [], sets: [], flows: [] }))
      .finally(() => setIsBlueprintsLoading(false));
  }, [selectedPlanId]);

  useEffect(() => {
    fetchBlueprints();
  }, []);

  const markDirty = useCallback(() => {
    setIsSaved(false);
    setCurrentTaskId(null);
    setExecutionStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/blueprints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprints),
      });
      setIsSaved(true);
    } catch (e) {
      console.error('Failed to save blueprints', e);
    }
  }, [blueprints]);

  // ── Execution Actions ─────────────────────────────────────────────────
  const handleExecute = useCallback(async (scheduledAt?: string) => {
    if (!selectedPlanId) return;
    setIsExecuting(true);
    setIsDrawerOpen(true);
    setCurrentTaskId(null);
    
    try {
      const url = scheduledAt
        ? `/api/execute-plan/${selectedPlanId}?scheduled_at=${encodeURIComponent(scheduledAt)}`
        : `/api/execute-plan/${selectedPlanId}`;

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCurrentTaskId(data.task_id);
        setExecutionStatus(data.status || (scheduledAt ? 'scheduled' : 'pending'));
      } else {
        setIsExecuting(false);
      }
    } catch (e) {
      setIsExecuting(false);
    }
  }, [selectedPlanId]);

  const handleStopExecution = useCallback(async () => {
    try {
      const res = await fetch('/api/stop-tests', { method: 'POST' });
      if (res.ok) {
        setExecutionStatus('stopping');
      }
    } catch (e) {
      console.error('Failed to stop execution', e);
    }
  }, []);

  const handleToggleDrawer = useCallback(() => setIsDrawerOpen(v => !v), []);
  const handleExecutionFinished = useCallback(() => setIsExecuting(false), []);

  // ── Task Management from Matrix ───────────────────────────────────────
  const handleUpdateTasksAtLevel = useCallback((
    level: 'scenario' | 'flow' | 'set' | 'cycle',
    targetId: string,
    tasks: PlanTask[],
    applyToAllScenarios?: boolean,
    cycleId?: string,
    blueprintId?: string
  ) => {
    setBlueprints(prev => {
      const next = { ...prev };
      
      if (level === 'cycle') {
        next.cycles = next.cycles.map(c => c.id === targetId ? { ...c, tasks } : c);
      } else if (level === 'set') {
        next.sets = next.sets.map(s => s.id === targetId ? { ...s, tasks } : s);
      } else if (level === 'flow') {
        next.flows = next.flows.map(f => f.id === targetId ? { ...f, tasks } : f);
      } else if (level === 'scenario') {
        if (!applyToAllScenarios) {
          // Solo esta instancia -> Guardar en el ciclo padre
          if (cycleId) {
            next.cycles = next.cycles.map(c => {
              if (c.id === cycleId) {
                // Filtrar tareas anteriores para esta misma instancia
                const baseTasks = (c.tasks || []).filter(t => t.targetScenario !== targetId);
                
                // Mapear nuevas tareas a esta instancia de escenario
                let newTasksToAppend = tasks.map(t => ({
                  ...t,
                  targetScenario: targetId
                }));

                // Si no hay tareas, agregar marcador dummy
                if (newTasksToAppend.length === 0) {
                  newTasksToAppend = [{
                    id: `dummy-override-${targetId}`,
                    name: '__none__',
                    hook: 'before',
                    scope: 'scenario',
                    targetScenario: targetId,
                    args: {}
                  }];
                }

                return {
                  ...c,
                  tasks: [...baseTasks, ...newTasksToAppend]
                };
              }
              return c;
            });
          }
        } else {
          // Todas las instancias -> Guardar en el plano/blueprint del escenario
          const shouldUpdate = (item: any) => {
            return item.id === blueprintId;
          };

          next.flows = next.flows.map(f => ({
            ...f,
            items: f.items.map(i => shouldUpdate(i) ? { ...i, tasks } : i)
          }));
          next.sets = next.sets.map(s => ({
            ...s,
            items: s.items.map(i => shouldUpdate(i) ? { ...i, tasks } : i)
          }));
          next.cycles = next.cycles.map(c => ({
            ...c,
            items: c.items.map(i => shouldUpdate(i) ? { ...i, tasks } : i)
          }));
          next.plans = next.plans.map(p => ({
            ...p,
            items: p.items.map(i => shouldUpdate(i) ? { ...i, tasks } : i)
          }));

          // Limpiar override de instancia si existiera en el ciclo
          if (cycleId) {
            next.cycles = next.cycles.map(c => {
              if (c.id === cycleId) {
                const cleanedTasks = (c.tasks || []).filter(t => t.targetScenario !== targetId);
                return { ...c, tasks: cleanedTasks };
              }
              return c;
            });
          }
        }
      }
      
      return next as BlueprintsData;
    });
    markDirty();
  }, [markDirty]);

  // ── Schedule Menu handlers ───────────────────────────────────────────
  const handleToggleScheduleMenu = () => {
    setOpenScheduleMenu(prev => !prev);
  };

  const handleCloseScheduleMenu = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setOpenScheduleMenu(false);
  };

  const handleScheduleOption = (option: string) => {
    setOpenScheduleMenu(false);
    if (option === 'instant') {
      handleExecute();
    } else if (option === 'delay_short') {
      handleExecute(new Date(Date.now() + 60000).toISOString());
    } else if (option === 'delay_medium') {
      handleExecute(new Date(Date.now() + 300000).toISOString());
    } else if (option === 'custom') {
      setScheduleDialogOpen(true);
    }
  };

  const activePlan = blueprints.plans.find(p => p.id === selectedPlanId) || null;
  const canExecute = activePlan && activePlan.items && activePlan.items.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <AppToolbar title={t('common.sidebar.execution', 'Matriz de Ejecución')} icon={<PlayCircleOutlineIcon sx={{ fontSize: 28 }} />} showControls={true}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, justifyContent: 'flex-start' }}>
          {/* Plan Selector */}
          <FormControl size="small" sx={{ minWidth: 200, mr: 1 }}>
            <InputLabel id="execution-plan-select-label">Plan de Pruebas</InputLabel>
            <Select
              labelId="execution-plan-select-label"
              value={selectedPlanId || ''}
              label="Plan de Pruebas"
              onChange={(e) => setSelectedPlanId(e.target.value as string)}
              disabled={isExecuting}
              sx={{ borderRadius: '6px', height: 36, fontSize: '0.8rem' }}
            >
              {isBlueprintsLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Cargando planes...
                </MenuItem>
              ) : blueprints.plans.length === 0 ? (
                <MenuItem disabled>No hay planes disponibles</MenuItem>
              ) : (
                blueprints.plans.map(p => (
                  <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8rem' }}>
                    {p.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Save button */}
          {!isSaved && (
            <Tooltip title="Guardar cambios de tareas en el plan">
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={handleSave}
                disabled={isExecuting}
                startIcon={<SaveRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ fontSize: '0.75rem', height: 36, textTransform: 'none', borderRadius: '6px' }}
              >
                Guardar Tareas
              </Button>
            </Tooltip>
          )}

          {/* Execute buttons */}
          {isExecuting && executionStatus !== 'scheduled' ? (
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={handleStopExecution}
              disabled={executionStatus === 'stopping'}
              startIcon={<CancelRoundedIcon />}
              sx={{ fontSize: '0.75rem', height: 36, textTransform: 'none', borderRadius: '6px' }}
            >
              {executionStatus === 'stopping' ? 'Deteniendo...' : 'Detener Pruebas'}
            </Button>
          ) : (
            <Box ref={anchorRef} sx={{ display: 'inline-flex' }}>
              <ButtonGroup
                variant="contained"
                size="small"
                disabled={!canExecute || !isSaved}
                sx={{
                  height: 36,
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.85)}, ${alpha(theme.palette.secondary.main, 0.85)})`,
                  '& .MuiButton-root': {
                    color: '#fff',
                    borderColor: alpha(theme.palette.common.white, 0.2),
                    textTransform: 'none',
                    fontSize: '0.75rem',
                  },
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  },
                  '&.Mui-disabled': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                    opacity: 0.8,
                  },
                }}
              >
                <Button
                  onClick={() => handleExecute()}
                  startIcon={
                    executionStatus === 'scheduled' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PlayArrowRoundedIcon sx={{ fontSize: 18, mr: -0.5 }} />
                        <AccessTimeIcon sx={{ fontSize: 12, mt: 1 }} />
                      </Box>
                    ) : (
                      <PlayArrowRoundedIcon />
                    )
                  }
                >
                  {executionStatus === 'scheduled' ? 'Programado' : 'Ejecutar Plan'}
                </Button>
                <Button size="small" onClick={handleToggleScheduleMenu} sx={{ px: 0.5 }}>
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>
            </Box>
          )}

          <Popper
            sx={{ zIndex: 1300 }}
            open={openScheduleMenu}
            anchorEl={anchorRef.current}
            role={undefined}
            transition
            disablePortal
          >
            {({ TransitionProps, placement }) => (
              <Grow
                {...TransitionProps}
                style={{
                  transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
                }}
              >
                <Paper sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden', boxShadow: theme.shadows[4] }}>
                  <ClickAwayListener onClickAway={handleCloseScheduleMenu}>
                    <MenuList autoFocusItem sx={{ p: 0 }}>
                      <MenuItem onClick={() => handleScheduleOption('instant')} sx={{ fontSize: '0.8rem', py: 1 }}>
                        ⚡ Ejecutar Ahora
                      </MenuItem>
                      <MenuItem onClick={() => handleScheduleOption('delay_short')} sx={{ fontSize: '0.8rem', py: 1 }}>
                        ⏱️ En 1 minuto
                      </MenuItem>
                      <MenuItem onClick={() => handleScheduleOption('delay_medium')} sx={{ fontSize: '0.8rem', py: 1 }}>
                        ⏱️ En 5 minutos
                      </MenuItem>
                      <MenuItem onClick={() => handleScheduleOption('custom')} sx={{ fontSize: '0.8rem', py: 1 }}>
                        📅 Programar Fecha/Hora...
                      </MenuItem>
                    </MenuList>
                  </ClickAwayListener>
                </Paper>
              </Grow>
            )}
          </Popper>
        </Box>
      </AppToolbar>

      {/* Main Execution Monitor */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 1 }}>
        <ExecutionMonitor
          key={selectedPlanId || 'no-plan'}
          blueprints={blueprints}
          selectedPlanId={selectedPlanId}
          taskId={currentTaskId}
          isExecuting={isExecuting}
          isGeneratingReport={isGeneratingReport}
          onUpdateTasksAtLevel={handleUpdateTasksAtLevel}
        />
      </Box>

      {/* Logs console */}
      <ExecutionDrawer
        isOpen={isDrawerOpen}
        onToggle={handleToggleDrawer}
        taskId={currentTaskId}
        onExecutionFinished={handleExecutionFinished}
        onStatusChange={setExecutionStatus}
        onReportGenerating={setIsGeneratingReport}
      />

      {/* Scheduler Dialog */}
      <TestPlanScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onConfirm={(scheduledAt) => {
          setScheduleDialogOpen(false);
          handleExecute(scheduledAt);
        }}
      />
    </Box>
  );
};

export default ExecutionPage;
