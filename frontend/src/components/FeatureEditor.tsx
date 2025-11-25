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
      if (themeName === 'vs-dark') {
        monaco.editor.setTheme(themeName);
        return;
      }

      // Mapa de nombres de tema a nombres de archivo reales
      const themeFileMap: { [key: string]: string } = {
        'monokai': 'Monokai',
        'solarized-dark': 'Solarized Dark',
        'dracula': 'Dracula',
        'cobalt': 'Cobalt',
      };

      const themeFileName = themeFileMap[themeName];
      if (!themeFileName) {
        console.error(`Theme '${themeName}' is not defined in the theme map.`);
        monaco.editor.setTheme('vs-dark');
        return;
      }

      try {
        const themeData = await import(`monaco-themes/themes/${themeFileName}.json`);
        monaco.editor.defineTheme(themeName, themeData);
        monaco.editor.setTheme(themeName);
      } catch (error) {
        console.error(`Failed to load theme ${themeName}:`, error);
        monaco.editor.setTheme('vs-dark'); // Fallback to a safe theme
      }
    };

    applyTheme(theme);
    
    const editorElement = editor.getDomNode();
    if (editorElement) {
      const textarea = editorElement.querySelector('textarea');
      if (textarea) {
        textarea.id = 'feature-editor-textarea';
      }
    }
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
            theme: theme,
          }}
          onMount={handleEditorDidMount}
          language={selectedFile ? 'gherkin' : undefined}
        />
      </Box>
    </Box>
  );
};