import React from 'react';
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
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SaveIcon from '@mui/icons-material/Save';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useExecutionOrder } from '../hooks/useExecutionOrder';

interface FeatureItem {
  id: string;
  feature_file: string;
  order: number;
  active: boolean;
}

interface ExecutionItemProps {
  item: FeatureItem;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  fontSize: number;
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
  item,
  onMoveUp,
  onMoveDown,
  fontSize,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      secondaryAction={
        <>
          <IconButton key={`${item.id}-up`} edge="end" onClick={onMoveUp} size="small">
            <KeyboardArrowUpIcon />
          </IconButton>
          <IconButton key={`${item.id}-down`} edge="end" onClick={onMoveDown} size="small">
            <KeyboardArrowDownIcon />
          </IconButton>
        </>
      }
    >
      <ListItemText
        primary={item.feature_file}
        primaryTypographyProps={{ sx: { fontSize: `${fontSize}px` } }}
        secondary={`#${item.order} ${item.active ? '✓' : '✗'}`}
      />
    </ListItem>
  );
};

interface ExecutionOrderProps {
  fontSize: number;
  isDropTarget: boolean;
  onAddFeature: () => void;
}

const ExecutionOrder: React.FC<ExecutionOrderProps> = ({ fontSize, isDropTarget, onAddFeature }) => {
  const { setNodeRef } = useDroppable({
    id: 'execution-order-droppable-area',
  });

  // La lógica de datos ahora está encapsulada en el hook.
  const { modules, setModules, handleSave } = useExecutionOrder();

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
    <Box ref={setNodeRef} sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="subtitle1" flex={1} sx={{ fontSize: `${fontSize}px` }}>
          Execution Order
        </Typography>
        <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={handleOpenDialog}>
          Agregar Módulo
        </Button>
        <IconButton onClick={handleSave} size="small">
          <SaveIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}> {/* Contenedor con scroll */}
        <SortableContext items={modules.flatMap(m => m.features.map((f: FeatureItem) => f.id))} strategy={verticalListSortingStrategy}>
          <Box>
            {modules.map((module, index) => (
              <Paper key={module.module_name} elevation={2} sx={{ mb: 2, p: 2 }}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ fontSize: `${fontSize + 2}px`, flexGrow: 1 }}>
                    {`${index + 1}. ${module.module_name}`}
                  </Typography>
                  <IconButton onClick={() => handleToggleModuleActivity(module.module_name, module.active)} size="small">
                    {module.active ? (
                      <ToggleOnIcon color="success" />
                    ) : (
                      <ToggleOffIcon color="action" />
                    )}
                  </IconButton>
                  <IconButton onClick={() => handleDeleteModule(module.module_name)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <List dense>
                  {module.features.map((feature: FeatureItem) => (
                    <ExecutionItem
                      key={feature.id}
                      item={feature}
                      fontSize={fontSize}
                    />
                  ))}
                </List>
              </Paper>
            ))}
          </Box>
        </SortableContext>
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
            label="Nombre del Módulo"
            type="text"
            fullWidth
            variant="standard"
            value={newModuleName}
            onChange={(e) => setNewModuleName(e.target.value)}
          />
          <TextField
            margin="dense"
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