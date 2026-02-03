import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import WebhookIcon from '@mui/icons-material/Webhook';
import { useSortable, SortableContext, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { useDroppable, useDndContext, Active } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Module, FeatureItem, ScenarioStatusMap } from '../types';

const DEFAULT_FEATURE_COLOR = '#4db6ac';

const DEFAULT_MODULE_COLOR = '#7e57c2';

const HookItem: React.FC<{ hook: Module | string, onNavigate: (moduleName: string) => void }> = ({ hook, onNavigate }) => {
  const isObject = typeof hook === 'object' && hook !== null;
  const moduleName = isObject ? (hook as Module).module_name : hook;
  const isActive = isObject ? (hook as Module).active : false;

  return (
    <Box sx={{ mb: 1, p: 1, pl: 2, display: 'flex', alignItems: 'center' }}>
      <Typography
        variant="body2"
        onClick={() => onNavigate(moduleName)}
        sx={{
          flexGrow: 1,
          color: isActive ? 'primary.main' : 'text.secondary',
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        {moduleName}
      </Typography>
    </Box>
  );
};

const CollapsibleSection: React.FC<{ title: string, count: number, children: React.ReactNode, onAddModule?: (event?: React.MouseEvent) => void, isOpen: boolean, onToggle: () => void }> = ({ title, count, children, onAddModule, isOpen, onToggle }) => {
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
            Añadir Módulo
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
  moduleName: string;
  onMoveFeature: (moduleName: string, item: FeatureItem, direction: 'up' | 'down') => void;
  fontSize: number;
  onFeatureSelect: (path: string) => void;
  onToggleActivity: (moduleName: string, item: FeatureItem) => void;
  onDelete: (moduleName: string, item: FeatureItem) => void;
  onTagClick: (moduleName: string, featureId: string, tag: string) => void;
  scenarioStatuses: ScenarioStatusMap;
  isRunning: boolean;
  isFirst: boolean;
  isLast: boolean;
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  moduleName,
  onMoveFeature,
  fontSize,
  onFeatureSelect,
  onToggleActivity,
  onDelete,
  onTagClick,
  scenarioStatuses,
  isRunning,
  isFirst,
  isLast,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'feature' } // Identificamos este elemento como una 'feature'
  });

  const [contextMenu, setContextMenu] = React.useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
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

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleOpenInEditor = () => {
    const fullPath = [item.feature_dir, item.feature_file].filter(Boolean).join('/');
    onFeatureSelect(fullPath);
    handleClose();
  };

  const handleToggle = () => {
    onToggleActivity(moduleName, item);
    handleClose();
  };

  const handleDelete = () => {
    onDelete(moduleName, item);
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
        elevation={4} // Sombra para destacar que es un elemento individual
        onDoubleClick={handleOpenInEditor}
        onContextMenu={handleContextMenu}
        sx={{
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: 'background.default', // Usar color del tema
          position: 'relative', // Necesario para posicionar el handle
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
            cursor: 'grab',
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
        <Box sx={{ flexGrow: 1, ml: 1, cursor: 'pointer' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: `${fontSize}px` }}>
              {`${item.order}. ${item.feature_file}`}
            </Typography>
            {/* Mostrar los tags del feature si existen, ahora al lado del nombre */}
            {item.display_tags && item.display_tags.length > 0 && (
              item.display_tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  icon={<LocalOfferIcon fontSize="small" />}
                  size="small"
                  variant={'outlined'}
                  sx={{ fontSize: '0.7rem', height: '22px', borderRadius: '4px' }} // Hacemos el chip más rectangular
                />
              ))
            )}
          </Box>
          {/* Mostrar los escenarios del feature si existen */}
          {item.scenarios && item.scenarios.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.scenarios.map((scenario) => {
                // Construimos la clave única para este escenario específico
                const uniqueScenarioId = `${item.id}::${scenario}`;

                const truncatedLabel = scenario.length > 25 ? `${scenario.substring(0, 25)}...` : scenario;

                return (
                  <Tooltip key={scenario} title={scenario} arrow>
                    <Chip
                      icon={
                        undefined
                      }
                      label={truncatedLabel}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>
        {/* Los botones ahora están fuera del handle y sus clics funcionarán. */}
        <IconButton key={`${item.id}-up`} edge="end" onClick={() => onMoveFeature(moduleName, item, 'up')} size="small" disabled={isFirst}>
          <ArrowUpwardIcon />
        </IconButton>
        <IconButton key={`${item.id}-down`} edge="end" onClick={() => onMoveFeature(moduleName, item, 'down')} size="small" disabled={isLast}>
          <ArrowDownwardIcon />
        </IconButton>
        <Tooltip title="Eliminar feature">
          <IconButton edge="end" onClick={handleDelete} size="small" sx={{ ml: 1 }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
        <MenuItem onClick={handleDelete}>Eliminar</MenuItem>
      </Menu>
    </>
    // ... (rest of render logic for ExecutionItem)
  );
};
const MemoizedExecutionItem = React.memo(ExecutionItem);

const SortableModule = React.forwardRef<HTMLDivElement, {
  module: Module;
  isCollapsed: boolean;
  onToggleCollapse: (moduleName: string) => void;
  onColorChange: (moduleName: string, color: string) => void;
  onDeleteModule: (moduleName: string) => void;
  onToggleHook: (moduleName: string, isHook: boolean) => void;
  children: React.ReactNode;
}>((props, ref) => {
  const { module, isCollapsed, onToggleCollapse, onColorChange, onDeleteModule, onToggleHook, children } = props;
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
  // Highlight if:
  // 1. We are dragging a file (file-explorer-feature) AND
  // 2. The pointer is over this module's drop zone (isOver) OR
  // 3. The pointer is over any Sortable item belonging to this module (containerId match)
  const isDraggingFile = active?.data.current?.type === 'file-explorer-feature';
  const isOverChild = globalOver?.data?.current?.sortable?.containerId === module.module_name;
  const showHighlight = isDraggingFile && (isOver || isOverChild);

  // External ref handling (for highlighting)
  React.useImperativeHandle(ref, () => {
    // Return a dummy object or specific logic if needed,
    // but simpler to just attach ref to the Paper if that's what we want to scroll to/highlight
    return null as any;
  });
  // NOTE: For simplicity in this fix, we are decoupling the refs. 
  // The outer Box is the Sortable item (draggable handles work here).
  // The inner Paper is the Drop Zone.

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onColorChange(module.module_name, e.target.value);
  };

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
        ref={(node) => {
          setDroppableNodeRef(node);
          if (typeof ref === 'function') ref(node); // Attach external ref to Paper for scrolling/highlight
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
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
                ? `${module.order}. ${module.is_hook ? 'Hooks - ' : ''}${module.module_name}`
                : `${module.is_hook ? 'Hooks - ' : ''}${module.module_name}`}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <Tooltip title={isCollapsed ? "Mostrar contenido" : "Ocultar contenido"}>
              <IconButton onClick={() => onToggleCollapse(module.module_name)} size="small">
                {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
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
                  onChange={handleColorChange}
                />
              </IconButton>
            </Tooltip>
            <Tooltip title={module.is_hook ? "Es un Hook (click para quitar)" : "Marcar como Hook"}>
              <IconButton onClick={() => onToggleHook(module.module_name, !module.is_hook)} size="small" color={module.is_hook ? "primary" : "default"}>
                <WebhookIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar módulo">
              <IconButton onClick={() => onDeleteModule(module.module_name)} size="small">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {children}
      </Paper>
    </Box>
  );
});
const MemoizedSortableModule = React.memo(SortableModule);

interface ExecutionOrderProps {
  fontSize: number;
  onFeatureSelect: (path: string) => void;
  modules: Module[]; // Usar el tipo Module
  setModules: React.Dispatch<React.SetStateAction<Module[]>>; // Usar el tipo Module
  scenarioStatuses: ScenarioStatusMap;
  setScenarioStatuses: React.Dispatch<React.SetStateAction<ScenarioStatusMap>>;
  isExecuting: boolean;
  runningFeatureId: string | null;
  onRunTests: () => void;
  onSaveModules: (modulesToSave?: Module[]) => void;
  collapsedSections: Set<string>;
  onToggleSectionCollapse: (sectionId: string) => void;
  focusedModule: string | null;
  onStopTests: () => void;
  navigateToModule: (moduleName: string) => void;
  onFocusConsumed: () => void; // Nueva prop para notificar que el foco ha sido consumido.
}

const Modules: React.FC<ExecutionOrderProps> = ({
  fontSize,
  onFeatureSelect,
  modules,
  setModules,
  scenarioStatuses,
  setScenarioStatuses,
  isExecuting,
  runningFeatureId,
  onRunTests,
  onSaveModules,
  collapsedSections,
  onToggleSectionCollapse,
  focusedModule,
  onStopTests,
  navigateToModule,
  onFocusConsumed,
}) => {
  // Necesitamos acceder al elemento activo para deshabilitar el SortableContext si no es un módulo.
  // Esto es un patrón avanzado para permitir que droppables externos funcionen dentro de un SortableContext.
  const { active } = useDndContext();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { setNodeRef: setGlobalDroppableRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Ref para evitar que el efecto de foco se ejecute varias veces.
  const focusEffectHasRun = useRef(false);

  useEffect(() => {
    if (focusedModule && moduleRefs.current[focusedModule]) {
      // Si el módulo de destino está colapsado, lo expandimos.
      const featuresSectionId = `${focusedModule}::features`;
      if (collapsedSections.has(featuresSectionId)) {
        onToggleSectionCollapse(featuresSectionId);
      }

      // Añadimos un pequeño retardo para asegurar que el DOM esté listo,
      // especialmente si el módulo estaba colapsado.
      setTimeout(() => {
        const element = moduleRefs.current[focusedModule];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Añade un resaltado temporal
          element.style.transition = 'background-color 0.5s ease-in-out';
          element.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Amarillo semitransparente
          setTimeout(() => {
            element.style.backgroundColor = '';
            // Una vez que el efecto ha terminado, notificamos al padre para que limpie el estado.
            onFocusConsumed();
          }, 2000); // El resaltado dura 2 segundos
        } else {
          // Si el elemento no se encuentra (p. ej. aún no se ha renderizado), limpiamos el foco para evitar bucles.
          onFocusConsumed();
        }
      }, 100); // 100ms de retardo
    }
    // La dependencia de focusedModule es la clave. Las demás son funciones estables.
  }, [focusedModule, onToggleSectionCollapse, onFocusConsumed]);

  const displayedModules = modules || [];

  const handleToggleModuleCollapse = useCallback((moduleName: string) => {
    const sectionId = `${moduleName}::features`;
    onToggleSectionCollapse(sectionId);
  }, [onToggleSectionCollapse]);

  const handleToggleSectionCollapse = async (moduleName: string, section: 'setup' | 'features' | 'teardown') => {
    const sectionId = `${moduleName}::${section}`;
    onToggleSectionCollapse(sectionId);
  };

  // --- State y Handlers para el diálogo de "Agregar Módulo" ---
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newModuleName, setNewModuleName] = React.useState('');
  const [newModuleOrder, setNewModuleOrder] = React.useState('');

  const handleOpenDialog = (event?: React.MouseEvent) => {
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewModuleName('');
    setNewModuleOrder('');
  };

  const handleConfirmAddModule = async () => {
    const order = parseInt(newModuleOrder, 10);
    if (newModuleName && !isNaN(order)) {
      try {
        const response = await fetch('/api/modules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            module_name: newModuleName,
            order: order,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add module');
        }

        const updatedModules = await response.json();
        setModules(updatedModules); // Actualiza el estado con la respuesta del backend
        handleCloseDialog();
      } catch (error) {
        console.error('Error al agregar el módulo:', error);
        // Opcional: mostrar un mensaje de error al usuario
      }
    }
  };
  // -------------------------------------------------------------
  const handleDeleteModule = async (moduleName: string) => {
    // Opcional: pedir confirmación al usuario
    // if (!window.confirm(`¿Estás seguro de que quieres eliminar el módulo "${moduleName}"?`)) {
    //   return;
    // }

    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete module');
      }

      const updatedModules = await response.json();
      setModules(updatedModules); // Actualiza el estado con la respuesta del backend
    } catch (error) {
      console.error('Error al eliminar el módulo:', error);
    }
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

      const updatedModules = await response.json();
      setModules(updatedModules); // Actualiza el estado con la respuesta del backend
    } catch (error) {
      console.error('Error al cambiar el estado del módulo:', error);
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
      await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/activity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_file: featureToToggle.feature_file,
          feature_dir: featureToToggle.feature_dir,
          active: !featureToToggle.active,
        }),
      });
    } catch (error) {
      console.error('Error al cambiar la actividad del feature:', error);
      setModules(originalModules);
    }
  };

  const handleDeleteFeature = async (moduleName: string, feature: FeatureItem) => {
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feature_file: feature.feature_file,
          feature_dir: feature.feature_dir,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete feature');
      }

      const updatedModules = await response.json();
      setModules(updatedModules);
    } catch (error) {
      console.error('Error al eliminar el feature:', error);
      // Opcional: mostrar un mensaje de error al usuario
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
      const featuresToSave = updatedFeaturesWithOrder.map(({ display_tags, scenarios, ...rest }) => rest);

      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Envía la lista sin los campos de visualización. El backend reconstruirá el orden.
        // El backend ya no necesita los 'order' si la lista viene ordenada, pero enviarlos no causa problemas.
        body: JSON.stringify(featuresToSave),
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

  const handleToggleHook = async (moduleName: string, isHook: boolean) => {
    // Actualización optimista
    const originalModules = modules;
    setModules((prev: Module[]) =>
      prev.map(m => (m.module_name === moduleName ? { ...m, is_hook: isHook } : m))
    );

    // Llamada a la API para persistir
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/is_hook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hook: isHook }),
      });

      if (!response.ok) {
        // Revertir en caso de error
        setModules(originalModules);
      }
    } catch (error) {
      console.error('Error al actualizar el estado de hook del módulo:', error);
      setModules(originalModules); // Revertir en caso de error de red
    }
  };

  const handleRefreshFeatures = async () => {
    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
    }
  };


  return (
    <Box ref={setGlobalDroppableRef} sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" flex={1} sx={{ fontSize: `${fontSize}px` }}>
          Execution Order
        </Typography>
        <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={(e) => handleOpenDialog(e)} id="create-module-button">
          Crear Módulo
        </Button>
        <Tooltip title="Sincronizar Scenarios y Tags desde archivos .feature">
          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleRefreshFeatures}>
            <SyncIcon />
          </Button>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
        {isRefreshing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
            <CircularProgress size={40} thickness={4} />
            <Typography variant="caption" color="text.secondary">Refreshing modules...</Typography>
          </Box>
        ) : (
          Array.isArray(displayedModules) && displayedModules.length > 0 ? (
            <SortableContext
              items={displayedModules.map(m => m.module_name)}
              strategy={verticalListSortingStrategy}
              disabled={active != null && active.data.current?.type !== 'module'}
            >
              {displayedModules.map((module, index) => (
                <MemoizedSortableModule
                  ref={(el: HTMLDivElement | null) => {
                    moduleRefs.current[module.module_name] = el;
                  }}
                  key={module.module_name}
                  module={module}
                  isCollapsed={collapsedSections.has(`${module.module_name}::features`)}
                  onToggleCollapse={handleToggleModuleCollapse}
                  onColorChange={handleModuleColorChange}
                  onDeleteModule={handleDeleteModule}
                  onToggleHook={handleToggleHook}
                >
                  <CollapsibleSection title="Features" count={module.features.length} isOpen={!collapsedSections.has(`${module.module_name}::features`)} onToggle={() => handleToggleSectionCollapse(module.module_name, 'features')}>
                    {!collapsedSections.has(`${module.module_name}::features`) && (
                      <SortableContext
                        id={module.module_name}
                        items={module.features.map((f: FeatureItem) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {[...(module.features || [])]
                          .sort((a, b) => a.order - b.order)
                          .map((feature: FeatureItem, index: number) => (
                            <MemoizedExecutionItem
                              key={feature.id}
                              item={feature}
                              moduleName={module.module_name}
                              fontSize={fontSize}
                              onFeatureSelect={onFeatureSelect}
                              onToggleActivity={handleToggleFeatureActivity}
                              onDelete={handleDeleteFeature}
                              onMoveFeature={handleMoveFeature}
                              onTagClick={handleTagToggle}
                              scenarioStatuses={scenarioStatuses}
                              isRunning={feature.id === runningFeatureId}
                              isFirst={index === 0}
                              isLast={index === module.features.length - 1}
                            />
                          ))}
                      </SortableContext>
                    )}
                  </CollapsibleSection>
                </MemoizedSortableModule>
              ))}
            </SortableContext>
          ) : (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" sx={{ opacity: 0.6 }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No hay módulos definidos
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Crea un módulo nuevo o sincroniza para empezar.
              </Typography>
            </Box>
          )
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>Agregar Nuevo Módulo</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="module-name"
            name="module-name"
            label="Nombre del Módulo"
            type="text"
            fullWidth
            variant="standard"
            value={newModuleName}
            onChange={(e) => setNewModuleName(e.target.value)}
          />
          <TextField
            margin="dense"
            id="module-order"
            name="module-order"
            label="Orden"
            type="number"
            fullWidth
            variant="standard"
            value={newModuleOrder}
            onChange={(e) => setNewModuleOrder(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleConfirmAddModule}>Confirmar</Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default Modules;