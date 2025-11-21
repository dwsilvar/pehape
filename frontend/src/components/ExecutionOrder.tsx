import React, { useState, useEffect, useRef } from 'react';
import { // Importa los componentes necesarios para el diálogo
  Box,
  CircularProgress,
  Typography,
  List,
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
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SaveIcon from '@mui/icons-material/Save';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // Importar el ícono de Play
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SyncIcon from '@mui/icons-material/Sync';
import StopIcon from '@mui/icons-material/Stop'; // Importar el ícono de Stop
import { useSortable, SortableContext, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useExecutionOrder } from '../hooks/useExecutionOrder';
import { Module, FeatureItem } from '../types'; // Importar tipos centralizados
interface ExecutionItemProps {
  item: FeatureItem;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  fontSize: number;
  onDoubleClick: (item: FeatureItem) => void;
  onDelete: (item: FeatureItem) => void;
  onTagClick: (featureId: string, tag: string) => void; // Handler para el clic en un tag
  scenarioStatuses: Record<string, 'passed' | 'failed' | 'skipped' | 'untested' | 'running'>;
}

type ScenarioStatus = 'passed' | 'failed' | 'skipped' | 'untested' | 'running';
interface ScenarioStatusMap {
  [scenarioName: string]: ScenarioStatus;
}

const DEFAULT_FEATURE_COLOR = '#4db6ac'; // Un tono verde azulado (teal) para los features

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  onMoveUp,
  onMoveDown,
  fontSize,
  onDoubleClick,
  onDelete,
  onTagClick,
  scenarioStatuses,
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
          <Typography sx={{ fontSize: `${fontSize}px`, display: 'flex', alignItems: 'center' }}>
            {`${item.order}. ${item.feature_file}`}
          </Typography>
          <Typography variant="caption" color={item.active ? 'success.main' : 'text.secondary'}>
            {item.active ? 'Activo' : 'Inactivo'}
          </Typography>
          {/* Mostrar los tags del feature si existen */}
          {item.display_tags && item.display_tags.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.display_tags.map((tag) => (
                <Chip
                  clickable
                  key={tag}
                  label={tag}
                  size="small"
                  color={item.tags?.includes(tag) ? 'primary' : 'default'}
                  variant={item.tags?.includes(tag) ? 'filled' : 'outlined'}
                  onClick={() => onTagClick(item.id, tag)}
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
              ))}
            </Box>
          )}
          {/* Mostrar los escenarios del feature si existen */}
          {item.scenarios && item.scenarios.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.scenarios.map((scenario) => {
                const status = scenarioStatuses[scenario] || 'untested';
                const colorMap = {
                  passed: 'success',
                  failed: 'error',
                  skipped: 'warning',
                  untested: 'default',
                  running: 'info',
                } as const;

                return (
                  <Chip
                    key={scenario}
                    label={scenario}
                    size="small"
                    color={colorMap[status]}
                    variant={status === 'untested' ? 'outlined' : 'filled'}
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
        {/* Los botones ahora están fuera del handle y sus clics funcionarán. */}
        <IconButton key={`${item.id}-up`} edge="end" onClick={onMoveUp} size="small">
          <KeyboardArrowUpIcon />
        </IconButton>
        <IconButton key={`${item.id}-down`} edge="end" onClick={onMoveDown} size="small">
          <KeyboardArrowDownIcon />
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
  features: React.ReactNode;
  onTagToggle: (moduleName: string, featureId: string, tagName: string) => void;
}> = ({ module, controls, features }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: module.module_name, // Use a unique ID for the module
    data: { type: 'module' } // Add data to identify it as a module
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
    position: 'relative' as 'relative',
  };

  const droppableId = `module-drop-area-${module.module_name}`;
  // LOG: Confirmar que cada módulo se registra como un área "droppable"
  // console.log(`Registering droppable area with ID: ${droppableId}`);

  // Hacer que el módulo sea un área "soltable" (droppable)
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      moduleName: module.module_name,
    },
  });

  // Unificamos los refs de sortable y droppable en un solo manejador.
  const combinedRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDroppableNodeRef(node);
  };

  return (
    <Box ref={combinedRef} style={style} sx={{ position: 'relative' }}>
      {/* Este Box es el nuevo "handle" para arrastrar. Se posiciona sobre el Paper. */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '30px', // Ancho suficiente para el ícono
          cursor: 'grab',
          borderTopLeftRadius: (theme) => theme.shape.borderRadius,
          borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
          backgroundColor: module.color || DEFAULT_MODULE_COLOR,
          zIndex: 1, // Asegura que esté por encima del Paper
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      {/* El ref del droppable se aplica al Paper para que cubra toda el área del módulo */}
      <Paper
        elevation={2}
        sx={{
          mb: 2,
          p: 2,
          pl: 4,
          backgroundColor: module.color ? `${module.color}20` : 'background.paper', // Aplica un tinte del color seleccionado
          // Efecto visual cuando un elemento arrastrable está sobre el módulo
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
          {/* The rest of the controls are outside the drag handle */}
          {controls}
        </Box>
        {features}
      </Paper>
    </Box>
  );
};

interface ExecutionOrderProps {
  fontSize: number;
  isDropTarget: boolean;
  onAddFeature: () => void;
  onFeatureSelect: (path: string) => void;
  modules: Module[]; // Usar el tipo Module
  setModules: React.Dispatch<React.SetStateAction<Module[]>>; // Usar el tipo Module
  // handleSave ya fue eliminado en un paso anterior, lo quito para mantener consistencia.
}

const DEFAULT_MODULE_COLOR = '#7e57c2'; // Un tono púrpura para los módulos

const ExecutionOrder: React.FC<ExecutionOrderProps> = ({ fontSize, onFeatureSelect, modules, setModules }) => {
  // Necesitamos acceder al elemento activo para deshabilitar el SortableContext si no es un módulo.
  // Esto es un patrón avanzado para permitir que droppables externos funcionen dentro de un SortableContext.
  const { active } = useDndContext();

  const { setNodeRef: setGlobalDroppableRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  // Estado para controlar si se muestran los módulos inactivos. Por defecto, solo activos.
  const [showInactive, setShowInactive] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  // --- Estados para el log en tiempo real ---
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [scenarioStatuses, setScenarioStatuses] = useState<ScenarioStatusMap>({});
  const logsEndRef = useRef<null | HTMLDivElement>(null);

  // Efecto para recargar los módulos cuando cambia el estado de 'showInactive'.
  useEffect(() => {
    const fetchModules = async () => {
      try {
        // Construye la URL dinámicamente basándose en el estado 'showInactive'.
        const url = `/api/execution-order${showInactive ? '?include_inactive=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch execution order');
        }
        const data = await response.json();
        setModules(data); // Actualiza el estado global con los datos del backend.
      } catch (error) {
        console.error("Error fetching execution order:", error);
        // Opcional: mostrar un error en la UI.
      }
    };

    fetchModules();
  }, [showInactive, setModules]); // Se ejecuta al montar y cuando showInactive o setModules cambian.

  const handleToggleShowInactive = () => {
    setShowInactive(prev => !prev);
  };

  const handleToggleModuleCollapse = (moduleName: string) => {
    setCollapsedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  };
  // Efecto para hacer scroll automático en el área de logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handler para ejecutar las pruebas
  const handleRunTests = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setLogs(['Iniciando conexión con el servidor...']); // Limpia logs anteriores
    setScenarioStatuses({}); // Limpia los estados de escenarios de la ejecución anterior

    console.log("Iniciando ejecución de pruebas...");
    try {
      // 1. Inicia la ejecución en el backend
      const response = await fetch('/api/run-tests', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start test execution');
      }

      const result = await response.json();
      console.log(result.message); // "La ejecución de pruebas ha comenzado."
      setLogs(prev => [...prev, result.message]);

      // 2. Se conecta al stream de eventos para recibir logs
      const eventSource = new EventSource('/api/stream-logs');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Nuevo: Manejar eventos de estado de escenario
        if (data.type === 'scenario_status') {
          setScenarioStatuses(prev => ({
            ...prev,
            [data.name]: data.status,
          }));
          return; // No lo mostramos como un log normal
        }
        if (data.log === '---EXECUTION_FINISHED---') {
          setLogs(prev => [...prev, '--- Ejecución finalizada. Reporte disponible. ---']);
          setIsExecuting(false);
          eventSource.close(); // Cierra la conexión
          // Abre el reporte en una nueva pestaña si la URL está presente
          if (data.reportUrl) {
            window.open(data.reportUrl, '_blank');
          }
        } else if (data.log === '---EXECUTION_STOPPED_BY_USER---') {
          setLogs(prev => [...prev, '--- Ejecución finalizada ---']);
          setIsExecuting(false);
          eventSource.close(); // Cierra la conexión
        } else {
          setLogs(prev => [...prev, data.log]);
        }
      };

      eventSource.onerror = () => {
        setLogs(prev => [...prev, 'Error en la conexión de streaming. Se ha cerrado.']);
        setIsExecuting(false);
        eventSource.close();
      };
    } catch (error) {
      console.error("Error al iniciar la ejecución de pruebas:", error);
      setIsExecuting(false);
    }
  };

  // Handler para detener las pruebas
  const handleStopTests = async () => {
    console.log("Enviando solicitud para detener las pruebas...");
    try {
      const response = await fetch('/api/stop-tests', {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop test execution');
      }
      const result = await response.json();
      console.log(result.message);
      // No es necesario cambiar isExecuting aquí, el stream de logs lo hará.
    } catch (error) {
      console.error("Error al detener la ejecución:", error);
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
    setModules(prevModules =>
      prevModules.map(m =>
        m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m
      )
    );

    // Llama a la API para persistir el cambio
    try {
      const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFeaturesWithOrder), // Envía la lista con el orden ya corregido
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
    setModules(prev =>
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
    setModules(prev =>
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
            onClick={isExecuting ? handleStopTests : handleRunTests}
            disabled={isExecuting && !logs.length} // Deshabilita brevemente hasta que se conecta
          >
            {isExecuting ? <StopIcon /> : <PlayArrowIcon />}
          </Button>
        </Tooltip>
        <Tooltip title={showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}>
          <ToggleButton
            value="check"
            selected={showInactive}
            onChange={handleToggleShowInactive}
            size="small"
            sx={{ mr: 1 }}
          >
            {showInactive ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </ToggleButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}> {/* Contenedor con scroll y padding horizontal */}
        {Array.isArray(modules) && (
          <SortableContext 
            items={modules.map(m => m.module_name)}
            strategy={verticalListSortingStrategy}
            // Deshabilita el contexto de ordenación si el elemento arrastrado no es un 'module'.
            // Esto permite que los 'droppables' internos acepten elementos externos.
            disabled={active != null && active.data.current?.type !== 'module'}
          >
            {modules.map((module, index) => ( // Ahora iteramos directamente sobre 'modules'
              <SortableModule 
                key={module.module_name} 
                module={module}
                onTagToggle={(moduleName, featureId, tagName) => handleTagToggle(moduleName, featureId, tagName)}
                controls={
                  <>
                    <Tooltip title={collapsedModules.has(module.module_name) ? "Mostrar features" : "Ocultar features"}>
                      <IconButton onClick={() => handleToggleModuleCollapse(module.module_name)} size="small">
                        {collapsedModules.has(module.module_name) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </IconButton>
                    </Tooltip>
                    {/* Selector de color */}
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
                    <IconButton onClick={() => handleToggleModuleActivity(module.module_name, module.active)} size="small">
                      {module.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon color="action" />}
                    </IconButton>
                    <IconButton onClick={() => handleDeleteModule(module.module_name)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
                features={
                  !collapsedModules.has(module.module_name) && (
                    <Box sx={{ width: '100%' }}>
                      <SortableContext
                        id={module.module_name} // ¡LA CLAVE ESTÁ AQUÍ! Asignamos el nombre del módulo como ID.
                        items={module.features.map((f: FeatureItem) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {[...module.features] // Creamos una copia para no mutar el estado original
                          .sort((a, b) => a.order - b.order) // Ordenamos por la propiedad 'order'
                          .map((feature: FeatureItem, index: number) => (
                          <ExecutionItem
                            key={feature.id} item={feature} fontSize={fontSize}
                            onDoubleClick={(item) => {
                              // La ruta del feature ya es relativa al directorio 'features'.
                              const fullPath = [item.feature_dir, item.feature_file].filter(Boolean).join('/');
                              onFeatureSelect(fullPath);
                            }}
                            onDelete={() => handleDeleteFeature(module.module_name, feature)}
                            onMoveUp={() => handleMoveFeature(module.module_name, feature, 'up')}
                            onMoveDown={() => handleMoveFeature(module.module_name, feature, 'down')}
                            onTagClick={(featureId, tag) => handleTagToggle(module.module_name, featureId, tag)}
                            scenarioStatuses={scenarioStatuses}
                          />
                        ))}
                      </SortableContext>
                    </Box>
                  )
                }
              />
            ))}
          </SortableContext>
        )}
      </Box>
      {/* Área para mostrar los logs en tiempo real */}
      {logs.length > 1 && (
        <Paper 
          elevation={3} 
          sx={{ 
            mt: 2, 
            p: 2, 
            maxHeight: '200px', 
            overflowY: 'auto', 
            backgroundColor: 'black', 
            color: 'lightgray', 
            fontFamily: 'monospace',
            fontSize: '0.8rem'
          }}
        >
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
          {/* Elemento invisible para hacer scroll automático */}
          <div ref={logsEndRef} />
        </Paper>
      )}

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

export default ExecutionOrder;