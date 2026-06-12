import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem,
  TextField, FormControl, InputLabel, List, ListItem, ListItemText, IconButton,
  Box, Typography, Divider, Paper, Stack, Grid, Tooltip, FormHelperText, Alert,
  useTheme, alpha, Radio, RadioGroup, FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { PlanTask } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface TaskDef {
  name: string;
  class_name: string;
  module: string;
  scope: string;
  doc: string;
  args_schema?: Array<{
    name: string;
    label: string;
    type: string;
    default?: any;
  }>;
}

interface TaskAssociationDialogProps {
  open: boolean;
  onClose: () => void;
  nodeName: string;
  initialTasks: PlanTask[];
  onSave: (updatedTasks: PlanTask[], applyToAll?: boolean) => void;
  nodeType?: string;
  scenarios?: string[];
  initialScope?: 'instance' | 'all';
}

export const TaskAssociationDialog: React.FC<TaskAssociationDialogProps> = ({
  open,
  onClose,
  nodeName,
  initialTasks,
  onSave,
  nodeType,
  scenarios = [],
  initialScope
}) => {
  const theme = useTheme();
  
  const getNodeTypeLabel = () => {
    switch (nodeType) {
      case 'cycle': return 'Ciclo';
      case 'set': return 'Set';
      case 'flow': return 'Flujo';
      case 'feature': return 'Escenario elegido';
      case 'scenario': return 'Escenario elegido';
      default: return 'Escenario elegido';
    }
  };
  const [availableTasks, setAvailableTasks] = useState<TaskDef[]>([]);
  const [associatedTasks, setAssociatedTasks] = useState<PlanTask[]>([]);
  const [selectedTaskName, setSelectedTaskName] = useState<string>('');
  
  // Form states for adding/editing a task
  const [currentHook, setCurrentHook] = useState<'before' | 'after'>('before');
  const [currentScope, setCurrentScope] = useState<'scenario' | 'step'>('scenario');
  const [currentArgs, setCurrentArgs] = useState<Record<string, any>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [currentTargetScenario, setCurrentTargetScenario] = useState<string>('all');
  const [applyScope, setApplyScope] = useState<'instance' | 'all'>('instance');

  // Animation states
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [animationType, setAnimationType] = useState<'add' | 'edit' | null>(null);

  const targetScenarioVal = currentTargetScenario === 'all' ? undefined : currentTargetScenario;
  const isDuplicate = !!(
    selectedTaskName &&
    associatedTasks.some(t => {
      if (t.id === editingTaskId) return false;
      const baseMatch = 
        t.name === selectedTaskName &&
        t.hook === currentHook &&
        t.scope === currentScope;
      if (!baseMatch) return false;
      if (nodeType === 'feature') {
        const tTarget = t.targetScenario || undefined;
        const currentTarget = targetScenarioVal || undefined;
        return tTarget === currentTarget;
      }
      return true;
    })
  );

  // Fetch available tasks on mount
  useEffect(() => {
    if (open) {
      fetch('/api/tasks')
        .then(res => res.ok ? res.json() : { tasks: [] })
        .then(data => {
          setAvailableTasks(data.tasks || []);
        })
        .catch(err => console.error("Error fetching tasks:", err));
      
      setAssociatedTasks(initialTasks ? [...initialTasks] : []);
      resetForm();
      setAnimatingTaskId(null);
      setAnimationType(null);
      setApplyScope(initialScope || 'instance');
    }
  }, [open, initialTasks, initialScope]);

  const resetForm = () => {
    setSelectedTaskName('');
    setCurrentHook('before');
    setCurrentScope('scenario');
    setCurrentArgs({});
    setEditingTaskId(null);
    setCurrentTargetScenario('all');
  };

  const handleTaskSelection = (taskName: string) => {
    setSelectedTaskName(taskName);
    const taskDef = availableTasks.find(t => t.name === taskName);
    
    // Pre-populate arguments with schema defaults
    const defaultArgs: Record<string, any> = {};
    if (taskDef?.args_schema) {
      taskDef.args_schema.forEach(arg => {
        defaultArgs[arg.name] = arg.default !== undefined ? arg.default : '';
      });
    }
    setCurrentArgs(defaultArgs);
  };

  const handleArgChange = (name: string, value: any) => {
    setCurrentArgs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddOrUpdateTask = () => {
    if (!selectedTaskName || isDuplicate) return;

    let targetId = '';
    let isEdit = false;

    if (editingTaskId) {
      // Update existing task
      targetId = editingTaskId;
      isEdit = true;
      setAssociatedTasks(prev => prev.map(t => 
        t.id === editingTaskId 
          ? { ...t, name: selectedTaskName, hook: currentHook, scope: currentScope, args: { ...currentArgs }, targetScenario: targetScenarioVal }
          : t
      ));
    } else {
      // Add new task
      const newId = uuidv4();
      targetId = newId;
      isEdit = false;
      const newTask: PlanTask = {
        id: newId,
        name: selectedTaskName,
        hook: currentHook,
        scope: currentScope,
        args: { ...currentArgs },
        targetScenario: targetScenarioVal
      };
      setAssociatedTasks(prev => [...prev, newTask]);
    }

    // Trigger animation
    setAnimatingTaskId(targetId);
    setAnimationType(isEdit ? 'edit' : 'add');

    // Clean up animation state after 2000ms
    setTimeout(() => {
      setAnimatingTaskId(null);
      setAnimationType(null);
    }, 2000);

    resetForm();
  };

  const handleEditClick = (task: PlanTask) => {
    setEditingTaskId(task.id);
    setSelectedTaskName(task.name);
    setCurrentHook(task.hook);
    setCurrentScope(task.scope);
    setCurrentArgs(task.args || {});
    setCurrentTargetScenario(task.targetScenario || 'all');
  };

  const handleDeleteTask = (taskId: string) => {
    setAssociatedTasks(prev => prev.filter(t => t.id !== taskId));
    if (editingTaskId === taskId) {
      resetForm();
    }
  };

  const handleSaveClick = () => {
    onSave(associatedTasks, applyScope === 'all');
    onClose();
  };

  const selectedTaskDef = availableTasks.find(t => t.name === selectedTaskName);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          backgroundColor: theme.palette.mode === 'dark' ? '#1E293B' : '#FFFFFF',
          backgroundImage: 'none',
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
        }
      }}
    >
      <style>{`
        @keyframes slideFromRight {
          0% {
            transform: translateX(120%);
            opacity: 0;
            background-color: rgba(16, 185, 129, 0.35);
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
          }
          30% {
            transform: translateX(-10px);
            opacity: 1;
            background-color: rgba(16, 185, 129, 0.2);
          }
          60% {
            transform: translateX(4px);
            background-color: rgba(16, 185, 129, 0.1);
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulseUpdate {
          0% {
            transform: scale(1);
            background-color: rgba(25, 118, 210, 0.35);
            box-shadow: 0 0 12px rgba(25, 118, 210, 0.5);
          }
          50% {
            transform: scale(1.04);
            background-color: rgba(25, 118, 210, 0.15);
            box-shadow: 0 0 8px rgba(25, 118, 210, 0.3);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2.25,
            borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          }}
        >
              <AssignmentIcon fontSize="small" />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '1.05rem', flexGrow: 1 }}>
            Configurar Tareas de Ejecución
          </Typography>
          <Typography
            variant="caption"
            sx={{
              bgcolor: 'primary.main',
              px: 2,
              py: 0.75,
              borderRadius: '20px',
              color: '#FFFFFF',
              fontWeight: 700,
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
              fontSize: '0.825rem',
              letterSpacing: 0.5,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {getNodeTypeLabel()}: {nodeName}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 1.5,
          borderColor: alpha(theme.palette.divider, 0.5),
          bgcolor: theme.palette.mode === 'dark' ? '#0F172A' : '#F8FAFC'
        }}
        dividers
      >
        <Grid container spacing={1} alignItems="stretch">
          {/* Left panel: Associated tasks list (Separate Section) */}
          <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex' }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: '12px',
                width: '100%',
                bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#FFFFFF',
                borderColor: alpha(theme.palette.divider, 0.6),
                display: 'flex',
                flexDirection: 'column',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Tareas Configuradas ({associatedTasks.length})
              </Typography>
              {associatedTasks.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.action.hover, 0.5), borderRadius: '10px', border: '1px dashed', borderColor: alpha(theme.palette.divider, 0.8), flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.disabled">
                    No hay tareas asociadas a este {nodeType === 'cycle' ? 'ciclo' : nodeType === 'set' ? 'set' : nodeType === 'flow' ? 'flujo' : 'escenario'}.
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ maxHeight: 420, overflow: 'auto', pr: 0.5, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
                  {associatedTasks.map((task) => {
                    const isNew = !initialTasks.some(it => it.id === task.id);
                    return (
                      <Paper
                        variant="outlined"
                        key={task.id}
                        sx={{
                          mb: 1.25,
                          p: 1.25,
                          borderRadius: '8px',
                          borderColor: editingTaskId === task.id 
                            ? theme.palette.primary.main 
                            : isNew 
                              ? alpha('#10b981', 0.45) 
                              : alpha(theme.palette.divider, 0.8),
                          bgcolor: editingTaskId === task.id 
                            ? alpha(theme.palette.primary.main, 0.04) 
                            : isNew 
                              ? alpha('#10b981', 0.08) 
                              : 'background.paper',
                          boxShadow: editingTaskId === task.id ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}` : 'none',
                          transition: 'all 0.2s ease',
                          animation: animatingTaskId === task.id
                            ? (animationType === 'add' ? 'slideFromRight 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'pulseUpdate 1.6s ease-out forwards')
                            : 'none',
                          '&:hover': {
                            borderColor: editingTaskId === task.id 
                              ? theme.palette.primary.main 
                              : isNew 
                                ? '#10b981' 
                                : theme.palette.primary.main,
                            bgcolor: editingTaskId === task.id 
                              ? alpha(theme.palette.primary.main, 0.04) 
                              : isNew 
                                ? alpha('#10b981', 0.12) 
                                : alpha(theme.palette.primary.main, 0.02),
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 1 }}>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                color: editingTaskId === task.id ? 'primary.main' : 'text.primary',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={`@${task.name}`}
                            >
                              @{task.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              Ejecución <strong>{task.hook === 'before' ? 'Before' : 'After'}</strong> <strong>{task.scope === 'scenario' ? 'Escenario' : 'Paso'}</strong>
                            </Typography>
                            {task.targetScenario && (
                              <Typography variant="caption" color="primary.main" display="block" sx={{ fontWeight: 'bold', mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.targetScenario}>
                                Filtro: Solo en "{
                                  task.targetScenario.startsWith('flow-') || task.targetScenario.startsWith('set-')
                                    ? (task.targetScenario.length > 15 ? task.targetScenario.substring(0, 15) + '...' : task.targetScenario)
                                    : task.targetScenario
                                }"
                              </Typography>
                            )}
                          </Box>
                          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, mt: -0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleEditClick(task)}
                              title="Editar"
                              sx={{
                                color: editingTaskId === task.id ? 'primary.main' : 'text.secondary',
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                              }}
                            >
                              <AssignmentIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTask(task.id)}
                              title="Eliminar"
                              sx={{
                                color: 'error.main',
                                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      </Paper>
                    );
                  })}
                </List>
              )}
 
              {/* Bottom Dialog-level Actions (Contained inside this panel) */}
              <Box sx={{ mt: 'auto', pt: 1.5 }}>
                <Divider sx={{ mb: 1.5, borderColor: alpha(theme.palette.divider, 0.5) }} />
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      color: 'text.secondary',
                      borderColor: alpha(theme.palette.divider, 0.8),
                      borderRadius: '8px',
                      '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.8), borderColor: 'text.secondary' },
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveClick}
                    variant="contained"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: '8px',
                      backgroundColor: theme.palette.primary.main,
                      color: '#fff',
                      px: 3,
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.85) },
                    }}
                    startIcon={<SaveRoundedIcon />}
                  >
                    Guardar Configuración
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
 
          {/* Right panel: Task configuration Form (Separate Section containing actions) */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex' }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: '12px',
                width: '100%',
                bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#FFFFFF',
                borderColor: alpha(theme.palette.divider, 0.6),
                display: 'flex',
                flexDirection: 'column',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {editingTaskId ? 'Editar Tarea Seleccionada' : 'Asociar Nueva Tarea'}
              </Typography>              {nodeType === 'scenario' || nodeType === 'feature' ? (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.25,
                    borderRadius: '8px',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.02) : alpha(theme.palette.common.black, 0.015),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                  }}
                >
                  <Alert
                    severity="info"
                    sx={{
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.info.main, 0.05) : alpha(theme.palette.info.main, 0.02)
                    }}
                  >
                    {applyScope === 'all' ? (
                      <>
                        <strong>Nota de Escenario Global:</strong> Esta tarea se aplicará a <strong>todos los escenarios</strong> de esta plantilla en el plan de pruebas, guardándose en la definición del blueprint original.
                      </>
                    ) : (
                      <>
                        <strong>Nota de Escenario Específico:</strong> Esta tarea se asocia a <strong>este escenario elegido ("{nodeName}")</strong> y se ejecutará únicamente en su ciclo de vida local.
                      </>
                    )}
                  </Alert>

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.75rem', color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Ámbito de Aplicación del Guardado
                    </Typography>
                    <RadioGroup
                      value={applyScope}
                      onChange={(e) => setApplyScope(e.target.value as 'instance' | 'all')}
                      sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}
                    >
                      <FormControlLabel
                        value="instance"
                        control={<Radio size="small" sx={{ p: 0.5 }} />}
                        label={
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.primary', fontWeight: applyScope === 'instance' ? 600 : 400 }}>
                            Solo para esta instancia del escenario
                          </Typography>
                        }
                        sx={{ ml: -0.75 }}
                      />
                      <FormControlLabel
                        value="all"
                        control={<Radio size="small" sx={{ p: 0.5 }} />}
                        label={
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.primary', fontWeight: applyScope === 'all' ? 600 : 400 }}>
                            Todas las instancias de este escenario en el plan
                          </Typography>
                        }
                        sx={{ ml: -0.75 }}
                      />
                    </RadioGroup>
                  </Box>
                </Box>
              ) : (
                <Alert
                  severity="info"
                  sx={{
                    mb: 2.25,
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <strong>Nota de Herencia ({nodeType === 'plans' || nodeType === 'plan' ? 'Plan' : nodeType === 'cycles' || nodeType === 'cycle' ? 'Ciclo' : nodeType === 'flows' || nodeType === 'flow' ? 'Flujo' : nodeType === 'sets' || nodeType === 'set' ? 'Test Set' : nodeType}):</strong> Esta tarea se heredará en cascada y se ejecutará para <strong>cada escenario</strong> dentro de este contenedor.
                  <br />
                  • <em>Escenario</em>: Se ejecuta antes/después de cada escenario.
                  <br />
                  • <em>Paso</em>: Se ejecuta antes/después de cada paso de todos los escenarios.
                </Alert>
              )}

              <Stack spacing={2.5} sx={{ flexGrow: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="task-select-label">Seleccionar Tarea</InputLabel>
                  <Select
                    labelId="task-select-label"
                    value={selectedTaskName}
                    label="Seleccionar Tarea"
                    onChange={(e) => handleTaskSelection(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="">
                      <em>Ninguna</em>
                    </MenuItem>
                    {availableTasks.map((t) => (
                      <MenuItem key={t.name} value={t.name}>
                        {t.class_name} (@{t.name})
                      </MenuItem>
                    ))}
                  </Select>
                  {selectedTaskDef?.doc && (
                    <FormHelperText sx={{ fontStyle: 'italic', mt: 1, color: 'text.secondary', fontSize: '0.72rem' }}>
                      {selectedTaskDef.doc}
                    </FormHelperText>
                  )}
                </FormControl>

                {selectedTaskName && (
                  <>
                    {nodeType === 'feature' && scenarios && scenarios.length > 0 && (
                      <FormControl fullWidth size="small">
                        <InputLabel id="target-scenario-select-label">Escenario Objetivo</InputLabel>
                        <Select
                          labelId="target-scenario-select-label"
                          value={currentTargetScenario}
                          label="Escenario Objetivo"
                          onChange={(e) => setCurrentTargetScenario(e.target.value)}
                          sx={{ borderRadius: '8px' }}
                        >
                          <MenuItem value="all">
                            <em>Todos los escenarios de este Feature</em>
                          </MenuItem>
                          {scenarios.map((sname) => (
                            <MenuItem key={sname} value={sname}>
                              Solo: "{sname}"
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="hook-select-label">Momento (Hook)</InputLabel>
                          <Select
                            labelId="hook-select-label"
                            value={currentHook}
                            label="Momento (Hook)"
                            onChange={(e) => setCurrentHook(e.target.value as 'before' | 'after')}
                            sx={{ borderRadius: '8px' }}
                          >
                            <MenuItem value="before">Antes (Before)</MenuItem>
                            <MenuItem value="after">Después (After)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="scope-select-label">Alcance (Scope)</InputLabel>
                          <Select
                            labelId="scope-select-label"
                            value={currentScope}
                            label="Alcance (Scope)"
                            onChange={(e) => setCurrentScope(e.target.value as 'scenario' | 'step')}
                            sx={{ borderRadius: '8px' }}
                          >
                            <MenuItem value="scenario">Escenario</MenuItem>
                            <MenuItem value="step">Paso (Step)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    {/* Dynamic arguments from schema */}
                    {selectedTaskDef?.args_schema && selectedTaskDef.args_schema.length > 0 && (
                      <Box>
                        <Divider sx={{ mb: 2, borderColor: alpha(theme.palette.divider, 0.5) }} />
                        <Typography variant="caption" display="block" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Parámetros de la Tarea
                        </Typography>
                        <Stack spacing={2}>
                          {selectedTaskDef.args_schema.map((arg) => (
                            <Box key={arg.name}>
                              {arg.type === 'textarea' ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  size="small"
                                  label={arg.label}
                                  value={currentArgs[arg.name] || ''}
                                  onChange={(e) => handleArgChange(arg.name, e.target.value)}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                                />
                              ) : (
                                <TextField
                                  fullWidth
                                  size="small"
                                  label={arg.label}
                                  value={currentArgs[arg.name] || ''}
                                  onChange={(e) => handleArgChange(arg.name, e.target.value)}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {isDuplicate && (
                      <Alert
                        severity="warning"
                        sx={{
                          mb: 1.5,
                          fontSize: '0.75rem',
                          borderRadius: '8px',
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                          backgroundColor: alpha(theme.palette.warning.main, 0.08)
                        }}
                      >
                        <strong>Asociación existente:</strong> Ya existe una tarea @{selectedTaskName} configurada para {currentHook === 'before' ? 'Antes' : 'Después'} de cada {currentScope === 'scenario' ? 'Escenario' : 'Paso'}{targetScenarioVal ? ` en el escenario "${targetScenarioVal}"` : ''}.
                      </Alert>
                    )}

                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', pt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={resetForm}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: '8px',
                          color: 'text.secondary',
                          borderColor: alpha(theme.palette.divider, 0.8),
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color={editingTaskId ? 'primary' : 'secondary'}
                        startIcon={<AddCircleOutlineIcon />}
                        disabled={isDuplicate}
                        onClick={handleAddOrUpdateTask}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: '8px',
                          px: 2,
                          py: 0.75,
                          boxShadow: `0 2px 6px ${alpha(editingTaskId ? theme.palette.primary.main : theme.palette.secondary.main, 0.2)}`,
                        }}
                      >
                        {editingTaskId ? 'Actualizar esta asociación' : 'Guardar esta asociación'}
                      </Button>
                    </Box>
                  </>
                )}
              </Stack>

            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default TaskAssociationDialog;
