import React, { useState } from 'react';
import { Box, Typography, Menu, MenuItem, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, DialogContentText, Divider, useTheme, CircularProgress } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem, treeItemClasses } from '@mui/x-tree-view/TreeItem';
import { styled, alpha } from '@mui/material/styles';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';

import { useDraggable } from '@dnd-kit/core';
import { useFileTree } from '../hooks/useFileTree';
import { FileData } from '../types';

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  fontSize: number;
}

// --- styled-components definiendo la estética VS Code ---

const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  // Estilo del contenido (la fila del archivo/carpeta)
  [`& .${treeItemClasses.content}`]: {
    borderRadius: 0,
    padding: '0px 0px 0px 8px', // Padding derecho explícito, left manejado por MUI
    minHeight: 22, // Altura ultra-compacta
    '&:hover': {
      backgroundColor: alpha(theme.palette.action.active, 0.04),
    },
    [`&.${treeItemClasses.selected}`]: {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
      '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.16),
      },
      [`& .${treeItemClasses.label}`]: {
        fontWeight: 500,
      },
    },
  },

  // Contenedor del icono (flecha + carpeta)
  [`& .${treeItemClasses.iconContainer}`]: {
    marginRight: 0,
    width: 'auto',
    display: 'flex',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
  },

  // Etiqueta de texto
  [`& .${treeItemClasses.label}`]: {
    fontSize: '13px', // Tamaño fijo legible
    fontFamily: 'Consolas, "Courier New", monospace',
    lineHeight: 1.5,
    paddingLeft: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Grupo de hijos (la lista anidada)
  [`& .${treeItemClasses.groupTransition}`]: {
    marginLeft: 12, // Indentación visual
    paddingLeft: 0,
    borderLeft: `1px solid ${theme.palette.divider}`, // Línea vertical sutil
  },
}));

// --------------------------------------------------------

/**
 * Elemento arrastrable que usa nuestro StyledTreeItem
 */
const DraggableTreeItem: React.FC<{
  node: FileData;
  fontSize: number;
  onContextMenu: (event: React.MouseEvent, node: FileData) => void;
}> = ({ node, fontSize, onContextMenu }) => {
  const isFile = node.type === 'file';
  const theme = useTheme();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `file-explorer-${node.path}`,
    data: {
      type: 'file-explorer-feature',
      path: node.path,
    },
    disabled: !isFile,
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
  };

  // Si es un archivo, aplicamos los listeners al contenedor del label.
  // Si es carpeta, no adjuntamos nada (no es draggable por ahora).
  const dragProps = isFile ? { ref: setNodeRef, ...listeners, ...attributes } : {};

  return (
    <StyledTreeItem
      style={style}
      key={node.path}
      itemId={node.path}
      label={
        <Box
          {...dragProps}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0,
            cursor: isFile ? 'grab' : 'default',
            // Asegurar que ocupe todo el espacio para facilitar el arrastre
            width: '100%'
          }}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          {isFile ? (
            <DescriptionIcon sx={{ mr: 0.5, fontSize: 16, color: 'info.main' }} />
          ) : (
            <FolderIcon sx={{ mr: 0.5, fontSize: 16, color: '#FFCA28' }} />
          )}

          <Typography
            variant="body2"
            sx={{
              fontSize: 'inherit',
              fontFamily: 'inherit',
              flexGrow: 1,
              userSelect: 'none' // Evitar selección de texto al arrastrar
            }}
          >
            {node.name}
          </Typography>
        </Box>
      }
    >
      {Array.isArray(node.children) ? renderTree(node.children, fontSize, onContextMenu) : null}
    </StyledTreeItem>
  );
};

const renderTree = (nodes: FileData[], fontSize: number, onContextMenu: (event: React.MouseEvent, node: FileData) => void) => {
  if (!nodes) return null;
  return nodes.map((node) => <DraggableTreeItem key={node.path} node={node} fontSize={fontSize} onContextMenu={onContextMenu} />);
};

/**
 * Preview para el drag and drop
 */
