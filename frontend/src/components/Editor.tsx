import React from 'react';
import { Box, Paper } from '@mui/material';
import MonacoEditor, { OnMount } from '@monaco-editor/react';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  fontSize: number;
  filename?: string;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onSave, fontSize, filename }) => {
  const handleEditorDidMount: OnMount = (editor, monaco) => {    
    // Asigna un ID único al textarea interno del editor para mejorar la accesibilidad
    // y eliminar las advertencias del navegador sobre campos de formulario sin nombre.
    const editorElement = editor.getDomNode();
    if (editorElement) {
      const textarea = editorElement.querySelector('textarea');
      if (textarea) {
        textarea.id = 'monaco-editor-textarea';
      }
    }

    // --- Definición de un Tema Personalizado ---
    monaco.editor.defineTheme('pehapeTheme', {
      base: 'vs-dark', // Puedes usar 'vs' (claro) o 'vs-dark' (oscuro) como base
      inherit: true, // Hereda las reglas del tema base
      rules: [
        // Personaliza los colores de la sintaxis de Gherkin
        { token: 'keyword.gherkin', foreground: 'd5a42c' }, // Para 'Feature', 'Scenario', 'Given', 'When', 'Then'
        { token: 'string.gherkin', foreground: '8dc54c' },  // Para texto entre comillas
        { token: 'comment.gherkin', foreground: '888888', fontStyle: 'italic' }, // Para comentarios con #
        { token: 'tag.gherkin', foreground: '569cd6' },      // Para tags como @smoke
      ],
      colors: {
        // Personaliza los colores de la interfaz del editor
        'editor.background': '#282c34', // Fondo del editor
        'editor.foreground': '#abb2bf', // Color del texto por defecto
        'editorCursor.foreground': '#d5a42c', // Color del cursor
        'editor.lineHighlightBackground': '#3a404a', // Color de la línea activa
        'editor.selectionBackground': '#4b5362', // Color de la selección
      },
    });

    // Aplica el tema personalizado que acabamos de definir
    monaco.editor.setTheme('pehapeTheme');
    // -----------------------------------------

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