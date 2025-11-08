import { FC } from 'react';
import { Box } from '@mui/material';
import Editor, { OnMount } from '@monaco-editor/react';
import { FileData } from '../types';

interface FeatureEditorProps {
  selectedFile: FileData | null;
  editorContent: string;
  onEditorChange: (value: string | undefined) => void;
  theme: string; // Nueva prop para el tema
}

export const FeatureEditor: FC<FeatureEditorProps> = ({ selectedFile, editorContent, onEditorChange, theme }) => {
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    const applyTheme = async (themeName: string) => {
      // El tema 'vs-dark' es nativo, no necesita importación.
      if (themeName === 'vs-dark') {
        monaco.editor.setTheme(themeName);
        return;
      }

      try {
        // Importación dinámica del archivo de tema.
        const themeData = await import(`monaco-themes/themes/${themeName.replace(/-/g, ' ')}.json`);
        monaco.editor.defineTheme(themeName, themeData);
        monaco.editor.setTheme(themeName);
      } catch (error) {
        console.error(`Failed to load theme ${themeName}:`, error);
        monaco.editor.setTheme('vs-dark'); // Fallback a un tema seguro
      }
    };

    applyTheme(theme);
    // Assign a unique ID to the editor's internal textarea for accessibility
    // and to prevent browser warnings about form fields without a name.
    const editorElement = editor.getDomNode();
    if (editorElement) {
      const textarea = editorElement.querySelector('textarea');
      if (textarea) {
        textarea.id = 'feature-editor-textarea';
      }
    }
  };

  // Este efecto se asegura de que el tema se actualice si cambia mientras el editor ya está montado.
  const handleEditorWillMount: OnMount = (editor, monaco) => {
    // Esto es un truco para tener la instancia de monaco disponible fuera del onMount
    (window as any).monacoInstance = monaco;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}> {/* minHeight: 0 is crucial for child's scroll */}
        <Editor
          height="100%"
          value={selectedFile ? editorContent : '-- Select a file to view its content --'}
          onChange={onEditorChange}
          options={{
            minimap: { enabled: true },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: !selectedFile,
            theme: theme, // Aplicar el tema inicial y permitir que onMount lo sobreescriba
          }}
          onMount={handleEditorDidMount}
          language={selectedFile ? 'gherkin' : undefined}
        />
      </Box>
    </Box>
  );
};

export default FeatureEditor;