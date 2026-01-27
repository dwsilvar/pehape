import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  ToggleButton,
  Collapse,
  List,
  ListItemButton,
  DialogContentText,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  ListSubheader,
  Select,
  FormControl,
  InputLabel,
  Divider,
  ListItemIcon,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SaveIcon from '@mui/icons-material/Save';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SyncIcon from '@mui/icons-material/Sync';
import StopIcon from '@mui/icons-material/Stop';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useSortable, SortableContext, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { useDroppable, useDndContext, Active } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Module, FeatureItem, ScenarioStatusMap } from '../types';
import { useLayout } from '../context/LayoutContext';

const DEFAULT_FEATURE_COLOR = '#4db6ac';

const DEFAULT_MODULE_COLOR = '#7e57c2';

interface HookInfo {
  module_name: string;
  tags?: string[];
}

interface HookItemProps {
  hook: Module | string | HookInfo;
  onDelete: () => void;
  onNavigate: (moduleName: string) => void;
}

const HookItem: React.FC<HookItemProps> = ({ hook, onDelete, onNavigate }) => {
  const isObject = typeof hook === 'object' && hook !== null && 'module_name' in hook;
  const moduleName = isObject ? hook.module_name : hook as string;
  const moduleColor = isObject && 'color' in hook ? (hook as Module).color : null;
  const tags = isObject && 'tags' in hook ? (hook as HookInfo).tags : [];

  return (
    <Box sx={{
      mb: 1,
      mr: 1,
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: moduleColor || 'action.selected',
      borderRadius: '4px',
      overflow: 'hidden', // Para que el color de fondo no se salga de los bordes redondeados
    }}>
      <Box
        onClick={() => onNavigate(moduleName)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          px: 1,
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}>
        <Typography
          variant="body2"
          sx={{ color: moduleColor ? 'white' : 'text.primary' }}
        >
          {moduleName}
        </Typography>
        {tags && tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            {tags.map(tag => (
              <Chip
                key={tag} label={tag} size="small"
                sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.3)' }}
              />
            ))}
          </Box>
        )}
      </Box>
      <IconButton onClick={onDelete} size="small" edge="end">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

