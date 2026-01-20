import { FC, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { FileData } from '../types';
import { ImageUploadDialog } from './ImageUploadDialog';

interface FeatureEditorProps {
  selectedFile: FileData | null;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  theme: string; // Nueva prop para el tema
  onSave: () => void; // Nueva prop para guardar
  isDirty: boolean; // Nueva prop para saber si hay cambios
  isResizing: boolean; // Nueva prop para saber si se está redimensionando
}

export const FeatureEditor: FC<FeatureEditorProps> = ({ selectedFile, editorContent, onEditorChange, theme, onSave, isDirty, isResizing }) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [detectedTag, setDetectedTag] = useState<string | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editor.addAction({
      id: 'upload-ocr-image',
      label: 'Upload OCR Image',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        if (model && selection && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);

          // Heuristic to find the nearest tag upwards
          let tag = null;
          for (let i = selection.startLineNumber; i >= 1; i--) {
            const lineContent = model.getLineContent(i).trim();
            if (lineContent.startsWith('@')) {
              // Extract the first tag if multiple
              const tags = lineContent.split(/\s+/);
              tag = tags[0];
              break;
            }
          }

          setSelectedText(text);
          setDetectedTag(tag);
          setUploadDialogOpen(true);
        }
      }
    });
  };

  const handleUploadImage = async (text: string, tag: string, file: File) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('feature_path', selectedFile.path); // Relative path from features root
    formData.append('tag', tag);
    formData.append('text', text);
    formData.append('file', file);

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {isResizing && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10, // Asegura que esté por encima del editor
            backgroundColor: 'rgba(0,0,0,0.0)', // Transparente pero captura eventos
          }}
        />
      )}
      {selectedFile && (
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {selectedFile.path}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={!isDirty}
          >
            Guardar
          </Button>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}> {/* minHeight: 0 is crucial for child's scroll */}
        <MonacoEditor
          height="100%"
          value={selectedFile ? editorContent : '-- Select a file to view its content --'}
          onChange={onEditorChange}
          options={{
            minimap: { enabled: true },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: !selectedFile,
            theme: theme,
            useShadowDOM: false, // ¡Esta es la clave! Evita que Mónaco cree un iframe que capture los eventos del ratón.
          }}
          onMount={handleEditorDidMount}
          language={selectedFile ? 'gherkin' : undefined}
        />
      </Box>
      <ImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        initialText={selectedText}
        initialTag={detectedTag}
        featurePath={selectedFile?.path || ''}
        onUpload={handleUploadImage}
      />
    </Box >
  );
};