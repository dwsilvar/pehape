import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Menu, MenuItem, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, DialogContentText, Divider, useTheme, CircularProgress, InputAdornment, IconButton, Snackbar, Alert } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem, treeItemClasses } from '@mui/x-tree-view/TreeItem';
import { styled, alpha } from '@mui/material/styles';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';

import { useDraggable, useDroppable, useDndMonitor } from '@dnd-kit/core';
import { useFileTree } from '../hooks/useFileTree';
import { FileData } from '../types';
import { useTranslation } from 'react-i18next';

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  fontSize: number;
  onRefreshModules?: () => Promise<void>;
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

const DraggableTreeItem: React.FC<{
  node: FileData;
  fontSize: number;
  onContextMenu: (event: React.MouseEvent, node: FileData) => void;
}> = ({ node, fontSize, onContextMenu }) => {
  const isFile = node.type === 'file';
  const theme = useTheme();

  // Drag config
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `file-explorer-${node.path}`,
    data: {
      type: 'file-explorer-feature',
      path: node.path,
      resourceType: node.type,
    },
  });

  // Drop config (folders only)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `file-explorer-drop-${node.path}`,
    data: {
      type: 'file-explorer-folder',
      path: node.path,
    },
    disabled: isFile,
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isOver ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
    outline: isOver ? `1px dashed ${theme.palette.primary.main}` : 'none',
  };

  const setCombinedRef = (element: HTMLElement | null) => {
    setDragRef(element);
    if (!isFile) setDropRef(element);
  };

  return (
    <StyledTreeItem
      sx={style}
      key={node.path}
      itemId={node.path}
      label={
        <Box
          ref={setCombinedRef}
          {...listeners}
          {...attributes}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0,
            cursor: 'grab',
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
              userSelect: 'none'
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
export const DraggableTreeItemPreview: React.FC<{ path: string, type?: 'file' | 'directory' }> = ({ path, type = 'file' }) => {
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
      {type === 'file' ? (
        <DescriptionIcon sx={{ mr: 1, color: 'info.main', fontSize: 16 }} />
      ) : (
        <FolderIcon sx={{ mr: 1, color: '#FFCA28', fontSize: 16 }} />
      )}
      <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'Consolas, monospace' }}>{fileName}</Typography>
    </Box>
  );
};

