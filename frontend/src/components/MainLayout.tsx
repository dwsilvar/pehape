import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Paper, Tabs, Tab, MenuItem, AppBar, Toolbar, Button, Menu, ThemeProvider, CssBaseline } from '@mui/material';
import { DndContext, closestCenter, DragOverlay, Active } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import FileExplorer from './FileExplorer';
import FeatureEditor from './FeatureEditor';
import ExecutionOrder from './ExecutionOrder';
import StatusBar from './StatusBar'; // Importar la nueva barra de estado
import { FileData, FeatureItem } from '../types';
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
  const [isModifiedByDrag, setIsModifiedByDrag] = useState(false);
  const { modules, setModules, handleSave, status, isLoading } = useExecutionOrder();
  const [tabValue, setTabValue] = useState(0);
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState<null | HTMLElement>(null);
  
  // Estado para gestionar el elemento que se está arrastrando y mostrar el overlay
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);

  const availableThemes = {
    'monokai': 'Monokai',
    'vs-dark': 'VS Dark',
    'solarized-dark': 'Solarized Dark',
    'dracula': 'Dracula',
    'cobalt': 'Cobalt',
  };

  // 2. Guardar el tema en localStorage cada vez que cambie.
  // Y crear el objeto de tema de MUI con useMemo para eficiencia.
  useEffect(() => {
    localStorage.setItem('editorTheme', themeName);
  }, [themeName]);
  const muiTheme = useMemo(() => getAppTheme(themeName), [themeName]);

  useEffect(() => {
    if (isModifiedByDrag) {
      handleSave();
      setIsModifiedByDrag(false); // Reset the flag after saving
    }
  }, [isModifiedByDrag, handleSave]);

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
      {/* Ajustamos el Box principal para dejar espacio para la barra de estado */}
      <Box sx={{ 
        display: 'flex', flexDirection: 'column', 
        height: '100vh', pb: '24px' /* Padding-bottom para no solapar con la barra */ 
      }}>
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

        <DndContext 
          collisionDetection={(args) => {
            // LOG: Para ver qué elementos están siendo considerados para colisión
            // console.log('Collision Detection Args:', args);
            // Obtenemos el tipo del elemento que se está arrastrando.
            const activeType = args.active.data.current?.type as string;

            // Si estamos arrastrando un feature desde el explorador, no filtramos los destinos.
            // Esto permite que colisione con los 'module-drop-area'.
            if (activeType === 'file-explorer-feature') {
              return closestCenter(args);
            }

            // Para otros tipos de arrastre (reordenar módulos, etc.), mantenemos el filtro.
            const droppableContainers = args.droppableContainers.filter((container) => {
              return container.data.current?.type === activeType;
            });
            return closestCenter({ ...args, droppableContainers: droppableContainers });
          }}
          onDragStart={(event) => {
            // Cuando empieza el arrastre, guardamos la información del elemento activo
            console.log('--- onDragStart ---');
            console.log('Active Item:', event.active);
            setActiveDragItem(event.active);
          }}
          onDragCancel={() => {
            // Si se cancela el arrastre, limpiamos el estado
            setActiveDragItem(null);
          }}
          onDragEnd={async (event) => {
          // Al finalizar el arrastre, limpiamos el estado
          setActiveDragItem(null);

          const { active, over } = event;

          // LOG: El log más importante. ¿Qué son 'active' y 'over' al final del arrastre?
          console.log('--- onDragEnd ---');
          console.log('Active:', active);
          console.log('Over:', over);

          if (!over) {
            console.log('Drag ended but not over a droppable area. Aborting.');
            return;
          }

          // CASO 1: Arrastrar un feature desde el FileExplorer a un Módulo
          const isFileExplorerDrag = active.data.current?.type === 'file-explorer-feature';
          const isOverModuleDropArea = over.id.toString().startsWith('module-drop-area-');
          console.log(`Checking conditions: isFileExplorerDrag=${isFileExplorerDrag}, isOverModuleDropArea=${isOverModuleDropArea}`);
          if (isFileExplorerDrag && isOverModuleDropArea) {
            const moduleName = over.data.current?.moduleName;
            const featurePath = active.data.current?.path;

            if (moduleName && featurePath) {
              console.log(`Attempting to add feature '${featurePath}' to module '${moduleName}'`);
              try {
                const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: featurePath }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Failed to add feature');
                }
                const updatedModules = await response.json();
                setModules(updatedModules); // Actualizar el estado con la respuesta del backend
              } catch (error) {
                console.error('Error al agregar el feature:', error);
                // Aquí podrías mostrar una notificación de error al usuario
              }
            }
            return; // Finaliza el manejador aquí
          }

          // CASO 2: Reordenar Módulos
          const isModuleDrag = active.data.current?.type === 'module';
          if (isModuleDrag) {
            if (active.id !== over.id) {
              const oldIndex = modules.findIndex((m) => m.module_name === active.id);
              const newIndex = modules.findIndex((m) => m.module_name === over.id);              
              const newModules = arrayMove(modules, oldIndex, newIndex);
              setModules(newModules);
              setIsModifiedByDrag(true);
            }
            return; // Finaliza el manejador aquí
          }

          // CASO 3: Reordenar Features dentro del mismo módulo
          const isFeatureDrag = active.data.current?.type === 'feature';
          if (isFeatureDrag) {
            // La propiedad 'sortable' solo existe en elementos dentro de un SortableContext
            const activeContainer = active.data.current?.sortable.containerId;
            const overContainer = over.data.current?.sortable.containerId;

            if (activeContainer === overContainer) {
              const moduleName = activeContainer; // El nombre del módulo
              const module = modules.find(m => m.module_name === moduleName);
              if (!module) return;

              const oldIndex = module.features.findIndex(f => f.id === active.id);
              const newIndex = module.features.findIndex(f => f.id === over.id);

              if (oldIndex !== newIndex) {
                const reorderedFeatures = arrayMove(module.features, oldIndex, newIndex);

                // Re-asigna el orden secuencial para la actualización optimista
                const updatedFeaturesWithOrder = reorderedFeatures.map((feature, index) => ({
                  ...feature,
                  order: index + 1,
                }));

                // Actualización optimista: actualiza la UI inmediatamente
                setModules(prevModules =>
                  prevModules.map(m =>
                    m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m
                  )
                );

                // Llama a la API para persistir el cambio
                try {
                  const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFeaturesWithOrder), // Envía la lista con el orden ya corregido
                  });
                  if (!response.ok) {
                    // Si la API falla, revierte el cambio en la UI
                    setModules(modules);
                  }
                } catch (error) {
                  console.error('Error al reordenar los features por drag:', error);
                  setModules(modules); // Revertir en caso de error de red
                }
              }
            }
            return; // Finaliza el manejador aquí
          }
        }}>
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
                />
              </TabPanel>
            </Box>
          </Box>
          {/* Aquí renderizamos el "fantasma" del elemento que se está arrastrando */}
          <DragOverlay>
            {activeDragItem && activeDragItem.data.current?.type === 'file-explorer-feature' && (
              // Renderizamos una versión simplificada del TreeItem para el overlay
              <Paper elevation={4} sx={{ p: 1, display: 'flex', alignItems: 'center', backgroundColor: 'primary.light' }}>
                <FileExplorer.DraggableTreeItemPreview 
                  path={activeDragItem.data.current.path} 
                />
              </Paper>
            )}
          </DragOverlay>
        </DndContext>
        {/* Renderizar la barra de estado en la parte inferior */}
        <StatusBar message={status.text} isLoading={isLoading} statusType={status.type} />
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;