const CollapsibleSection: React.FC<{ title: string, count: number, children: React.ReactNode, onAddModule?: () => void, isOpen: boolean, onToggle: () => void }> = ({ title, count, children, onAddModule, isOpen, onToggle }) => {
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={onToggle}
          startIcon={isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ textTransform: 'none', color: 'text.primary' }}
        >
          {title} ({count})
        </Button>
        {isOpen && onAddModule && (
          <Button onClick={onAddModule} size="small" variant="outlined" sx={{ ml: 1 }}>
            Añadir Hook
          </Button>
        )}
      </Box>
      <Collapse in={isOpen}>
        {count > 0 && (
          <Box sx={{ pl: 2, pt: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
            {children}
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

interface ExecutionItemProps {
  item: FeatureItem;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  fontSize: number;
  onDoubleClick: (item: FeatureItem) => void;
  onToggleActivity: (item: FeatureItem) => void;
  onDelete: (item: FeatureItem) => void;
  onTagClick: (featureId: string, tag: string) => void;
  isRunning: boolean;
  isFirst: boolean;
  isLast: boolean;
  onAddTask: (moduleName: string, item: FeatureItem) => void;
  onDeleteTask: (moduleName: string, item: FeatureItem, taskIndex: number) => void;
  onEditTask: (moduleName: string, item: FeatureItem, task: any, index: number) => void;
  moduleName: string;
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  onMoveUp,
  onMoveDown,
  fontSize,
  onDoubleClick,
  onToggleActivity,
  onDelete,
  onTagClick,
  isRunning,
  isFirst,
  isLast,
  onAddTask,
  onDeleteTask,
  onEditTask,
  moduleName,
}) => {
  const { scenarioStatuses, taskStatuses, scenarioGifs } = useLayout();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'feature' }, // Identificamos este elemento como una 'feature'
    disabled: !item.active, // Deshabilita el arrastre si el feature está inactivo
  });

  const [contextMenu, setContextMenu] = React.useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    if (!item.active) return; // No mostrar menú contextual si está inactivo
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX + 2,
          mouseY: event.clientY - 6,
        }
        : null,
    );
  };

  const handleOpenMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
    });
  };

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleOpenInEditor = () => {
    onDoubleClick(item); // Reutiliza la lógica existente para abrir el editor
    handleClose();
  };

  const handleToggle = () => {
    onToggleActivity(item);
    handleClose();
  };

  const handleDelete = () => {
    onDelete(item);
    handleClose();
  };

  const handleAddTask = () => {
    onAddTask(moduleName, item);
    handleClose();
  };
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <Paper
        ref={setNodeRef}
        style={style}
        elevation={isDragging ? 6 : 4} // Sombra para destacar que es un elemento individual
        onDoubleClick={() => item.active && onDoubleClick(item)}
        onContextMenu={handleContextMenu}
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          opacity: isDragging ? 0.5 : (item.active ? 1 : 0.6),
          backgroundColor: item.active ? 'background.default' : 'action.disabledBackground',
          position: 'relative',
          // Estilo condicional para resaltar el feature en ejecución
          border: isRunning ? '2px solid' : 'none',
          borderColor: isRunning ? 'primary.main' : 'transparent',
          pl: '30px', // Padding izquierdo para dejar espacio al handle
          py: 1, // Padding vertical
          pr: 1, // Padding derecho
        }}
      >
        {/* Handle de arrastre a la izquierda, similar al de los módulos */}
        <Box
          {...attributes}
          {...listeners}
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '30px',
            cursor: item.active ? 'grab' : 'not-allowed',
            backgroundColor: item.color || DEFAULT_FEATURE_COLOR,
            borderTopLeftRadius: (theme) => theme.shape.borderRadius,
            borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        {/* Contenido del feature */}
        <Box sx={{ flexGrow: 1, ml: 1, cursor: item.active ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 1 }}>

          {/* SECCIÓN 1: CABECERA Y CONTROLES */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{
              fontSize: `${fontSize}px`,
              fontWeight: 'bold',
              textDecoration: item.active ? 'none' : 'line-through',
              color: item.active ? 'text.primary' : 'text.disabled'
            }}>
              {`${item.order}. ${item.feature_file}`}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Subir">
                <span>
                  <IconButton edge="end" onClick={onMoveUp} size="small" disabled={isFirst || !item.active}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Bajar">
                <span>
                  <IconButton edge="end" onClick={onMoveDown} size="small" disabled={isLast || !item.active}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={item.active ? "Desactivar feature" : "Activar feature"}>
                <IconButton onClick={() => onToggleActivity(item)} size="small" sx={{ ml: 0.5 }}>
                  {item.active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" color="disabled" />}
                </IconButton>
              </Tooltip>
              <IconButton onClick={handleOpenMenu} size="small" sx={{ ml: 0.5 }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* SECCIÓN 2: TAGS */}
          {item.display_tags && item.display_tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.display_tags.map((tag) => (
                <Chip
                  clickable={item.active}
                  key={tag}
                  label={tag}
                  icon={<LocalOfferIcon sx={{ fontSize: '10px !important' }} />}
                  size="small"
                  color={item.tags?.includes(tag) ? 'primary' : 'default'}
                  variant={item.tags?.includes(tag) && item.active ? 'filled' : 'outlined'}
                  onClick={() => item.active && onTagClick(item.id, tag)}
                  sx={{ fontSize: '0.65rem', height: '18px', borderRadius: '4px' }}
                />
              ))}
            </Box>
          )}

          {/* SECCIÓN 3: ESCENARIOS */}
          {item.scenarios && item.scenarios.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'medium', fontSize: '0.65rem' }}>
                Escenarios:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.scenarios.map((scenario) => {
                  const uniqueScenarioId = `${item.id}::${scenario}`;
                  const status = scenarioStatuses[uniqueScenarioId] || 'untested';
                  const colorMap = {
                    passed: 'success',
                    failed: 'error',
                    skipped: 'warning',
                    untested: 'default',
                    running: 'info',
                  } as const;

                  const truncatedLabel = scenario.length > 35 ? `${scenario.substring(0, 35)}...` : scenario;

                  return (
                    <Tooltip key={uniqueScenarioId} title={scenario} arrow>
                      <Chip
                        icon={status === 'running' ? <CircularProgress size={10} color="inherit" /> : undefined}
                        label={truncatedLabel}
                        size="small"
                        color={colorMap[status]}
                        variant={status === 'untested' ? 'outlined' : 'filled'}
                        sx={{ fontSize: '0.65rem', height: '20px' }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* SECCIÓN 4: TAREAS (SOLO SI EXISTEN) */}
          {item.ui_tasks && item.ui_tasks.length > 0 && (
            <Box sx={{
              mt: 0.5,
              pt: 0.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SettingsIcon sx={{ fontSize: '12px', color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', fontSize: '0.65rem' }}>
                  Tareas Asociadas:
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.ui_tasks.map((task, index) => {
                  const taskState = taskStatuses[item.id]?.[index];
                  const status = taskState?.status || 'pending';
                  const error = taskState?.error;

                  const colorMap = {
                    passed: 'success',
                    failed: 'error',
                    pending: 'default',
                    running: 'info',
                  } as const;

                  const Icon = status === 'passed' ? CheckCircleIcon : (status === 'failed' ? ErrorIcon : undefined);

                  return (
                    <Tooltip key={`${task.name}-${index}`} title={error || `${task.name} (${status})`} arrow>
                      <Chip
                        clickable
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(moduleName, item, task, index);
                        }}
                        label={`${task.name} (${task.scope}${task.scenario_name ? ':' + task.scenario_name : ''})`}
                        size="small"
                        variant={status === 'pending' ? 'outlined' : 'filled'}
                        color={colorMap[status as keyof typeof colorMap]}
                        icon={Icon ? <Icon sx={{ fontSize: '12px !important' }} /> : (status === 'running' ? <CircularProgress size={10} color="inherit" /> : undefined)}
                        onDelete={(e) => {
                          e.stopPropagation();
                          onDeleteTask(moduleName, item, index);
                        }}
                        sx={{
                          fontSize: '0.6rem',
                          height: '18px',
                          backgroundColor: status === 'pending' ? 'rgba(0,0,0,0.03)' : undefined,
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* FOOTER: EVIDENCIAS (GIFS) - MOVIDO AL MENÚ POR SOLICITUD DEL USUARIO */}
        </Box>
      </Paper>
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleOpenInEditor}>Abrir en editor</MenuItem>
        <MenuItem onClick={handleToggle}>{item.active ? 'Desactivar' : 'Activar'}</MenuItem>
        <MenuItem onClick={handleAddTask}>Añadir Tarea</MenuItem>
        <MenuItem onClick={handleDelete}>Eliminar</MenuItem>

        {/* Opciones de descarga de GIF si existen */}
        {item.scenarios && item.scenarios.some(scenario => scenarioGifs && scenarioGifs[`${item.id}::${scenario}`]) && [
          <Divider key="gif-divider" />,
          ...item.scenarios.map(scenario => {
            const gifId = scenarioGifs ? scenarioGifs[`${item.id}::${scenario}`] : null;
            if (!gifId) return null;
            return (
              <MenuItem
                key={gifId}
                onClick={() => {
                  window.open(`/api/execution/${gifId}/gif`, '_blank');
                  handleClose();
                }}
              >
                <ListItemIcon>
                  <DownloadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`Descargar GIF: ${scenario}`}
                  primaryTypographyProps={{ sx: { fontSize: '0.75rem' } }}
                />
              </MenuItem>
            );
          }).filter(Boolean)
        ]}
      </Menu>
    </>
  );
};
const MemoizedExecutionItem = React.memo(ExecutionItem);

const SortableModule: React.FC<{
  module: Module;
  controls: React.ReactNode;
  children: React.ReactNode;
}> = ({ module, controls, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: module.module_name,
    data: { type: 'module' }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
    position: 'relative' as 'relative',
  };

  const droppableId = `module-drop-area-${module.module_name}`;

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      moduleName: module.module_name,
    },
  });

  const { active, over: globalOver } = useDndContext();

  // Highlighting logic:
  const isDraggingFile = active?.data.current?.type === 'file-explorer-feature';
  const isOverChild = globalOver?.data?.current?.sortable?.containerId === module.module_name;
  const showHighlight = isDraggingFile && (isOver || isOverChild);

  return (
    <Box ref={setNodeRef} style={style} sx={{ position: 'relative' }}>
      <Box
        {...attributes}
        {...listeners}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '30px',
          cursor: 'grab',
          borderTopLeftRadius: (theme) => theme.shape.borderRadius,
          borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
          backgroundColor: module.color || DEFAULT_MODULE_COLOR,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Paper
        ref={setDroppableNodeRef} // Explicitly attach droppable ref here
        elevation={2}
        sx={{
          mb: 2,
          p: 2,
          pl: 4,
          backgroundColor: module.color ? `${module.color}20` : 'background.paper',
          outline: showHighlight ? '2px dashed' : 'none',
          outlineColor: showHighlight ? 'primary.main' : 'transparent',
          transition: 'outline-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
        }}
      >
        <Box display="flex" alignItems="center" mb={1}>
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Typography variant="h6" sx={{ fontSize: `${14 + 2}px`, flexGrow: 1 }}>
              {module.active
                ? `${module.order}. ${module.module_name}`
                : module.module_name}
            </Typography>
          </Box>
          {controls}
        </Box>
        {children}
      </Paper>
    </Box>
  );
};

const MemoizedSortableModule = React.memo(SortableModule);

interface ExecutionOrderProps {
  fontSize: number;
  onFeatureSelect: (path: string) => void;
  modules: Module[];
  setModules: React.Dispatch<React.SetStateAction<Module[]>>;
  isExecuting: boolean;
  runningFeatureId: string | null;
  onRunTests: () => void;
  onSaveModules: (modulesToSave?: Module[]) => void;
  collapsedSections: Set<string>;
  onToggleSectionCollapse: (sectionId: string) => void;
  navigateToModule: (moduleName: string) => void;
  onStopTests: () => void;
  onScheduleTests: (date: Date) => void;
  scheduledExecutionTime: Date | null;
  onCancelSchedule: () => void;
  validationTexts?: string[]; // Textos a validar desde FeatureEditor
}

const ExecutionOrder: React.FC<ExecutionOrderProps> = ({
  fontSize,
  onFeatureSelect,
  modules,
  setModules,
  isExecuting,
  runningFeatureId,
  onRunTests,
  onSaveModules,
  collapsedSections,
  onToggleSectionCollapse,
  navigateToModule,
  onStopTests,
  onScheduleTests,
  scheduledExecutionTime,
  onCancelSchedule,
  validationTexts = [],
}) => {
  const { scenarioStatuses, scenarioGifs } = useLayout();
  // Necesitamos acceder al elemento activo para deshabilitar el SortableContext si no es un módulo.
  // Esto es un patrón avanzado para permitir que droppables externos funcionen dentro de un SortableContext.
  const { active } = useDndContext();

  const { setNodeRef: setGlobalDroppableRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  const displayedModules = (modules || []).filter(m => m.active);

  const handleToggleSectionCollapse = async (moduleName: string, section: 'setup' | 'features' | 'teardown') => {
    const sectionId = `${moduleName}::${section}`;
    onToggleSectionCollapse(sectionId);
  };

  const handleToggleModuleCollapse = (moduleName: string) => {
    const sections: ('setup' | 'features' | 'teardown')[] = ['setup', 'features', 'teardown'];
    sections.forEach(section => {
      const sectionId = `${moduleName}::${section}`;
      onToggleSectionCollapse(sectionId);
    });
  };


  // --- State y Handlers para el diálogo de "Agregar Módulo" ---
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [availableModules, setAvailableModules] = React.useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = React.useState<Set<string>>(new Set());

  // --- State y Handlers para el diálogo de "Agregar Hook" ---
  const [hookDialogOpen, setHookDialogOpen] = React.useState(false);
  const [hookDialogData, setHookDialogData] = React.useState<{ targetModuleName: string; hookType: 'setup' | 'teardown' } | null>(null);
  const [availableHookModules, setAvailableHookModules] = React.useState<Module[]>([]);
  const [selectedHookModule, setSelectedHookModule] = React.useState<string>('');
  const [expandedHookModule, setExpandedHookModule] = React.useState<string | null>(null);
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());

  // --- State y Handlers para el diálogo de "Asociar Tarea" ---
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [availableTasks, setAvailableTasks] = React.useState<any[]>([]);
  const [selectedFeatureForTask, setSelectedFeatureForTask] = React.useState<{ moduleName: string, item: FeatureItem } | null>(null);
  const [editingTaskIndex, setEditingTaskIndex] = React.useState<number | null>(null);
  const [newTaskConfig, setNewTaskConfig] = React.useState<{
    name: string;
    scope: 'feature' | 'scenario' | 'step';
    hook: 'before' | 'after';
    scenario_name?: string;
    args: Record<string, any>;
  }>({ name: '', scope: 'feature', hook: 'before', args: {} });

  const handleTaskChange = (taskName: string) => {
    const task = availableTasks.find(t => t.name === taskName);
    const initialArgs: Record<string, any> = {};
    if (task && task.args_schema) {
      task.args_schema.forEach((arg: any) => {
        if (arg.default !== undefined) {
          initialArgs[arg.name] = arg.default;
        } else {
          initialArgs[arg.name] = arg.type === 'number' ? 0 : '';
        }
      });
    }

    // Pre-cargar textos de validación si la tarea es verificar_texto_archivo
    if (taskName === 'verificar_texto_archivo' && validationTexts.length > 0) {
      initialArgs['expected_texts'] = validationTexts.join('\n');
    }

    setNewTaskConfig({ ...newTaskConfig, name: taskName, args: initialArgs });
  };

  const handleOpenTaskDialog = async (moduleName: string, item: FeatureItem) => {
    setSelectedFeatureForTask({ moduleName, item });
    setTaskDialogOpen(true);

    // Fetch available tasks if not already loaded
    if (availableTasks.length === 0) {
      try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          setAvailableTasks(data.tasks || []);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    }
  };

  const handleOpenEditTaskDialog = async (moduleName: string, item: FeatureItem, task: any, index: number) => {
    setSelectedFeatureForTask({ moduleName, item });
    setEditingTaskIndex(index);
    setTaskDialogOpen(true);

    // Fetch tasks first to ensure schema availability
    let tasksList = availableTasks;
    if (availableTasks.length === 0) {
      try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          setAvailableTasks(data.tasks || []);
          tasksList = data.tasks || [];
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    }

    // Populate config with existing task data
    const taskDef = tasksList.find(t => t.name === task.name);
    const initialArgs = { ...task.args };

    if (taskDef && taskDef.args_schema) {
      taskDef.args_schema.forEach((arg: any) => {
        if (initialArgs[arg.name] === undefined) {
          if (arg.default !== undefined) initialArgs[arg.name] = arg.default;
          else initialArgs[arg.name] = arg.type === 'number' ? 0 : '';
        }
      });
    }

    setNewTaskConfig({
      name: task.name,
      scope: task.scope,
      hook: task.hook,
      scenario_name: task.scenario_name,
      args: initialArgs
    });
  };

  const handleCloseTaskDialog = () => {
    setTaskDialogOpen(false);
    setSelectedFeatureForTask(null);
    setEditingTaskIndex(null);
    setNewTaskConfig({ name: '', scope: 'feature', hook: 'before', args: {} });
  };

  const handleConfirmAddTask = async () => {
    if (!selectedFeatureForTask || !newTaskConfig.name) return;

    try {
      const method = editingTaskIndex !== null ? 'PUT' : 'POST';
      const body: any = {
        feature_file: selectedFeatureForTask.item.feature_file,
        feature_dir: selectedFeatureForTask.item.feature_dir,
        task_config: newTaskConfig
      };
      if (editingTaskIndex !== null) {
        body.task_index = editingTaskIndex;
      }

      const response = await fetch(`/api/modules/${encodeURIComponent(selectedFeatureForTask.moduleName)}/features/tasks`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const updatedModules = await response.json();
        setModules(updatedModules);
        handleCloseTaskDialog();
      } else {
        const error = await response.json();
        alert(`Error al añadir tarea: ${error.error}`);
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleDeleteTask = async (moduleName: string, item: FeatureItem, taskIndex: number) => {
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/tasks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_file: item.feature_file,
          feature_dir: item.feature_dir,
          task_index: taskIndex
        })
      });

      if (response.ok) {
        const updatedModules = await response.json();
        setModules(updatedModules);
      } else {
        const error = await response.json();
        alert(`Error al eliminar tarea: ${error.error}`);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // --- State para el diálogo de agendar ejecución ---
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false);
  const [scheduledTime, setScheduledTime] = React.useState('');

  const handleOpenScheduleDialog = () => {
    setScheduleDialogOpen(true);
    // Set default time to 5 minutes from now for convenience
    const now = new Date();
    // Adjust to local ISO string (handling timezone offset manually is tricky, 
    // but input type="datetime-local" expects YYYY-MM-DDThh:mm)
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    const localISOTime = (new Date(now.getTime() - offsetMs + 5 * 60 * 1000)).toISOString().slice(0, 16);
    setScheduledTime(localISOTime);
  };

  const handleCloseScheduleDialog = () => {
    setScheduleDialogOpen(false);
  };

  const handleConfirmSchedule = () => {
    if (scheduledTime) {
      onScheduleTests(new Date(scheduledTime));
      handleCloseScheduleDialog();
    }
  };




  const handleOpenDialog = () => {
    // Filtra los módulos que no están activos para mostrarlos en el diálogo
    const inactiveModules = modules.filter(m => !m.active);
    setAvailableModules(inactiveModules);
    setSelectedModules(new Set()); // Limpia la selección anterior
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleOpenHookDialog = (targetModuleName: string, hookType: 'setup' | 'teardown') => {
    const targetModule = modules.find(m => m.module_name === targetModuleName);
    if (!targetModule) return;

    // Obtiene los nombres de todos los módulos que ya están siendo usados como hooks (setup o teardown) para este módulo padre.
    const existingHookNames = new Set([
      ...(targetModule.setup || []).map(h => typeof h === 'string' ? h : (h as Module).module_name),
      ...(targetModule.teardown || []).map(h => typeof h === 'string' ? h : (h as Module).module_name)
    ]);

    // Obtiene los módulos completos que pueden ser añadidos como hooks.
    // 1. Filtra los módulos que no son el propio módulo padre y que no están ya en uso como hooks.
    const availableModuleNames = modules
      .filter(m =>
        m.module_name !== targetModuleName &&
        !existingHookNames.has(m.module_name) &&
        m.is_hook === true
      )
      .map(m => m.module_name);

    // 2. Obtiene los objetos Module completos para los nombres filtrados,
    //    asegurando que tenemos toda la información (incluyendo features y tags).
    const availableFullModules = modules.filter(m =>
      availableModuleNames.includes(m.module_name)
    );

    setAvailableHookModules(availableFullModules);
    setHookDialogData({ targetModuleName, hookType });
    setSelectedHookModule(''); // Limpia selección anterior
    setHookDialogOpen(true);
  };

  const handleCloseHookDialog = () => {
    setHookDialogOpen(false);
    setHookDialogData(null);
    setSelectedHookModule('');
    setSelectedTags(new Set()); // Limpia los tags seleccionados
    setExpandedHookModule(null); // Limpia el módulo expandido
  };

  const handleConfirmAddModule = async () => {
    // Itera sobre los módulos seleccionados y los activa uno por uno.
    // El 'false' en el segundo argumento simula que el estado actual es 'inactivo',
    // forzando a handleToggleModuleActivity a enviar 'active: true' al backend.
    const activationPromises = Array.from(selectedModules).map(moduleName =>
      handleToggleModuleActivity(moduleName, false)
    );

    const results = await Promise.all(activationPromises);

    // Después de que todas las promesas se resuelvan, tomamos el resultado de la última
    // llamada a la API (que contiene la lista de módulos más actualizada) y actualizamos el estado.
    if (results && results.length > 0) {
      const finalUpdatedModules = results[results.length - 1];
      if (finalUpdatedModules) setModules(finalUpdatedModules);
    }

    handleCloseDialog();
  };

  const handleToggleSelection = (moduleName: string) => {
    setSelectedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  };

  const handleConfirmAddHook = async () => {
    if (!selectedHookModule || !hookDialogData) return;

    const { targetModuleName, hookType } = hookDialogData;

    // Actualiza el estado localmente
    const updatedModules = modules.map(m => {
      if (m.module_name === targetModuleName) {
        const hookToAdd: HookInfo | string = selectedTags.size > 0
          ? { module_name: selectedHookModule, tags: Array.from(selectedTags) }
          : selectedHookModule;

        const newHooks = [...(m[hookType] || []), hookToAdd];
        return { ...m, [hookType]: newHooks };
      }
      return m;
    });

    setModules(updatedModules);

    // Cierra el diálogo
    onSaveModules(updatedModules);
    handleCloseHookDialog();
  };

  const handleDeleteHook = (targetModuleName: string, hookType: 'setup' | 'teardown', hookIndex: number) => {
    const updatedModules = modules.map(m => {
      if (m.module_name === targetModuleName) {
        const currentHooks = m[hookType] || [];
        // Filtra el hook por su índice para eliminarlo
        const newHooks = currentHooks.filter((_, index) => index !== hookIndex);
        return { ...m, [hookType]: newHooks };
      }
      return m;
    });

    setModules(updatedModules);
    onSaveModules(updatedModules);
  };

  const handleTagFilterToggle = (tagToToggle: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagToToggle)) {
        newSet.delete(tagToToggle);
      } else {
        newSet.add(tagToToggle);
      }
      return newSet;
    });
  };

  // -------------------------------------------------------------
  const handleDeleteModule = async (moduleName: string) => {
    // El comportamiento se cambia para que solo desactive el módulo, no lo elimine.
    // Se llama a la función de toggle, pero asegurando que el estado final sea 'inactivo'.
    // El 'true' en el segundo argumento simula que el estado actual es 'activo',
    // forzando a handleToggleModuleActivity a enviar 'active: false' al backend.
    await handleToggleModuleActivity(moduleName, true);
  };

  const handleToggleModuleActivity = async (moduleName: string, currentActivity: boolean) => {
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/activity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: !currentActivity }), // Envía el estado opuesto
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle module activity');
      }

      // Para evitar múltiples re-renderizados, solo actualizamos el estado una vez
      // si no estamos en el proceso de agregar múltiples módulos.
      // La actualización final se hará al cerrar el diálogo en ese caso.
      if (!dialogOpen) {
        const updatedModules = await response.json();
        setModules(updatedModules);
      }
      // Clonamos la respuesta para poder leer el JSON aquí y también devolverlo.
      const clonedResponse = response.clone();
      // Devolvemos la promesa que resuelve con los módulos actualizados para Promise.all
      return clonedResponse.json();
    } catch (error) {
      console.error('Error al cambiar el estado del módulo:', error);
    }
  };

  const handleDeleteFeature = async (moduleName: string, featureToDelete: FeatureItem) => {
    // Actualización optimista
    const originalModules = modules;
    setModules(prev => prev.map(m =>
      m.module_name === moduleName
        ? { ...m, features: m.features.filter(f => f.id !== featureToDelete.id) }
        : m
    ));

    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/delete`, {
        method: 'POST', // Usamos POST para poder enviar un body
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_file: featureToDelete.feature_file,
          feature_dir: featureToDelete.feature_dir,
        }),
      });
      if (!response.ok) setModules(originalModules);
    } catch (error) {
      console.error('Error al eliminar el feature:', error);
      setModules(originalModules);
    }
  };

  const handleToggleFeatureActivity = async (moduleName: string, featureToToggle: FeatureItem) => {
    // Actualización optimista
    const originalModules = modules;
    setModules(prev => prev.map(m =>
      m.module_name === moduleName
        ? { ...m, features: m.features.map(f => f.id === featureToToggle.id ? { ...f, active: !f.active } : f) }
        : m
    ));

    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/activity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_file: featureToToggle.feature_file,
          feature_dir: featureToToggle.feature_dir,
          active: !featureToToggle.active,
        }),
      });

      if (!response.ok) setModules(originalModules);
    } catch (error) {
      console.error('Error al cambiar la actividad del feature:', error);
      setModules(originalModules);
    }
  };

  const handleMoveFeature = async (moduleName: string, featureToMove: FeatureItem, direction: 'up' | 'down') => {
    const module = modules.find(m => m.module_name === moduleName);
    if (!module) return;

    const oldIndex = module.features.findIndex(f => f.id === featureToMove.id);
    if (oldIndex === -1) return;

    const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1;

    // Validar que el nuevo índice esté dentro de los límites del array
    if (newIndex < 0 || newIndex >= module.features.length) {
      return; // No se puede mover más allá de los límites
    }

    const reorderedFeatures = arrayMove(module.features, oldIndex, newIndex);

    // Re-asigna el orden secuencial para la actualización optimista
    const updatedFeaturesWithOrder = reorderedFeatures.map((feature, index) => ({
      ...feature,
      order: index + 1,
    }));

    // Actualización optimista: actualiza la UI inmediatamente
    setModules((prevModules: Module[]) =>
      prevModules.map(m =>
        m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m
      )
    );

    // Llama a la API para persistir el cambio
    try {
      // Prepara los datos para enviar, excluyendo los campos de solo visualización.
      const featuresToSave = updatedFeaturesWithOrder.map(({ display_tags, scenarios, color, ...rest }) => rest);

      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Envía la lista sin los campos de visualización. El backend reconstruirá el orden.
        // El backend ya no necesita los 'order' si la lista viene ordenada, pero enviarlos no causa problemas.
        body: JSON.stringify({ features: featuresToSave }),
      });

      if (!response.ok) {
        // Si la API falla, revierte el cambio en la UI
        setModules(modules);
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder features');
      }
      // Opcional: podrías actualizar el estado con la respuesta del servidor si es necesario
    } catch (error) {
      console.error('Error al reordenar el feature:', error);
      setModules(modules); // Revertir en caso de error de red
    }
  };

  const handleTagToggle = async (moduleName: string, featureId: string, tagName: string) => {
    const module = modules.find(m => m.module_name === moduleName);
    const feature = module?.features.find(f => f.id === featureId);
    if (!module || !feature) return;

    const currentTags = feature.tags || [];
    let newTags: string[] | null;

    if (currentTags.includes(tagName)) {
      newTags = currentTags.filter(t => t !== tagName);
    } else {
      newTags = [...currentTags, tagName];
    }

    if (newTags.length === 0) {
      newTags = null;
    }

    // Actualización optimista
    setModules((prev: Module[]) =>
      prev.map(m =>
        m.module_name === moduleName
          ? {
            ...m,
            features: m.features.map(f =>
              f.id === featureId ? { ...f, tags: newTags } : f
            ),
          }
          : m
      )
    );

    // Llamada a la API para persistir
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_file: feature.feature_file,
          feature_dir: feature.feature_dir,
          tags: newTags
        }),
      });

      if (!response.ok) {
        setModules(modules);
      }
    } catch (error) {
      console.error('Error al actualizar los tags del módulo:', error);
      setModules(modules);
    }
  };

  const handleModuleColorChange = async (moduleName: string, newColor: string) => {
    // Actualización optimista
    const originalModules = modules;
    setModules((prev: Module[]) =>
      prev.map(m => (m.module_name === moduleName ? { ...m, color: newColor } : m))
    );

    // Llamada a la API para persistir
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/color`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: newColor }),
      });

      if (!response.ok) {
        // Revertir en caso de error
        setModules(originalModules);
      }
    } catch (error) {
      console.error('Error al actualizar el color del módulo:', error);
      setModules(originalModules); // Revertir en caso de error de red
    }
  };

  const handleRefreshFeatures = async () => {
    try {
      const response = await fetch('/api/execution-order/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh features');
      }

      const updatedModules = await response.json();
      setModules(updatedModules);
      // Opcional: mostrar una notificación de éxito
    } catch (error) {
      console.error('Error al refrescar los features:', error);
      // Opcional: mostrar una notificación de error
    }
  };


  return (
    <Box ref={setGlobalDroppableRef} sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" flex={1} sx={{ fontSize: `${fontSize}px` }}>
          Execution Order
        </Typography>
        <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleOpenDialog}>
          Agregar Módulo
        </Button>
        <Tooltip title="Sincronizar Scenarios y Tags desde archivos .feature">
          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleRefreshFeatures}>
            <SyncIcon />
          </Button>
        </Tooltip>
        <Tooltip title={isExecuting ? "Detener Ejecución" : "Ejecutar Plan de Pruebas"}>
          <Button
            variant="contained"
            color={isExecuting ? "error" : "primary"}
            size="small" sx={{ mr: 1 }}
            onClick={isExecuting ? onStopTests : onRunTests}
            disabled={(isExecuting && modules.length === 0) || !!scheduledExecutionTime} // Deshabilita si está ejecutando o programado
          >
            {isExecuting ? <StopIcon /> : <PlayArrowIcon />}
          </Button>
        </Tooltip>
        <Tooltip title={scheduledExecutionTime ? "Ya existe una ejecución programada" : "Programar Ejecución"}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={handleOpenScheduleDialog}
            disabled={isExecuting || modules.length === 0 || !!scheduledExecutionTime}
          >
            <AccessTimeIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Ver Último Reporte">
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            sx={{ mr: 1 }}
            onClick={() => window.open('/api/report/index.html', '_blank')}
          >
            <AssessmentIcon />
          </Button>
        </Tooltip>

        {scheduledExecutionTime && (
          <Chip
            icon={<AccessTimeIcon />}
            label={`Programado: ${scheduledExecutionTime.toLocaleString()}`}
            onDelete={onCancelSchedule}
            color="warning"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        )}
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
        {Array.isArray(displayedModules) && displayedModules.length > 0 ? (
          <SortableContext
            items={displayedModules.map(m => m.module_name)}
            strategy={verticalListSortingStrategy}
            disabled={active != null && active.data.current?.type !== 'module'}
          >
            {displayedModules.map((module, index) => (
              <MemoizedSortableModule
                key={module.module_name}
                module={module}
                controls={
                  <>
                    <Tooltip title={collapsedSections.has(`${module.module_name}::features`) ? "Mostrar contenido" : "Ocultar contenido"}>
                      <IconButton onClick={() => handleToggleModuleCollapse(module.module_name)} size="small">
                        {collapsedSections.has(`${module.module_name}::features`) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cambiar color del módulo">
                      <IconButton size="small" component="label" sx={{ mr: 1 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: module.color || DEFAULT_MODULE_COLOR,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                        <input
                          type="color"
                          hidden
                          id={`module-color-${module.module_name}`}
                          name={`module-color-${module.module_name}`}
                          value={module.color || DEFAULT_MODULE_COLOR}
                          onChange={(e) => handleModuleColorChange(module.module_name, e.target.value)}
                        />
                      </IconButton>
                    </Tooltip>
                    <IconButton onClick={() => handleDeleteModule(module.module_name)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
              >
                {module.active && (
                  <>
                    <CollapsibleSection
                      title="Setup"
                      count={(module.setup || []).length}
                      isOpen={!collapsedSections.has(`${module.module_name}::setup`)}
                      onToggle={() => handleToggleSectionCollapse(module.module_name, 'setup')}
                      onAddModule={() => handleOpenHookDialog(module.module_name, 'setup')}
                    >
                      {(module.setup || []).map((hook, index) => (
                        <HookItem
                          key={
                            (typeof hook === 'object' && hook !== null && 'module_name' in hook ? hook.module_name : hook as string) + index
                          }
                          hook={hook}
                          onNavigate={navigateToModule}
                          onDelete={() => handleDeleteHook(module.module_name, 'setup', index)} />
                      ))}
                    </CollapsibleSection>
                  </>
                )}
                <CollapsibleSection title="Features" count={module.features.length} isOpen={!collapsedSections.has(`${module.module_name}::features`)} onToggle={() => handleToggleSectionCollapse(module.module_name, 'features')}>
                  {!collapsedSections.has(`${module.module_name}::features`) && (
                    <SortableContext
                      id={module.module_name}
                      items={module.features.map((f: FeatureItem) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {[...(module.features || [])].sort((a, b) => a.order - b.order)
                        .map((feature: FeatureItem, index: number) => (
                          <MemoizedExecutionItem
                            key={feature.id} item={feature} fontSize={fontSize}
                            onDoubleClick={(item) => {
                              const fullPath = [item.feature_dir, item.feature_file].filter(Boolean).join('/');
                              onFeatureSelect(fullPath);
                            }}
                            onToggleActivity={() => handleToggleFeatureActivity(module.module_name, feature)}
                            onDelete={() => handleDeleteFeature(module.module_name, feature)}
                            onMoveUp={() => handleMoveFeature(module.module_name, feature, 'up')}
                            onMoveDown={() => handleMoveFeature(module.module_name, feature, 'down')}
                            onTagClick={(featureId, tag) => handleTagToggle(module.module_name, featureId, tag)}
                            isRunning={feature.id === runningFeatureId}
                            isFirst={index === 0}
                            isLast={index === module.features.length - 1}
                            onAddTask={handleOpenTaskDialog}
                            onDeleteTask={handleDeleteTask}
                            onEditTask={handleOpenEditTaskDialog}
                            moduleName={module.module_name}
                          />
                        ))}
                    </SortableContext>
                  )}
                </CollapsibleSection>

                {module.active && (
                  <>
                    <CollapsibleSection
                      title="Teardown"
                      count={(module.teardown || []).length}
                      isOpen={!collapsedSections.has(`${module.module_name}::teardown`)}
                      onToggle={() => handleToggleSectionCollapse(module.module_name, 'teardown')}
                      onAddModule={() => handleOpenHookDialog(module.module_name, 'teardown')}
                    >
                      {(module.teardown || []).map((hook, index) => (
                        <HookItem
                          key={
                            (typeof hook === 'object' && hook !== null && 'module_name' in hook ? hook.module_name : hook as string) + index
                          }
                          hook={hook}
                          onNavigate={navigateToModule}
                          onDelete={() => handleDeleteHook(module.module_name, 'teardown', index)} />
                      ))}
                    </CollapsibleSection>
                  </>
                )}
              </MemoizedSortableModule>
            ))}
          </SortableContext>
        ) : (
          <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
            No hay módulos en el plan de ejecución. Comience agregando un módulo o arrastrando un feature a esta área.
          </Typography>
        )
        }
      </Box>

      <Dialog open={scheduleDialogOpen} onClose={handleCloseScheduleDialog}>
        <DialogTitle>Programar Ejecución</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Selecciona la fecha y hora para iniciar la ejecución de pruebas automáticamente.
          </DialogContentText>
          <TextField
            id="schedule-datetime"
            label="Fecha y Hora"
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScheduleDialog}>Cancelar</Button>
          <Button onClick={handleConfirmSchedule} variant="contained" color="primary">
            Programar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>Agregar Módulos al Plan de Ejecución</DialogTitle>
        <DialogContent>
          {availableModules.length > 0 ? (
            <List>
              {availableModules.map(module => (
                <ListItemButton key={module.module_name} onClick={() => handleToggleSelection(module.module_name)}>
                  <Checkbox
                    edge="start"
                    checked={selectedModules.has(module.module_name)}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemText primary={module.module_name} />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              No hay módulos inactivos para agregar.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleConfirmAddModule} disabled={selectedModules.size === 0}>
            Agregar Seleccionados
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={hookDialogOpen} onClose={handleCloseHookDialog} fullWidth maxWidth="xs">
        <DialogTitle>
          Agregar Hook de '{hookDialogData?.hookType}'
          <DialogContentText sx={{ fontSize: '0.9rem', mt: 1 }}>
            Solo se muestran los módulos marcados como "Hooks". Asegúrese de clasificar el módulo deseado como hook en la vista de Módulos.
          </DialogContentText>
        </DialogTitle>
        <DialogContent sx={{ height: '400px' }}>
          {availableHookModules.length > 0 ? (
            <List>
              <RadioGroup
                value={selectedHookModule}
                onChange={(e) => { // Este onChange solo se activará por el click en el ListItemButton
                  setSelectedHookModule(e.target.value);
                  setSelectedTags(new Set()); // Limpia los tags al seleccionar un nuevo módulo
                }}
              >
                {availableHookModules.map(module => {
                  const allTags = Array.from(new Set(module.features.flatMap(f => f.display_tags || [])));
                  const isExpanded = expandedHookModule === module.module_name;

                  const moduleTagsSet = new Set(allTags);
                  const matchesFilter = selectedTags.size === 0 || Array.from(selectedTags).every(tag => moduleTagsSet.has(tag));

                  return (
                    <React.Fragment key={module.module_name}>
                      <ListItem
                        disablePadding
                        sx={{
                          opacity: matchesFilter ? 1 : 0.5,
                          transition: 'opacity 0.2s ease-in-out',
                        }}
                      >
                        <ListItemButton
                          dense
                          disabled={!matchesFilter}
                          onClick={() => {
                            setSelectedHookModule(module.module_name);
                            setSelectedTags(new Set());
                            setExpandedHookModule(isExpanded ? null : module.module_name);
                          }}
                        >
                          <Radio value={module.module_name} />
                          <ListItemText primary={module.module_name} />
                        </ListItemButton>
                      </ListItem>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding dense>
                          <ListItem sx={{ pl: 4 }}>
                            {allTags.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {allTags.map(tag => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    clickable
                                    onClick={() => handleTagFilterToggle(tag)}
                                    color={selectedTags.has(tag) ? 'primary' : 'default'}
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Este módulo no tiene tags.</Typography>
                            )}
                          </ListItem>
                        </List>
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </RadioGroup>
            </List>
          ) : (
            <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              No hay módulos disponibles para agregar como hook.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHookDialog}>Cancelar</Button>
          <Button onClick={handleConfirmAddHook} disabled={!selectedHookModule}>Agregar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para añadir tarea */}
      <Dialog open={taskDialogOpen} onClose={handleCloseTaskDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingTaskIndex !== null ? `Editar Tarea: ${newTaskConfig.name}` : `Asociar Tarea a: ${selectedFeatureForTask?.item.feature_file}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="task-select-label">Seleccionar Tarea</InputLabel>
              <Select
                labelId="task-select-label"
                value={newTaskConfig.name}
                label="Seleccionar Tarea"
                onChange={(e) => handleTaskChange(e.target.value)}
              >
                {availableTasks.map(task => (
                  <MenuItem key={task.name} value={task.name}>{task.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Dynamic arguments schema rendering */}
            {newTaskConfig.name && availableTasks.find(t => t.name === newTaskConfig.name)?.args_schema?.length > 0 && (
              <Box sx={{ border: '1px solid #eee', p: 2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.02)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Configuración de la Tarea</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {availableTasks.find(t => t.name === newTaskConfig.name).args_schema.map((arg: any) => (
                    <TextField
                      key={arg.name}
                      id={`task-arg-${arg.name}`}
                      name={`task-arg-${arg.name}`}
                      label={arg.label || arg.name}
                      fullWidth
                      size="small"
                      multiline={arg.type === 'textarea'}
                      rows={arg.type === 'textarea' ? 4 : 1}
                      value={newTaskConfig.args[arg.name] ?? arg.default ?? ''}
                      onChange={(e) => setNewTaskConfig({
                        ...newTaskConfig,
                        args: { ...newTaskConfig.args, [arg.name]: e.target.value }
                      })}
                      type={arg.type === 'number' ? 'number' : 'text'}
                      placeholder={arg.type === 'textarea' ? 'Ingrese cada texto en una línea nueva' : ''}
                      helperText={arg.type === 'textarea' ? 'Un texto por línea' : ''}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel id="scope-select-label">Alcance (Scope)</InputLabel>
              <Select
                labelId="scope-select-label"
                value={newTaskConfig.scope}
                label="Alcance (Scope)"
                onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scope: e.target.value as any })}
              >
                <MenuItem value="feature">Feature (Toda la prueba)</MenuItem>
                <MenuItem value="scenario">Scenario (Solo un escenario)</MenuItem>
                <MenuItem value="step">Step (Todos los pasos)</MenuItem>
              </Select>
            </FormControl>

            {newTaskConfig.scope === 'scenario' && (
              <FormControl fullWidth>
                <InputLabel id="scenario-select-label">Seleccionar Escenario</InputLabel>
                <Select
                  labelId="scenario-select-label"
                  value={newTaskConfig.scenario_name || ''}
                  label="Seleccionar Escenario"
                  onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scenario_name: e.target.value })}
                >
                  {selectedFeatureForTask?.item.scenarios?.map(scenario => (
                    <MenuItem key={scenario} value={scenario}>{scenario}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth>
              <InputLabel id="hook-select-label">Gancho (Hook)</InputLabel>
              <Select
                labelId="hook-select-label"
                value={newTaskConfig.hook}
                label="Gancho (Hook)"
                onChange={(e) => setNewTaskConfig({ ...newTaskConfig, hook: e.target.value as any })}
              >
                <MenuItem value="before">Antes (Before)</MenuItem>
                <MenuItem value="after">Después (After)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTaskDialog}>Cancelar</Button>
          <Button onClick={handleConfirmAddTask} variant="contained" color="primary" disabled={!newTaskConfig.name || (newTaskConfig.scope === 'scenario' && !newTaskConfig.scenario_name)}>
            {editingTaskIndex !== null ? 'Actualizar Tarea' : 'Asociar Tarea'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default ExecutionOrder;