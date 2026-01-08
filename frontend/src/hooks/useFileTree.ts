import { useState, useEffect, useCallback } from 'react';
import { FileData } from '../types';

export const useFileTree = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Encapsulamos la lógica de fetch en una función que podemos reutilizar.
  const fetchFileTree = useCallback(async () => {
    setIsLoading(true);
    setIsLoading(true);
    try {
      const response = await fetch('/api/features');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: FileData[] = await response.json();
      setFiles(data);
      // Auto-expandir todas las carpetas al cargar
      const folderIds: string[] = [];
      const collectFolderIds = (nodes: FileData[]) => {
        nodes.forEach((node) => {
          if (node.type === 'directory' && node.children) {
            folderIds.push(node.path);
            collectFolderIds(node.children);
          }
        });
      };
      collectFolderIds(data);
      setExpanded(folderIds);
    } catch (error) {
      console.error("Failed to fetch file tree:", error);
      setFiles([]); // En caso de error, mostrar un árbol vacío.
    } finally {
      setIsLoading(false);
    }
  }, []); // No tiene dependencias, por lo que no se recreará.

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  // Exponemos la función 'fetchFileTree' con el alias 'refreshFileTree'.
  return { files, expanded, setExpanded, refreshFileTree: fetchFileTree, isLoading };
};