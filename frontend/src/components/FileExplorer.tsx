import React from 'react';
import { Box, Typography } from '@mui/material';
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
const DraggableTreeItem: React.FC<{ node: FileData; fontSize: number }> = ({ node, fontSize }) => {
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* El ícono de arrastre solo aparece para los archivos y es el que tiene los listeners */}
          {isFile ? (
            <Box
              ref={setNodeRef}
              {...listeners}
              {...attributes}
              sx={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                mr: 1,
                color: 'action.active'
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </Box>
          ) : (
            <Box sx={{ width: 24, mr: 1 }} /> // Espaciador para alinear carpetas y archivos
          )}
          {isFile ? <DescriptionIcon sx={{ mr: 1, color: 'grey.700' }} /> : <FolderIcon sx={{ mr: 1 }} />}
          <Typography variant="body2" sx={{ fontSize: `${fontSize}px` }}>{node.name}</Typography>
        </Box>
      }
    >
      {/* Renderiza los hijos si es un directorio */}
      {Array.isArray(node.children) ? renderTree(node.children, fontSize) : null}
    </TreeItem>
  );
};

// Función de renderizado movida fuera del componente principal para poder ser llamada recursivamente
const renderTree = (nodes: FileData[], fontSize: number) => {
  if (!nodes) {
    return null;
  }
  return nodes.map((node) => <DraggableTreeItem key={node.path} node={node} fontSize={fontSize} />);
};

/**
 * Componente de previsualización para el DragOverlay.
 * Muestra solo el ícono y el nombre del archivo.
 */
const DraggableTreeItemPreview: React.FC<{ path: string }> = ({ path }) => {
  const fileName = path.split('/').pop() || path;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <DragIndicatorIcon fontSize="small" sx={{ mr: 1, cursor: 'grabbing' }} />
      <DescriptionIcon sx={{ mr: 1, color: 'grey.700' }} />
      <Typography variant="body2">{fileName}</Typography>
    </Box>
  );
};

// Definimos un tipo para nuestro componente que incluye la propiedad estática.
type FileExplorerComponent = React.FC<FileExplorerProps> & {
  DraggableTreeItemPreview: React.FC<{ path: string }>;
};

// Usamos el nuevo tipo para el componente.
const FileExplorer: FileExplorerComponent = ({ onFileSelect, fontSize }) => {
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
        {renderTree(files, fontSize)}
      </SimpleTreeView>
    </Box>
  );
};

// Exportamos el componente de previsualización para que MainLayout pueda usarlo.
FileExplorer.DraggableTreeItemPreview = DraggableTreeItemPreview;

export default FileExplorer;