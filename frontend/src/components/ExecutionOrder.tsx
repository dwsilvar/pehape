import React, { useState, useMemo } from 'react';
import { // Importa los componentes necesarios para el diálogo
  Box,
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
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useExecutionOrder } from '../hooks/useExecutionOrder';
import { Module, FeatureItem } from '../types'; // Importar tipos centralizados
interface ExecutionItemProps {
  item: FeatureItem;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  fontSize: number;
  onDoubleClick: (item: FeatureItem) => void;
}

const DEFAULT_FEATURE_COLOR = '#5a5a5a'; // Color gris por defecto para features

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  onMoveUp,
  onMoveDown,
  fontSize,
  onDoubleClick,
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
        {...attributes}
        {...listeners}
        onDoubleClick={() => onDoubleClick(item)}
        onContextMenu={handleContextMenu}
        sx={{
          p: 1,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          opacity: isDragging ? 0.5 : 1,
          cursor: 'pointer', // Cambiado de 'grab' a 'pointer' para indicar interactividad
          backgroundColor: 'background.default', // Usar color del tema
          borderLeft: `5px solid ${item.color || DEFAULT_FEATURE_COLOR}`, // Borde de color
        }}
      >
        <Box sx={{ flexGrow: 1, ml: 1 }}>
          <Typography sx={{ fontSize: `${fontSize}px` }}>
            {item.feature_file}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {`Orden: ${item.order} - ${item.active ? 'Activo' : 'Inactivo'}`}
          </Typography>
        </Box>
        <IconButton key={`${item.id}-up`} edge="end" onClick={onMoveUp} size="small">
          <KeyboardArrowUpIcon />
        </IconButton>
        <IconButton key={`${item.id}-down`} edge="end" onClick={onMoveDown} size="small">
          <KeyboardArrowDownIcon />
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
      </Menu>
    </>
  );
};

const SortableModule: React.FC<{
  module: Module;
  controls: React.ReactNode;
  features: React.ReactNode;
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

  return (
    <Box ref={setNodeRef} style={style} sx={{ position: 'relative' }}>
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
      <Paper elevation={2} sx={{ mb: 2, p: 2, pl: 4, backgroundColor: 'background.paper' }}>
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

const DEFAULT_MODULE_COLOR = '#63a4ff'; // Un azul suave por defecto para módulos

const ExecutionOrder: React.FC<ExecutionOrderProps> = ({ fontSize, isDropTarget, onAddFeature, onFeatureSelect, modules, setModules }) => {
  const { setNodeRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  const [showInactive, setShowInactive] = useState(true);

  const handleToggleShowInactive = () => {
    setShowInactive(prev => !prev);
  };

  const visibleModules = useMemo(() => {
    const sortedModules = [...modules].sort((a, b) => {
      if (a.active === b.active) return a.order - b.order; // Mantener orden entre activos/inactivos
      return a.active ? -1 : 1; // Activos primero
    });
    return showInactive ? sortedModules : sortedModules.filter(m => m.active);
  }, [modules, showInactive]);
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

  return (
    <Box ref={setNodeRef} sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" flex={1} sx={{ fontSize: `${fontSize}px` }}>
          Execution Order
        </Typography>
        <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleOpenDialog}>
          Agregar Módulo
        </Button>
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
        {Array.isArray(visibleModules) && (
          <SortableContext items={visibleModules.map(m => m.module_name)} strategy={verticalListSortingStrategy}>
            {visibleModules.map((module, index) => ( // La interfaz de 'module' viene del hook useExecutionOrder
              <SortableModule 
                key={module.module_name} 
                module={module}
                controls={
                  <>
                    <IconButton onClick={() => handleToggleModuleActivity(module.module_name, module.active)} size="small">
                      {module.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon color="action" />}
                    </IconButton>
                    <IconButton onClick={() => handleDeleteModule(module.module_name)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
                features={
                  <Box sx={{ width: '100%' }}>
                    <SortableContext items={module.features.map((f: FeatureItem) => f.id)} strategy={verticalListSortingStrategy}>
                      {module.features.map((feature: FeatureItem) => (
                        <ExecutionItem
                          key={feature.id} item={feature} fontSize={fontSize}
                          onDoubleClick={(item) => {
                            const pathParts = [module.module_dir, item.feature_dir, item.feature_file].filter(Boolean);
                            onFeatureSelect(pathParts.join('/'));
                          }}
                        />
                      ))}
                    </SortableContext>
                  </Box>
                }
              />
            ))}
          </SortableContext>
        )}
      </Box>
      {isDropTarget && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
          }}
        >
          <Button variant="contained" onClick={onAddFeature}>Agregar Feature</Button>
        </Box>
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