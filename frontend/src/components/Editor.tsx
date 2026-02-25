import React from 'react';
import { Box, Paper } from '@mui/material';
import MonacoEditor, { OnMount } from '@monaco-editor/react';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  fontSize: number;
  filename?: string;
  theme: string; // Añadimos la prop de tema
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onSave, fontSize, filename, theme }) => {
  const handleEditorDidMount: OnMount = async (editor, monaco) => {
    // --- Lógica de carga de temas movida aquí desde FeatureEditor ---
    const themeFileMap: { [key: string]: string } = {
      'monokai': 'Monokai',
      'solarized-dark': 'Solarized Dark',
      'dracula': 'Dracula',
      'cobalt': 'Cobalt',
    };

    if (theme !== 'vs-dark' && themeFileMap[theme]) {
      try {
        const themeData = await import(`monaco-themes/themes/${themeFileMap[theme]}.json`);
        monaco.editor.defineTheme(theme, themeData);
      } catch (error) {
        console.error(`Failed to load theme ${theme}:`, error);
      }
    }
    monaco.editor.setTheme(theme);
    // ----------------------------------------------------------------

    // Asigna un ID único al textarea interno del editor para mejorar la accesibilidad
    // y eliminar las advertencias del navegador sobre campos de formulario sin nombre.
    const editorElement = editor.getDomNode();
    if (editorElement) {
      const textarea = editorElement.querySelector('textarea');
      if (textarea) {
        textarea.id = 'monaco-editor-textarea';
      }
    }

    // Añade el comando para guardar con Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
  };

  return (
    <Paper elevation={1} sx={{ height: '100%' }}>
      <Box height="100%" p={1}>
        <MonacoEditor
          height="100%"
          language="gherkin"
          // El tema se establece en el onMount, por lo que esta prop ya no es necesaria
          value={content}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: fontSize,
            lineNumbers: 'on',
            renderWhitespace: 'all',
          }}
        />
      </Box>
    </Paper>
  );
};

export default Editor;