export const DraggableTreeItemPreview: React.FC<{ path: string }> = ({ path }) => {
  const fileName = path.split('/').pop() || path;
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      py: 0.5,
      px: 1,
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      boxShadow: 2
    }}>
      <DescriptionIcon sx={{ mr: 1, color: 'info.main', fontSize: 16 }} />
      <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'Consolas, monospace' }}>{fileName}</Typography>
    </Box>
  );
};

const FileExplorerComponent: React.FC<FileExplorerProps> = ({ onFileSelect, fontSize }) => {
  const { files, expanded, setExpanded, refreshFileTree, isLoading } = useFileTree();
  const theme = useTheme();

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

  const [newItemName, setNewItemName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; node: FileData | null }>({ open: false, node: null });

  // Manejo de Context Menu (sin cambios mayores)
  const handleContextMenu = (event: React.MouseEvent, node: FileData) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX - 2, mouseY: event.clientY - 4, node });
  };
  const handleCloseContextMenu = () => setContextMenu(null);

  // Manejo de Diálogos (sin cambios mayores)
  const handleOpenNewItemDialog = (type: 'file' | 'folder') => {
    if (!contextMenu) return;
    const basePath = contextMenu.node.type === 'directory'
      ? contextMenu.node.path
      : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'));
    setDialog({ open: true, type, basePath });
    handleCloseContextMenu();
  };
  const handleCloseDialog = () => { setDialog(null); setNewItemName(''); };

  const handleOpenDeleteDialog = () => {
    if (!contextMenu) return;
    setDeleteDialog({ open: true, node: contextMenu.node });
    handleCloseContextMenu();
  };
  const handleCloseDeleteDialog = () => setDeleteDialog({ open: false, node: null });

  // Funciones de API (Create/Delete)
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
      if (!response.ok) throw new Error(`Failed to create ${dialog.type}`);
      await refreshFileTree();
    } catch (e) { console.error(e); } finally { handleCloseDialog(); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.node) return;
    try {
      const response = await fetch(`/api/resource/${encodeURIComponent(deleteDialog.node.path)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Failed to delete`);
      await refreshFileTree();
    } catch (e) { console.error(e); } finally { handleCloseDeleteDialog(); }
  };

  const handleExpandedChange = (event: React.SyntheticEvent | null, ids: string[]) => setExpanded(ids);

  const handleItemClick = (event: React.MouseEvent, itemId: string) => {
    // Buscar nodo y notificar selección
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
    if (selectedNode && selectedNode.type === 'file') onFileSelect(itemId);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography
        variant="caption"
        sx={{
          px: 2,
          py: 1,
          fontWeight: 'bold',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 1,
          display: 'block'
        }}
      >
        Explorer
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Usamos una animación de carga si estamos cargando */}
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
            {/* Simulating a GIF loader with CircularProgress for now, as no GIF asset was found. */}
            <CircularProgress size={40} thickness={4} />
            <Typography variant="caption" color="text.secondary">Loading features...</Typography>
          </Box>
        ) : (
          <SimpleTreeView
            expandedItems={expanded}
            onExpandedItemsChange={handleExpandedChange}
            onItemClick={handleItemClick}
            // @ts-ignore - Propiedad clave para controlar la indentación base
            itemChildrenIndentation="12px"
          >
            {renderTree(files, fontSize, handleContextMenu)}
          </SimpleTreeView>
        )}
      </Box>

      {/* Menús y Diálogos (copiados logicamente igual) */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => handleOpenNewItemDialog('folder')}>New Folder</MenuItem>
        <MenuItem onClick={() => handleOpenNewItemDialog('file')}>New Feature File</MenuItem>
        <Divider />
        <MenuItem onClick={handleOpenDeleteDialog} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      <Dialog open={dialog?.open || false} onClose={handleCloseDialog}>
        <DialogTitle>Create {dialog?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Name" fullWidth variant="outlined" size="small"
            value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmNewItem()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmNewItem} variant="contained" disabled={!newItemName}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete <b>{deleteDialog.node?.name}</b>?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const FileExplorer = React.memo(FileExplorerComponent);
export default FileExplorer;