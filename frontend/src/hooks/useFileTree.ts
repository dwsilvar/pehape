import React from 'react';
import { FileData } from '../types';

export const useFileTree = () => {
  const [files, setFiles] = React.useState<FileData[]>([]);
  const [expanded, setExpanded] = React.useState<string[]>([]);

  React.useEffect(() => {
    fetch('/api/features')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: FileData[]) => {
        setFiles(data);
        const folderIds: string[] = [];
        const collectFolderIds = (nodes: FileData[]) => {
          nodes.forEach((node: FileData) => {
            if (node.type === 'directory') {
              folderIds.push(node.path);
              if (node.children) collectFolderIds(node.children);
            }
          });
        };
        collectFolderIds(data);
        setExpanded(folderIds);
      })
      .catch(error => {
        console.error("Error al obtener los archivos de características:", error);
      });
  }, []);

  return { files, expanded, setExpanded };
};