import React, { useState } from 'react';
import { Box, Typography, Menu, MenuItem, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, DialogContentText, Divider } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import { useDraggable } from '@dnd-kit/core';
import { useFileTree } from '../hooks/useFileTree';
import { FileData } from '../types';

interface FileExplorerProps {
  onFileSelect: (path: string) => void; // Cambiado para aceptar solo el path
  fontSize: number;
}

/**
 * Componente que envuelve un TreeItem de MUI para hacerlo arrastrable.
 * Solo los elementos de tipo 'file' serán arrastrables.
 */
const DraggableTreeItem: React.FC<{
  node: FileData;
  fontSize: number;
  onContextMenu: (event: React.MouseEvent, node: FileData) => void;
}> = ({ node, fontSize, onContextMenu }) => {
  const isFile = node.type === 'file';
  
  // Configura el elemento como arrastrable solo si es un archivo .feature
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `file-explorer-${node.path}`, // ID único para el elemento arrastrable
    data: {
      type: 'file-explorer-feature', // Tipo para identificarlo en onDragEnd
      path: node.path,               // El path que necesita el backend
    },
    disabled: !isFile, // Deshabilita el arrastre para directorios
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TreeItem
      style={style}
      key={node.path}
      itemId={node.path}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center' }} onContextMenu={(e) => onContextMenu(e, node)}>
          {isFile ? (
            <Box
              ref={setNodeRef}
              {...listeners}
              {...attributes}
              sx={{
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  ml: '0px', // Margen izquierdo para alinear con el icono de carpeta
                  mr: '1px', // Margen derecho reducido para acercar al icono de archivo
                  color: 'action.active'
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </Box>
          ) : (
            <Box sx={{ width: '0px', mr: '0px' }} /> // Espaciador para alinear carpetas y archivos
          )}
          {isFile ? <DescriptionIcon sx={{ mr: 1, color: 'grey.700' }} /> : <FolderIcon sx={{ mr: 1 }} />}
          <Typography variant="body2" sx={{ fontSize: `${fontSize}px` }}>{node.name}</Typography>
        </Box>
      }
    >
      {/* Renderiza los hijos si es un directorio */}
      {Array.isArray(node.children) ? renderTree(node.children, fontSize, onContextMenu) : null}
    </TreeItem>
  );
};

// Función de renderizado movida fuera del componente principal para poder ser llamada recursivamente
const renderTree = (nodes: FileData[], fontSize: number, onContextMenu: (event: React.MouseEvent, node: FileData) => void) => {
  if (!nodes) {
    return null;
  }
  return nodes.map((node) => <DraggableTreeItem key={node.path} node={node} fontSize={fontSize} onContextMenu={onContextMenu} />);
};

/**
 * Componente de previsualización para el DragOverlay.
 * Muestra solo el ícono y el nombre del archivo.
 */
export const DraggableTreeItemPreview: React.FC<{ path: string }> = ({ path }) => {
  const fileName = path.split('/').pop() || path;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <DragIndicatorIcon fontSize="small" sx={{ mr: 1, cursor: 'grabbing' }} />
      <DescriptionIcon sx={{ mr: 1, color: 'grey.700' }} />
      <Typography variant="body2">{fileName}</Typography>
    </Box>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, fontSize }) => {
  // La lógica de datos ahora está encapsulada en el hook.
  const { files, expanded, setExpanded, refreshFileTree } = useFileTree();

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    node: FileData;
  } | null>(null);

  const [dialog, setDialog] = useState<{
    open: boolean;
    type: 'file' | 'folder';
    basePath: string;
  } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    node: FileData | null;
  }>({ open: false, node: null });

  const [newItemName, setNewItemName] = useState('');

  const handleContextMenu = (event: React.MouseEvent, node: FileData) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      node: node,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleOpenNewItemDialog = (type: 'file' | 'folder') => {
    if (!contextMenu) return;

    // Si se hace clic derecho en un archivo, la base es su directorio padre.
    // Si se hace clic en una carpeta, la base es esa misma carpeta.
    const basePath = contextMenu.node.type === 'directory'
      ? contextMenu.node.path
      : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'));

    setDialog({
      open: true,
      type,
      basePath,
    });
    handleCloseContextMenu();
  };

  const handleCloseDialog = () => {
    setDialog(null);
    setNewItemName('');
  };

  const handleOpenDeleteDialog = () => {
    if (!contextMenu) return;
    setDeleteDialog({ open: true, node: contextMenu.node });
    handleCloseContextMenu();
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, node: null });
  };

  const handleConfirmNewItem = async () => {
    if (!newItemName || !dialog) return;

    const fullPath = dialog.basePath ? `${dialog.basePath}/${newItemName}` : newItemName;
    const endpoint = dialog.type === 'folder' ? '/api/directories' : '/api/files';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create ${dialog.type}`);
      }

      // Si la creación es exitosa, refrescamos el árbol de archivos
      await refreshFileTree();

    } catch (error) {
      console.error(`Error creating ${dialog.type}:`, error);
      // Aquí podrías mostrar una notificación de error al usuario
    } finally {
      handleCloseDialog();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.node) return;

    const path = deleteDialog.node.path;
    const type = deleteDialog.node.type;
    const endpoint = `/api/resource/${encodeURIComponent(path)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete ${type}`);
      }

      await refreshFileTree();

    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
    } finally {
      handleCloseDeleteDialog();
    }
  };

  const handleExpandedChange = (event: React.SyntheticEvent | null, ids: string[]) => {
    setExpanded(ids);
  };

  // Lógica simplificada: onItemClick ahora solo pasa el itemId (path) al padre.
  // Se elimina la necesidad de useCallback aquí, ya que la lógica es directa.
  const handleItemClick = (
    event: React.MouseEvent, // El evento es proporcionado por MUI, aunque no lo usemos.
    itemId: string // El path del archivo clickeado.
  ) => {
    // Función recursiva para encontrar el nodo por su path en el árbol de archivos.
    const findNode = (nodes: FileData[], path: string): FileData | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNode(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    const selectedNode = findNode(files, itemId);

    // Solo llama a onFileSelect si el nodo encontrado es un archivo.
    if (selectedNode && selectedNode.type === 'file') {
      onFileSelect(itemId);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Feature Browser
      </Typography>
      <SimpleTreeView
        expandedItems={expanded}
        onExpandedItemsChange={handleExpandedChange}
        onItemClick={handleItemClick}
        >
        {renderTree(files, fontSize, handleContextMenu)}
      </SimpleTreeView>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleOpenNewItemDialog('folder')}>Nueva Carpeta</MenuItem>
        <MenuItem onClick={() => handleOpenNewItemDialog('file')}>Nuevo Archivo Feature</MenuItem>
        <Divider />
        <MenuItem onClick={handleOpenDeleteDialog} sx={{ color: 'error.main' }}>Eliminar</MenuItem>
      </Menu>

      <Dialog open={dialog?.open || false} onClose={handleCloseDialog}>
        <DialogTitle>
          {dialog?.type === 'folder' ? 'Crear Nueva Carpeta' : 'Crear Nuevo Archivo Feature'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Nombre"
            type="text"
            fullWidth
            variant="standard"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmNewItem();
              }
            }}
            helperText={
              dialog?.type === 'file'
                ? "No es necesario añadir .feature"
                : `Se creará dentro de: ${dialog?.basePath || 'raíz'}`
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleConfirmNewItem} disabled={!newItemName}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar 
            <strong>{` "${deleteDialog.node?.name}"`}</strong>
            ? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancelar</Button>
          <Button onClick={handleConfirmDelete} color="error">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


export default FileExplorer;