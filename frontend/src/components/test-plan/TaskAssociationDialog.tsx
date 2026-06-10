import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem,
  TextField, FormControl, InputLabel, List, ListItem, ListItemText, IconButton,
  Box, Typography, Divider, Paper, Stack, Grid, Tooltip, FormHelperText, Alert,
  useTheme, alpha, Radio, RadioGroup, FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
    if (!selectedTaskName) return;

    const targetScenarioVal = currentTargetScenario === 'all' ? undefined : currentTargetScenario;

    if (editingTaskId) {
      // Update existing task
      setAssociatedTasks(prev => prev.map(t => 
        t.id === editingTaskId 
          ? { ...t, name: selectedTaskName, hook: currentHook, scope: currentScope, args: { ...currentArgs }, targetScenario: targetScenarioVal }
          : t
      ));
    } else {
      // Add new task
      const newTask: PlanTask = {
        id: uuidv4(),
        name: selectedTaskName,
        hook: currentHook,
        scope: currentScope,
        args: { ...currentArgs },
        targetScenario: targetScenarioVal
      };
      setAssociatedTasks(prev => [...prev, newTask]);
    }
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
          <SettingsIcon sx={{ color: theme.palette.primary.main, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '1.05rem', flexGrow: 1 }}>
            Configurar Tareas de Ejecución
          </Typography>
          <Typography
            variant="caption"
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              color: theme.palette.primary.main,
              fontWeight: 700,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              fontSize: '0.7rem',
              letterSpacing: 0.5
            }}
          >
            Nodo: {nodeName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, borderColor: alpha(theme.palette.divider, 0.5) }} dividers>
        <Grid container spacing={3}>
          {/* Left panel: Associated tasks list */}
          <Grid size={{ xs: 12, md: 5 }} sx={{ borderRight: { md: 1 }, borderColor: alpha(theme.palette.divider, 0.5) }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Tareas Configuradas ({associatedTasks.length})
            </Typography>
            {associatedTasks.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.action.hover, 0.5), borderRadius: '10px', border: '1px dashed', borderColor: alpha(theme.palette.divider, 0.8) }}>
                <Typography variant="body2" color="text.disabled">
                  No hay tareas asociadas a este nodo.
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ maxHeight: 380, overflow: 'auto', pr: 0.5, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
                {associatedTasks.map((task) => (
                  <Paper
                    variant="outlined"
                    key={task.id}
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: '8px',
                      borderColor: editingTaskId === task.id ? theme.palette.primary.main : alpha(theme.palette.divider, 0.8),
                      bgcolor: editingTaskId === task.id ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                      boxShadow: editingTaskId === task.id ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}` : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                      }
                    }}
                  >
                    <ListItem
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleEditClick(task)}
                            title="Editar"
                            sx={{
                              color: editingTaskId === task.id ? 'primary.main' : 'text.secondary',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                            }}
                          >
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            edge="end"
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
                      }
                      disablePadding
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: 'monospace', color: editingTaskId === task.id ? 'primary.main' : 'text.primary' }}>
                              @{task.name}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              Ejecutar: <strong>{task.hook.toUpperCase()}</strong> · Alcance: <strong>{task.scope.toUpperCase()}</strong>
                            </Typography>
                            {task.targetScenario && (
                              <Typography variant="caption" color="primary.main" display="block" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                                Filtro: Solo en "{task.targetScenario}"
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            )}
          </Grid>

          {/* Right panel: Task configuration Form */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ pl: { md: 1 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {editingTaskId ? 'Editar Tarea Seleccionada' : 'Asociar Nueva Tarea'}
            </Typography>

            {nodeType && nodeType !== 'scenario' ? (
              <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.75rem', borderRadius: '8px', border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                <strong>Nota de Herencia ({nodeType === 'plans' || nodeType === 'plan' ? 'Plan' : nodeType === 'cycles' || nodeType === 'cycle' ? 'Ciclo' : nodeType === 'flows' || nodeType === 'flow' ? 'Flujo' : nodeType === 'sets' || nodeType === 'set' ? 'Test Set' : nodeType}):</strong> Esta tarea se heredará en cascada y se ejecutará para <strong>cada escenario</strong> dentro de este contenedor.
                <br />
                • <em>Escenario</em>: Se ejecuta antes/después de cada escenario.
                <br />
                • <em>Paso</em>: Se ejecuta antes/después de cada paso de todos los escenarios.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.75rem', borderRadius: '8px', border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                <strong>Nota de Instancia:</strong> Esta tarea se asocia a este escenario específico y se ejecutará únicamente en su ciclo de vida.
              </Alert>
            )}

            <Stack spacing={2.5}>
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

                  <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', pt: 1 }}>
                    {editingTaskId && (
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
                        Cancelar Edición
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      color={editingTaskId ? 'primary' : 'secondary'}
                      startIcon={<AddCircleOutlineIcon />}
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
                      {editingTaskId ? 'Guardar Cambios' : 'Agregar Tarea'}
                    </Button>
                  </Box>
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          display: 'flex',
          justifyContent: (nodeType === 'scenario' || nodeType === 'feature') ? 'space-between' : 'flex-end',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: alpha(theme.palette.background.default, 0.4)
        }}
      >
        {(nodeType === 'scenario' || nodeType === 'feature') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', mr: 1 }}>
              Asociar tareas a:
            </Typography>
            <RadioGroup
              row
              value={applyScope}
              onChange={(e) => setApplyScope(e.target.value as 'instance' | 'all')}
              sx={{ gap: 1 }}
            >
              <FormControlLabel
                value="instance"
                control={<Radio size="small" sx={{ p: 0.5 }} />}
                label={
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: applyScope === 'instance' ? 600 : 400 }}>
                    Solo esta instancia
                  </Typography>
                }
                sx={{ m: 0 }}
              />
              <FormControlLabel
                value="all"
                control={<Radio size="small" sx={{ p: 0.5 }} />}
                label={
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: applyScope === 'all' ? 600 : 400 }}>
                    Todas las instancias
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </RadioGroup>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
            startIcon={<PlayArrowIcon />}
          >
            Guardar Configuración
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TaskAssociationDialog;
