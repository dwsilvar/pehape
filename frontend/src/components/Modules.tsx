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
import { useSortable, SortableContext, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { useDroppable, useDndContext, Active } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Module, FeatureItem, ScenarioStatusMap } from '../types'; 

const DEFAULT_FEATURE_COLOR = '#4db6ac'; 

const DEFAULT_MODULE_COLOR = '#7e57c2'; 

const HookItem: React.FC<{ hook: Module | string }> = ({ hook }) => {
    const isObject = typeof hook === 'object' && hook !== null;
    const moduleName = isObject ? (hook as Module).module_name : hook;
    const isActive = isObject ? (hook as Module).active : false;

    const handleHookClick = () => {
      console.log(`TODO: Go to module: ${moduleName}`);
    };

    return (
        <Box sx={{ mb: 1, p: 1, pl: 2, display: 'flex', alignItems: 'center' }}>
        <Typography
          variant="body2"
          onClick={handleHookClick}
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  fontSize: number;
  onDoubleClick: (item: FeatureItem) => void;
  onDelete: (item: FeatureItem) => void;
  onTagClick: (featureId: string, tag: string) => void;
  scenarioStatuses: ScenarioStatusMap;
  isRunning: boolean; 
  isFirst: boolean; 
  isLast: boolean; 
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  onMoveUp,
  onMoveDown,
  fontSize,
  onDoubleClick,
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
    onDoubleClick(item); // Reutiliza la lógica existente para abrir el editor
    handleClose();
  };

  const handleDelete = () => {
    onDelete(item);
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
        onDoubleClick={() => onDoubleClick(item)}
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
                  clickable
                  key={tag}
                  label={tag}
                  icon={<LocalOfferIcon fontSize="small" />}
                  size="small"
                  color={item.tags?.includes(tag) ? 'primary' : 'default'}
                  variant={item.tags?.includes(tag) ? 'filled' : 'outlined'}
                  onClick={() => onTagClick(item.id, tag)}
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
                const status = scenarioStatuses[uniqueScenarioId] || 'untested';
                const colorMap = {
                  passed: 'success',
                  failed: 'error',
                  skipped: 'warning',
                  untested: 'default',
                  running: 'info',
                } as const;

                const truncatedLabel = scenario.length > 25 ? `${scenario.substring(0, 25)}...` : scenario;

                return (
                  <Tooltip key={scenario} title={scenario} arrow>
                    <Chip
                      icon={
                        status === 'running' ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : undefined
                      }
                      label={truncatedLabel}
                      size="small"
                      color={colorMap[status]}
                      variant={status === 'untested' ? 'outlined' : 'filled'}
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>
        {/* Los botones ahora están fuera del handle y sus clics funcionarán. */}
        <IconButton key={`${item.id}-up`} edge="end" onClick={onMoveUp} size="small" disabled={isFirst}>
          <ArrowUpwardIcon />
        </IconButton>
        <IconButton key={`${item.id}-down`} edge="end" onClick={onMoveDown} size="small" disabled={isLast}>
          <ArrowDownwardIcon />
        </IconButton>
        <IconButton edge="end" onClick={() => onDelete(item)} size="small" sx={{ ml: 1 }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
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
        <MenuItem onClick={handleDelete}>Eliminar</MenuItem>
      </Menu>
    </>
  );
};

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

  const combinedRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDroppableNodeRef(node);
  };

  return (
    <Box ref={combinedRef} style={style} sx={{ position: 'relative' }}>
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
        elevation={2}
        sx={{
          mb: 2,
          p: 2,
          pl: 4,
          backgroundColor: module.color ? `${module.color}20` : 'background.paper', 
          outline: isOver ? '2px dashed' : 'none',
          outlineColor: isOver ? 'primary.main' : 'transparent',
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
  onStopTests: () => void;
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
  onStopTests,
}) => {
  // Necesitamos acceder al elemento activo para deshabilitar el SortableContext si no es un módulo.
  // Esto es un patrón avanzado para permitir que droppables externos funcionen dentro de un SortableContext.
  const { active } = useDndContext();

  const { setNodeRef: setGlobalDroppableRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set()); 

  useEffect(() => {
    const initiallyCollapsed = new Set<string>();
    modules.forEach(module => {
        if (module.is_collapsed) {
          // Si el módulo debe estar colapsado por defecto, colapsamos todas sus secciones
          initiallyCollapsed.add(`${module.module_name}::setup`);
          initiallyCollapsed.add(`${module.module_name}::features`);
          initiallyCollapsed.add(`${module.module_name}::teardown`);
        }
    });
    setCollapsedSections(initiallyCollapsed);
  }, [modules]);

  const displayedModules = modules || [];

  const handleToggleModuleCollapse = (moduleName: string) => {
    const isCollapsed = collapsedSections.has(`${moduleName}::features`);
    const newCollapsedState = !isCollapsed;

    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      const sections = ['setup', 'features', 'teardown'];
      sections.forEach(section => {
        const sectionId = `${moduleName}::${section}`;
        if (newCollapsedState) {
          newSet.add(sectionId);
        } else {
          newSet.delete(sectionId);
        }
      });
      return newSet;
    });

    // Aquí podrías añadir la llamada a la API si quieres persistir este estado "maestro"
    // Por ahora, solo controla la UI.
    // fetch(`/api/ui-settings/module-collapse`, { ... });
  };

  const handleToggleSectionCollapse = async (moduleName: string, section: 'setup' | 'features' | 'teardown') => {
    const sectionId = `${moduleName}::${section}`;
    const isCurrentlyCollapsed = collapsedSections.has(sectionId);
    const newCollapsedState = !isCurrentlyCollapsed;

    // Actualización optimista de la UI
    setCollapsedSections((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newCollapsedState) {
        newSet.add(sectionId);
      } else {
        newSet.delete(sectionId);
      }
      return newSet;
    });

    // Persistir el cambio en el backend
    try {
      await fetch('/api/ui-settings/module-collapse', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_name: moduleName, is_collapsed: newCollapsedState }),
      });
    } catch (error) {
      console.error('Error al guardar el estado de colapso:', error);
      // Opcional: revertir el cambio en la UI si la llamada a la API falla.
    }
  };

  // --- State y Handlers para el diálogo de "Agregar Módulo" ---
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newModuleName, setNewModuleName] = React.useState('');
  const [newModuleOrder, setNewModuleOrder] = React.useState('');

  const handleOpenDialog = () => { 
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
        <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleOpenDialog} id="create-module-button">
          Crear Módulo
        </Button>
        <Tooltip title="Sincronizar Scenarios y Tags desde archivos .feature">
          <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleRefreshFeatures}>
            <SyncIcon />
          </Button>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
          {Array.isArray(displayedModules) && displayedModules.length > 0 ? (
          <SortableContext 
            items={displayedModules.map(m => m.module_name)}
            strategy={verticalListSortingStrategy}
            disabled={active != null && active.data.current?.type !== 'module'}
          >
            {displayedModules.map((module, index) => ( 
              <SortableModule 
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
                      <ExecutionItem
                        key={feature.id} item={feature} fontSize={fontSize}
                        onDoubleClick={(item) => {
                          const fullPath = [item.feature_dir, item.feature_file].filter(Boolean).join('/');
                          onFeatureSelect(fullPath);
                        }}
                        onDelete={() => handleDeleteFeature(module.module_name, feature)}
                        onMoveUp={() => handleMoveFeature(module.module_name, feature, 'up')}
                        onMoveDown={() => handleMoveFeature(module.module_name, feature, 'down')}
                        onTagClick={(featureId, tag) => handleTagToggle(module.module_name, featureId, tag)}
                        scenarioStatuses={scenarioStatuses}
                        isRunning={feature.id === runningFeatureId}
                        isFirst={index === 0}
                        isLast={index === module.features.length - 1}
                      />
                    ))}
                  </SortableContext>
                  )}
                </CollapsibleSection>
              </SortableModule>
            ))}
          </SortableContext>
          ) : (
            <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
              No hay módulos en el plan de ejecución. Comience agregando un módulo o arrastrando un feature a esta área.
            </Typography>
          )
        }
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
    </Box>
  );
};

export default Modules;