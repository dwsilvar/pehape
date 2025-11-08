import React from 'react';
import { Box, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';

import { useFileTree } from '../hooks/useFileTree';
import { FileData } from '../types';

interface FileExplorerProps {
  onFileSelect: (path: string) => void; // Cambiado para aceptar solo el path
  fontSize: number;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, fontSize }) => {
  // La lógica de datos ahora está encapsulada en el hook.
  const { files, expanded, setExpanded } = useFileTree();

  const handleExpandedChange = (event: React.SyntheticEvent, ids: string[]) => {
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

  const renderTree = (nodes: FileData[]) => {
    if (!nodes) {
      return null;
    }
    return nodes.map((node) =>
      node.type === 'file' ? (
        <TreeItem
          key={node.path}
          itemId={node.path}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DescriptionIcon sx={{ mr: 1, color: 'grey.700' }} />
              <Typography variant="body2" sx={{ fontSize: `${fontSize}px` }}>{node.name}</Typography>
            </Box>
          }
        />
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
        onItemClick={handleItemClick}
        >
        {renderTree(files)}
      </SimpleTreeView>
    </Box>
  );
};

export default FileExplorer;