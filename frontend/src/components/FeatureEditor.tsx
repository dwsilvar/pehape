import { FC, useState, useCallback } from 'react';
import { Box, Paper, Divider, Typography } from '@mui/material';
import Editor from '@monaco-editor/react';
import FileExplorer from './FileExplorer';
import ExecutionOrder from './ExecutionOrder';
import { FileData, ExecutionItem } from '../types';

interface FeatureEditorProps {
  // Props will be added as needed
}

export const FeatureEditor: FC<FeatureEditorProps> = () => {
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [executionItems, setExecutionItems] = useState<ExecutionItem[]>([]);
  const [editorContent, setEditorContent] = useState<string>('');

  const handleFileSelect = useCallback((file: FileData) => {
    setSelectedFile(file);
    // TODO: Load file content from backend
    setEditorContent('# Loading file content...');
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  }, []);

  const handleExecutionOrderChange = useCallback((newItems: ExecutionItem[]) => {
    setExecutionItems(newItems);
    // TODO: Save execution order to backend
  }, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* File Explorer */}
      <Paper
        elevation={2}
        sx={{
          width: 250,
          overflow: 'auto',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <FileExplorer onFileSelect={handleFileSelect} />
      </Paper>

      {/* Editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ p: 1 }}>
          {selectedFile?.name || 'No file selected'}
        </Typography>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Editor
            height="100%"
            defaultLanguage="gherkin"
            value={editorContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: true },
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              theme: 'vs-dark',
            }}
          />
        </Box>
      </Box>

      {/* Execution Order */}
      <Paper
        elevation={2}
        sx={{
          width: 300,
          overflow: 'auto',
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        <ExecutionOrder items={executionItems} onOrderChange={handleExecutionOrderChange} />
      </Paper>
    </Box>
  );
};

export default FeatureEditor;