const FileExplorerComponent: React.FC<FileExplorerProps> = ({ onFileSelect, fontSize, onRefreshModules }) => {
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
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; node: FileData | null }>({ open: false, node: null });
  const [renameValue, setRenameValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  const { t } = useTranslation();

  // --- Move Resource Logic (DndMonitor) ---
  useDndMonitor({
    onDragEnd: async (event) => {
      const { active, over } = event;
      if (!over) return;

      const isExplorerDrag = active.data.current?.type === 'file-explorer-feature';
      const isExplorerDropTarget = over.data.current?.type === 'file-explorer-folder';

      if (isExplorerDrag && isExplorerDropTarget) {
        const sourcePath = active.data.current?.path;
        const targetDirPath = over.data.current?.path;

        if (sourcePath && targetDirPath !== undefined) {
          // Prevent moving to the same directory
          const currentDir = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : '';
          if (currentDir === targetDirPath) return;

          try {
            const response = await fetch(`/api/resource/${encodeURIComponent(sourcePath)}/move`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ destination_dir: targetDirPath }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || t('common.move_error'));
            }

            const result = await response.json();

            // Determine notification message
            let notificationKey = '';
            let interpolationParams: any = {};

            if (result.images_migrated && result.modules_updated) {
              notificationKey = 'common.move_success_complete';
              interpolationParams = {
                imageCount: result.images_migrated.count,
                moduleCount: result.modules_updated.count,
                modules: result.modules_updated.modules.join(', ')
              };
            } else if (result.images_migrated) {
              notificationKey = 'common.move_success_with_images';
              interpolationParams = { count: result.images_migrated.count };
            } else if (result.modules_updated) {
              notificationKey = 'common.move_success_with_modules';
              interpolationParams = {
                count: result.modules_updated.count,
                modules: result.modules_updated.modules.join(', ')
              };
            } else {
              notificationKey = 'common.move_success';
            }

            setSnackbar({
              open: true,
              message: String(t(notificationKey, interpolationParams)),
              severity: 'success'
            });

            // Refresh tree and modules
            await refreshFileTree();
            if (onRefreshModules) await onRefreshModules();

          } catch (error) {
            console.error('Error moving resource:', error);
            setSnackbar({
              open: true,
              message: error instanceof Error ? error.message : String(t('common.move_error')),
              severity: 'error'
            });
          }
        }
      }
    }
  });

  // Root droppable config
  const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({
    id: 'file-explorer-root',
    data: {
      type: 'file-explorer-folder',
      path: '', // Root path
    }
  });

  // --- Search Logic ---
  const filterFileTree = useCallback((nodes: FileData[], term: string): FileData[] => {
    if (!term) return nodes;
    const lowerTerm = term.toLowerCase();

    return nodes
      .map(node => {
        if (node.type === 'file') {
          return node.name.toLowerCase().includes(lowerTerm) ? node : null;
        }
        const filteredChildren = filterFileTree(node.children || [], term);
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerTerm)) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((node): node is FileData => node !== null);
  }, []);

  const filteredFiles = useMemo(() => filterFileTree(files, searchTerm), [files, searchTerm, filterFileTree]);

  // Expand folders that contain matches
  useEffect(() => {
    if (searchTerm && filteredFiles.length > 0) {
      const getPatsToExpand = (nodes: FileData[]): string[] => {
        let paths: string[] = [];
        nodes.forEach(node => {
          if (node.type === 'directory' && node.children && node.children.length > 0) {
            paths.push(node.path);
            paths = [...paths, ...getPatsToExpand(node.children)];
          }
        });
        return paths;
      };
      setExpanded(getPatsToExpand(filteredFiles));
    }
  }, [searchTerm, filteredFiles, setExpanded]);

  // --- Handlers ---
  const handleContextMenu = (event: React.MouseEvent, node: FileData) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      node,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleOpenNewItemDialog = (type: 'file' | 'folder') => {
    if (!contextMenu) return;
    const node = contextMenu.node;
    const basePath = node.type === 'directory' ? node.path : (node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '');

    setDialog({ open: true, type, basePath });
    setNewItemName('');
    handleCloseContextMenu();
  };

  const handleCloseDialog = () => {
    setDialog(null);
  };

  const handleConfirmNewItem = async () => {
    if (!dialog || !newItemName) return;

    try {
      const url = dialog.type === 'file' ? '/api/files' : '/api/directories';
      const path = dialog.basePath ? `${dialog.basePath}/${newItemName}` : newItemName;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create item');
      }

      await refreshFileTree();
      handleCloseDialog();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error creating item');
    }
  };

  const handleOpenDeleteDialog = () => {
    if (contextMenu) {
      setDeleteDialog({ open: true, node: contextMenu.node });
    }
    handleCloseContextMenu();
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, node: null });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.node) return;

    try {
      const response = await fetch(`/api/resource/${encodeURIComponent(deleteDialog.node.path)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete item');
      }

      await refreshFileTree();
      handleCloseDeleteDialog();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error deleting item');
    }
  };

  const handleOpenRenameDialog = () => {
    if (contextMenu) {
      const node = contextMenu.node;
      setRenameDialog({ open: true, node });
      const name = node.type === 'file' && node.name.endsWith('.feature')
        ? node.name.slice(0, -8)
        : node.name;
      setRenameValue(name);
    }
    handleCloseContextMenu();
  };

  const handleCloseRenameDialog = () => {
    setRenameDialog({ open: false, node: null });
  };

  const handleConfirmRename = async () => {
    if (!renameDialog.node || !renameValue) return;

    try {
      const response = await fetch(`/api/resource/${encodeURIComponent(renameDialog.node.path)}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: renameValue }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename');
      }
      const result = await response.json();

      let notificationKey = '';
      let interpolationParams: any = {};

      if (result.images_migrated && result.modules_updated) {
        notificationKey = 'common.rename_success_complete';
        interpolationParams = {
          imageCount: result.images_migrated.count,
          moduleCount: result.modules_updated.count,
          modules: result.modules_updated.modules.join(', ')
        };
      } else if (result.images_migrated) {
        notificationKey = 'common.rename_success_with_images';
        interpolationParams = { count: result.images_migrated.count };
      } else if (result.modules_updated) {
        notificationKey = 'common.rename_success_with_modules';
        interpolationParams = {
          count: result.modules_updated.count,
          modules: result.modules_updated.modules.join(', ')
        };
      } else {
        notificationKey = 'common.rename_success';
      }

      if (notificationKey) {
        setSnackbar({
          open: true,
          message: String(t(notificationKey, interpolationParams)),
          severity: 'success'
        });
      }

      if (result.migration_warnings && result.migration_warnings.length > 0) {
        const warnings = result.migration_warnings.join('\n');
        setSnackbar({
          open: true,
          message: String(t('common.rename_warning', { warnings })),
          severity: 'warning'
        });
      }

      await refreshFileTree();
      if (onRefreshModules) await onRefreshModules();
    } catch (e) {
      console.error(e);
      setSnackbar({
        open: true,
        message: e instanceof Error ? e.message : String(t('common.rename_error')),
        severity: 'error'
      });
    } finally {
      handleCloseRenameDialog();
    }
  };

  const handleExpandedChange = (event: React.SyntheticEvent | null, itemIds: string[]) => {
    setExpanded(itemIds);
  };

  const handleItemClick = (event: React.SyntheticEvent, itemId: string) => {
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
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search features..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} disabled={!searchTerm}>
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              height: 28,
              fontSize: '12px',
              backgroundColor: alpha(theme.palette.action.active, 0.05),
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused fieldset': { border: `1px solid ${theme.palette.primary.main}` },
              pl: 1,
            },
            '& .MuiInputBase-input': {
              py: 0.5,
              px: 0.5,
            }
          }}
        />
      </Box>

      <Box
        ref={setRootDropRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isOverRoot ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
          outline: isOverRoot ? `2px dashed ${theme.palette.primary.main}` : 'none',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
            <CircularProgress size={40} thickness={4} />
            <Typography variant="caption" color="text.secondary">Loading features...</Typography>
          </Box>
        ) : (
          <SimpleTreeView
            expandedItems={expanded}
            onExpandedItemsChange={handleExpandedChange}
            onItemClick={handleItemClick}
            // @ts-ignore
            itemChildrenIndentation="12px"
          >
            {renderTree(filteredFiles, fontSize, handleContextMenu)}
          </SimpleTreeView>
        )}
      </Box>

      {/* Menus and Dialogs */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => handleOpenNewItemDialog('folder')}>New Folder</MenuItem>
        <MenuItem onClick={() => handleOpenNewItemDialog('file')}>New Feature File</MenuItem>
        <Divider />
        <MenuItem onClick={handleOpenRenameDialog}>Rename</MenuItem>
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

      <Dialog open={renameDialog.open} onClose={handleCloseRenameDialog}>
        <DialogTitle>Rename {renameDialog.node?.type === 'file' ? 'File' : 'Folder'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="New Name" fullWidth variant="outlined" size="small"
            value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
            helperText={renameDialog.node?.type === 'file' ? 'Extension .feature will be added automatically' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRenameDialog}>Cancel</Button>
          <Button onClick={handleConfirmRename} variant="contained" disabled={!renameValue}>Rename</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const FileExplorer = React.memo(FileExplorerComponent);
export default FileExplorer;