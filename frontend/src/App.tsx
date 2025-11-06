import React, { useState, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Slider, Box, Grid, Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import FileExplorer from './components/FileExplorer';
import ExecutionOrder from './components/ExecutionOrder';
import Editor from './components/Editor';
import { FileData } from './types';

const AppContainer = styled(Box)(({ theme }) => ({
  height: '100vh',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
}));

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false); // Para rastrear cambios sin guardar
  const [activeTab, setActiveTab] = useState(0);

  // State for Drag and Drop
  const [draggedFeature, setDraggedFeature] = useState<FileData | null>(null);
  const [isOverExecutionOrder, setIsOverExecutionOrder] = useState(false);

  // State for settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileExplorerFontSize, setFileExplorerFontSize] = useState<number>(14);
  const [executionOrderFontSize, setExecutionOrderFontSize] = useState<number>(14);
  const [editorFontSize, setEditorFontSize] = useState<number>(14);
  const [fileMenuAnchorEl, setFileMenuAnchorEl] = useState<null | HTMLElement>(null);

  const handleFileSelect = useCallback(async (file: FileData) => {
    setSelectedFile(file);
    try {
      const response = await fetch(`/api/features/${file.path}`);
      const data = await response.json();
      setIsDirty(false); // El contenido está limpio al cargar
      setFileContent(data.content || 'Error: No se pudo cargar el contenido.');
    } catch (error) {
      console.error("Failed to fetch file content:", error);
      setFileContent('Error al cargar el archivo. Ver la consola para más detalles.');
    }
  }, []);

  const handleContentChange = (value: string) => {
    setFileContent(value);
    setIsDirty(true); // Marcar como sucio cuando el contenido cambia
  };

  const handleSave = useCallback(async () => {
    if (!selectedFile || !isDirty) {
      return;
    }

    try {
      const response = await fetch(`/api/features/${selectedFile.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: fileContent }),
      });

      if (!response.ok) {
        throw new Error(`Error al guardar: ${response.statusText}`);
      }

      setIsDirty(false); // Marcar como limpio después de guardar
      console.log(`Archivo '${selectedFile.path}' guardado exitosamente.`);
    } catch (error) {
      console.error("Fallo al guardar el archivo:", error);
    }
  }, [selectedFile, fileContent, isDirty]);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'file') {
      setDraggedFeature(event.active.data.current.file);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setIsOverExecutionOrder(over?.id === 'execution-order-droppable-area');
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { over } = event;
    if (over?.id === 'execution-order-droppable-area' && draggedFeature) {
      // TODO: Implement the logic to add the feature to the execution order state.
      // For now, we just log it.
      console.log(`Feature '${draggedFeature.path}' dropped. Add to execution order.`);
    }
    // Reset states
    setDraggedFeature(null);
    setIsOverExecutionOrder(false);
  }, [draggedFeature]);

  const handleAddToExecution = useCallback(() => {
    console.log(`Feature '${draggedFeature?.path}' added via button. Add to execution order.`);
  }, [draggedFeature]);

  const handleFileMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setFileMenuAnchorEl(event.currentTarget);
  };

  const handleFileMenuClose = () => {
    setFileMenuAnchorEl(null);
  };

  // Configura los sensores para el drag and drop con un retraso
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Requiere que el ratón se mantenga presionado por 250ms para iniciar el arrastre
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor) // También puedes configurar el sensor táctil si es necesario
  );

  const handleSettingsClick = () => {
    setSettingsOpen(true);
    handleFileMenuClose();
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <AppContainer>
      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid #ddd' }}>
        <Toolbar variant="dense">
          <Button color="inherit" onClick={handleFileMenuClick}>File</Button>
          <Button color="inherit">Edit</Button>
          <Menu
            anchorEl={fileMenuAnchorEl}
            open={Boolean(fileMenuAnchorEl)}
            onClose={handleFileMenuClose}
          >
            <MenuItem onClick={handleSettingsClick}>Settings</MenuItem>
            <MenuItem onClick={handleFileMenuClose}>Exit</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Dialog open={settingsOpen} onClose={handleSettingsClose} fullWidth maxWidth="sm">
        <DialogTitle>Settings</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>File Explorer Font Size</Typography>
          <Slider value={fileExplorerFontSize} onChange={(e, v) => setFileExplorerFontSize(v as number)} step={1} min={10} max={24} valueLabelDisplay="auto" />
          <Typography gutterBottom>Execution Order Font Size</Typography>
          <Slider value={executionOrderFontSize} onChange={(e, v) => setExecutionOrderFontSize(v as number)} step={1} min={10} max={24} valueLabelDisplay="auto" />
          <Typography gutterBottom>Editor Font Size</Typography>
          <Slider value={editorFontSize} onChange={(e, v) => setEditorFontSize(v as number)} step={1} min={10} max={24} valueLabelDisplay="auto" />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <Grid container spacing={2} style={{ flex: 1, overflow: 'hidden' }}>
          <Grid item xs={3} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flex: 1, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
              <FileExplorer onFileSelect={handleFileSelect} fontSize={fileExplorerFontSize} />
            </Box>
          </Grid>
          <Grid item xs={9} style={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange} aria-label="Editor and Execution Order Tabs">
                <Tab label="Editor" />
                <Tab label="Execution Order" />
              </Tabs>
            </Box>
            {activeTab === 0 && (
              <Box sx={{ pt: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">
                    {selectedFile?.name || 'Editor'}
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={!selectedFile || !isDirty}
                  >
                    Save
                  </Button>
                </Box>
                <Box flex={1}>
                  <Editor
                    key={selectedFile?.path || 'empty-editor'}
                    content={fileContent}
                    onChange={handleContentChange}
                    onSave={handleSave}
                    fontSize={editorFontSize}
                    filename={selectedFile?.name}
                  />
                </Box>
              </Box>
            )}
            {activeTab === 1 && (
              <Box sx={{ pt: 2, flex: 1, overflow: 'auto', position: 'relative' }}>
                <ExecutionOrder
                  fontSize={executionOrderFontSize}
                  isDropTarget={isOverExecutionOrder}
                  onAddFeature={handleAddToExecution}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </DndContext>
    </AppContainer>
  );
};

export default App;