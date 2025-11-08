import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Paper, Tabs, Tab, Typography, MenuItem, AppBar, Toolbar, Button, Menu, ThemeProvider, CssBaseline } from '@mui/material';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

import FileExplorer from './FileExplorer';
import FeatureEditor from './FeatureEditor';
import ExecutionOrder, { FeatureItem } from './ExecutionOrder';
import { FileData } from '../types';
import { getAppTheme } from '../theme'; // 1. Importar nuestro creador de temas
import { useExecutionOrder } from '../hooks/useExecutionOrder';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`main-tabpanel-${index}`}
      aria-labelledby={`main-tab-${index}`}
      style={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>{children}</Box>
      )}
    </div>
  );
}

const MainLayout: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [fontSize] = useState(14);
  // 1. Estado para el tema del editor, inicializado desde localStorage o con un valor por defecto.
  const [themeName, setThemeName] = useState<string>(() => {
    return localStorage.getItem('editorTheme') || 'monokai';
  });
  const { modules, setModules, handleSave, handleDragEnd: handleExecutionOrderDragEnd } = useExecutionOrder();
  const [tabValue, setTabValue] = useState(0);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState<null | HTMLElement>(null);

  // 2. Guardar el tema en localStorage cada vez que cambie.
  // Y crear el objeto de tema de MUI con useMemo para eficiencia.
  useEffect(() => {
    localStorage.setItem('editorTheme', themeName);
  }, [themeName]);
  const muiTheme = useMemo(() => getAppTheme(themeName), [themeName]);

  const availableThemes = {
    'monokai': 'Monokai',
    'vs-dark': 'VS Dark',
    'solarized-dark': 'Solarized Dark',
    'dracula': 'Dracula',
    'cobalt': 'Cobalt',
  };

  const handleViewMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setViewMenuAnchorEl(event.currentTarget);
  };

  const handleViewMenuClose = () => {
    setViewMenuAnchorEl(null);
  };

  const handleThemeChange = (theme: string) => {
    setThemeName(theme);
    handleViewMenuClose();
  };
  // Lógica reescrita: ahora solo acepta el path del archivo.
  const handleFileSelect = useCallback(async (path: string) => {
    const name = path.split('/').pop() || path;

    setSelectedFile({ name, path, type: 'file' });
    setEditorContent(`-- Loading ${path}...`);

    try {
      const response = await fetch(`/api/features/${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to fetch file content');
      const data = await response.json();
      setEditorContent(data.content);
      setTabValue(0); // Switch to editor tab on file select
    } catch (error) {
      console.error("Error loading file:", error);
      setEditorContent(`-- Error loading ${path}.`);
    }
  }, [setEditorContent, setSelectedFile, setTabValue]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline /> {/* Aplica estilos base como el color de fondo del body */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Barra de Menú Superior */}
        <AppBar position="static" elevation={1} color="default">
          <Toolbar variant="dense">
            <Button color="inherit" onClick={handleViewMenuClick}>View</Button>
            {/* Aquí se pueden agregar más menús como "File", "Edit", etc. */}
          </Toolbar>
        </AppBar>
        <Menu
          anchorEl={viewMenuAnchorEl}
          open={Boolean(viewMenuAnchorEl)}
          onClose={handleViewMenuClose}
        >
          <MenuItem disabled>Select Theme</MenuItem>
          {Object.entries(availableThemes).map(([key, name]) => (
            <MenuItem key={key} onClick={() => handleThemeChange(key)} selected={key === themeName}>
              {name}
            </MenuItem>
          ))}
        </Menu>

        <DndContext onDragEnd={handleExecutionOrderDragEnd}>
          <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch', overflow: 'hidden' }}>
            {/* File Explorer */}
            <Paper
              elevation={2}
              sx={{ width: 250, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}
            >
              <FileExplorer onFileSelect={handleFileSelect} fontSize={fontSize} />
            </Paper>

            {/* Right Panel with Tabs */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Tabs value={tabValue} onChange={handleTabChange} aria-label="main tabs">
                    <Tab label={selectedFile?.name || 'Feature Editor'} id="main-tab-0" aria-controls="main-tabpanel-0" />
                    <Tab label="Execution Order" id="main-tab-1" aria-controls="main-tabpanel-1" />
                  </Tabs>
                </Box>
              </Box>
              <TabPanel value={tabValue} index={0}>
                <FeatureEditor
                  selectedFile={selectedFile}
                  editorContent={editorContent}
                  onEditorChange={handleEditorChange}
                  theme={themeName}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <ExecutionOrder
                  fontSize={fontSize}
                  isDropTarget={false}
                  onAddFeature={() => {}}
                  onFeatureSelect={handleFileSelect}
                  modules={modules}
                  setModules={setModules}
                  handleSave={handleSave}
                />
              </TabPanel>
            </Box>
          </Box>
        </DndContext>
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;