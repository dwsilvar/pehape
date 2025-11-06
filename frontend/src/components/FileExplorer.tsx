import React from 'react';
import { Box, Typography, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import { useDraggable } from '@dnd-kit/core';

import { useFileTree } from '../hooks/useFileTree';
import { FileData } from '../types';

interface FileExplorerProps {
  onFileSelect: (file: FileData) => void;
  fontSize: number;
}

const DraggableTreeItem: React.FC<{ node: FileData; children?: React.ReactNode; fontSize: number; onClick: (event: React.MouseEvent, itemId: string) => void; }> = ({ node, children, fontSize, onClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-${node.path}`,
    data: {
      type: 'file',
      file: node,
    },
  });

  

  return (
    <ListItem
      ref={setNodeRef}
      component="div"
      disablePadding
      sx={{ pl: 4, opacity: isDragging ? 0.5 : 1, cursor: 'pointer' }} // Indentación para simular el árbol
      {...listeners}
      {...attributes}
      onClick={(e) => onClick(e, node.path)}
      >
      <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
        <DescriptionIcon />
      </ListItemIcon>
      <ListItemText primary={node.name} primaryTypographyProps={{ sx: { fontSize: `${fontSize}px` } }} />
    </ListItem>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, fontSize }) => {
  // La lógica de datos ahora está encapsulada en el hook.
  const { files, expanded, setExpanded } = useFileTree();

  const handleExpandedChange = (event: React.SyntheticEvent, ids: string[]) => {
    setExpanded(ids);
  };

  const handleItemClick = React.useCallback(
    (event: React.MouseEvent, itemId: string) => {
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
      if (selectedNode && selectedNode.type === 'file') {
        onFileSelect(selectedNode);
      }
    },
    [files, onFileSelect] // Dependencias del useCallback
  );

  const renderTree = (nodes: FileData[]) => {
    if (!nodes) {
      return null;
    }
    return nodes.map((node) =>
      node.type === 'file' ? (
        <DraggableTreeItem key={node.path} node={node} fontSize={fontSize} onClick={handleItemClick}/>
      ) : (
        <TreeItem
          key={node.path}
          itemId={node.path}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FolderIcon sx={{ mr: 1 }} />
              <Typography variant="body2" sx={{ fontSize: `${fontSize}px` }}>
                {node.name}
              </Typography>
            </Box>
          }
        >{renderTree(node.children || [])}</TreeItem>
      )
    );
  };

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Feature Browser
      </Typography>
      <SimpleTreeView
        expandedItems={expanded}
        onExpandedItemsChange={handleExpandedChange}
        >
        {renderTree(files)}
      </SimpleTreeView>
    </Box>
  );
};

export default FileExplorer;