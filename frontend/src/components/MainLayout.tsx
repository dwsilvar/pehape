import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Tabs, Tab, MenuItem, AppBar, Toolbar, Button, Menu, ThemeProvider, CssBaseline, Badge } from '@mui/material';
import { DndContext, closestCenter, DragOverlay, Active } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import FileExplorer, { DraggableTreeItemPreview } from './FileExplorer';
import { FeatureEditor } from './FeatureEditor';
import ExecutionOrder from './ExecutionOrder';
import StatusBar from './StatusBar'; // Importar la nueva barra de estado
import ModulesComponent from './Modules';
import ConsoleView from './ConsoleView'; // Importar la nueva vista de consola
import { FileData, Module, ScenarioStatusMap } from '../types';
import { getAppTheme } from '../theme';
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
  const [isDirty, setIsDirty] = useState(false); // Estado para rastrear cambios
  const [fontSize] = useState(14);
  const [themeName, setThemeName] = useState<string>(() => {
    return localStorage.getItem('editorTheme') || 'monokai';
  });
  const [isModifiedByDrag, setIsModifiedByDrag] = useState(false);
  const { modules, setModules, isLoading, refetch } = useExecutionOrder();
  const [tabValue, setTabValue] = useState(0);
  const modulesRef = useRef(modules);
  const [focusedModule, setFocusedModule] = useState<string | null>(null);
  
  // --- LIFTED STATE FOR COLLAPSE/EXPAND ---
  const [executionOrderCollapsed, setExecutionOrderCollapsed] = useState<Set<string>>(new Set());
  const [modulesViewCollapsed, setModulesViewCollapsed] = useState<Set<string>>(new Set());
  const [fileExplorerWidth, setFileExplorerWidth] = useState(250);

  // --- Lógica para redimensionar el File Explorer ---
  const layoutRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !layoutRef.current) return;
    const layoutRect = layoutRef.current.getBoundingClientRect();
    const newWidth = e.clientX - layoutRect.left;

    // Limites: no más de 1/3 del ancho total y no menos de 150px
    const maxWidth = layoutRect.width / 3;
    const minWidth = 150;

    // Sujeta el nuevo ancho para que siempre esté entre los límites mínimo y máximo.
    const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setFileExplorerWidth(clampedWidth);
  }, []); // No tiene dependencias externas, por lo que se puede dejar vacío.

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]); // Depende de handleMouseMove

  useEffect(() => {
    // Limpieza del event listener
    return () => handleMouseUp();
  }, [handleMouseUp]); // Solo necesita handleMouseUp como dependencia
  // ----------------------------------------------------

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  // Este efecto se ejecuta cuando los módulos se cargan para inicializar los estados de colapso
  useEffect(() => {
    if (modules.length > 0) {
      const initialExecOrder = new Set<string>();
      const initialModulesView = new Set<string>();
      modules.forEach(module => {
        const execOrderStates = module.view_states?.execution_order || {};
        Object.keys(execOrderStates).forEach(sectionId => { if (execOrderStates[sectionId]) initialExecOrder.add(sectionId); });

        const modulesViewStates = module.view_states?.modules_view || {};
        Object.keys(modulesViewStates).forEach(sectionId => { if (modulesViewStates[sectionId]) initialModulesView.add(sectionId); });
      });
      setExecutionOrderCollapsed(initialExecOrder);
      setModulesViewCollapsed(initialModulesView);
    }
  }, [modules]);

  const createToggleHandler = useCallback((
    view: 'execution_order' | 'modules_view',
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => async (sectionId: string) => {
    let newCollapsedState = false;
    
    setter(prev => {
      const newSet = new Set(prev);
      const isCurrentlyCollapsed = newSet.has(sectionId);
      newCollapsedState = !isCurrentlyCollapsed;

      if (newCollapsedState) newSet.add(sectionId);
      else newSet.delete(sectionId);
      return newSet;
    });

    // Espera un momento para que el estado se actualice antes de enviar la llamada a la API.
    // Esto no es ideal, pero es una solución simple para este patrón.
    await new Promise(resolve => setTimeout(resolve, 0));

    await fetch('/api/ui-settings/module-collapse', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view, section_id: sectionId, is_collapsed: newCollapsedState }),
    });
  }, []);

  const handleToggleExecutionOrderCollapse = createToggleHandler('execution_order', setExecutionOrderCollapsed);
  const handleToggleModulesViewCollapse = createToggleHandler('modules_view', setModulesViewCollapsed);

  // Función para limpiar los datos de los módulos antes de guardarlos.
  // Elimina propiedades que son solo para la UI y no deben persistir en run_list.json.
  const cleanModulesForSave = (modulesToClean: Module[]): any[] => {
    return modulesToClean.map(module => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { color, is_collapsed, ...restOfModule } = module;
      return {
        ...restOfModule,
        features: module.features.map(feature => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { display_tags, scenarios, color, ...restOfFeature } = feature;
          return restOfFeature;
        }),
      };
    });
  };

  // Persist modules to backend (used after drag modifications).
  // The hook doesn't provide a handleSave function so we implement a minimal one here.
  const handleSave = useCallback(async (modulesToSave?: Module[]) => {
    try {
      const payload = cleanModulesForSave(modulesToSave || modulesRef.current);
      const response = await fetch('/api/execution-order', { // Este endpoint debe guardar en run_list.json
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Usar la referencia para evitar estado rancio o el payload directo
      });
      const updatedModules = await response.json();
      setModules(updatedModules); // Actualiza el estado con la respuesta del servidor para mantener la consistencia
    } catch (error) {
      console.error('Error saving execution order:', error);
    }
  }, [setModules]);

  // Simple local status placeholder (the hook doesn't currently return status).
  type LocalStatusType = 'success' | 'error' | 'info' | null;
  const status: { text: string; type: LocalStatusType } = { text: '', type: 'info' };
  const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Estados levantados desde ExecutionOrder para persistencia entre pestañas
  // y para ser gestionados por el layout principal.
  const [logs, setLogs] = useState<string[]>([]);
  const [scenarioStatuses, setScenarioStatuses] = useState<ScenarioStatusMap>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [runningFeatureId, setRunningFeatureId] = useState<string | null>(null);
  
  // Estado para gestionar el elemento que se está arrastrando y mostrar el overlay
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);
  const runningFeatureIdRef = useRef(runningFeatureId);

  const availableThemes = {
    'monokai': 'Monokai',
    'vs-dark': 'VS Dark',
    'solarized-dark': 'Solarized Dark',
    'dracula': 'Dracula',
    'cobalt': 'Cobalt',
  };

  useEffect(() => {
    localStorage.setItem('editorTheme', themeName);
  }, [themeName]);

  useEffect(() => {
    runningFeatureIdRef.current = runningFeatureId;
  }, [runningFeatureId]);

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
      setIsDirty(false); // Limpia el estado de "sucio" al cargar un nuevo archivo
      setTabValue(0); // Switch to editor tab on file select
    } catch (error) {
      console.error("Error loading file:", error);
      setEditorContent(`-- Error loading ${path}.`);
      setIsDirty(false);
    }
  }, [setEditorContent, setSelectedFile, setTabValue]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
      setIsDirty(true); // Marca como "sucio" cuando el contenido cambia
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile || !isDirty) return;

    try {
      const response = await fetch(`/api/features/${encodeURIComponent(selectedFile.path)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save file');
      }

      setIsDirty(false); // Limpia el estado de "sucio" después de guardar
      // Opcional: mostrar una notificación de éxito

    } catch (error) {
      console.error('Error saving file:', error);
      // Opcional: mostrar una notificación de error
    }
  }, [selectedFile, editorContent, isDirty]);

  const navigateToModule = useCallback((moduleName: string) => {
    setTabValue(1); // Cambia a la pestaña "Modulos" (ahora en el índice 1)
    setFocusedModule(moduleName);
  }, []); // No tiene dependencias, por lo que se puede dejar vacío.

  // Nueva función para limpiar el estado de "focused" después de usarlo.
  const clearFocusedModule = useCallback(() => {
    setFocusedModule(null);
  }, []);

  // --- Lógica de ejecución de pruebas, ahora en el layout principal ---
  const handleRunTests = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setLogs(['Iniciando conexión con el servidor...']);
    setScenarioStatuses({});
    setRunningFeatureId(null);

    try {
      const response = await fetch('/api/run-tests', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start test execution');
      }
      const result = await response.json();
      setLogs(prev => [...prev, result.message]);

      const eventSource = new EventSource('/api/stream-logs');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'scenario_status') {
          // Lógica simplificada gracias a que el backend ahora envía el feature_id.
          // Ya no necesitamos buscar ni adivinar.
          const featureIdForUpdate = data.feature_id;

          if (featureIdForUpdate) {
            // Si el escenario está empezando a correr, actualizamos el feature activo.
            if (data.status === 'running') {
              setRunningFeatureId(featureIdForUpdate);
            }
            const uniqueScenarioId = `${featureIdForUpdate}::${data.name}`;
            setScenarioStatuses(prev => ({ ...prev, [uniqueScenarioId]: data.status }));
          }
          return;
        }

        if (data.type === 'report_ready' && data.reportUrl) {
          setLogs(prev => [...prev, '--- Reporte disponible. ---']);
          window.open(data.reportUrl, '_blank');
          return;
        }

        if (data.log === '---EXECUTION_FINISHED---') {
          setLogs(prev => [...prev, '--- Ejecución finalizada. ---']);
          setIsExecuting(false);
          eventSource.close();
          setRunningFeatureId(null);
        } else if (data.log === '---EXECUTION_STOPPED_BY_USER---') {
          setLogs(prev => [...prev, '--- Ejecución detenida por el usuario. ---']);
          setRunningFeatureId(null);
          setIsExecuting(false);
          eventSource.close();
        } else {
          setLogs(prev => [...prev, data.log]);
        }
      };

      eventSource.onerror = () => {
        setLogs(prev => [...prev, 'Error en la conexión de streaming. Se ha cerrado.']);
        setIsExecuting(false);
        eventSource.close();
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setLogs(prev => [...prev, `Error al iniciar la ejecución: ${errorMessage}`]);
      setRunningFeatureId(null);
      setIsExecuting(false);
    }
  };

  const handleStopTests = async () => {
    try {
      const response = await fetch('/api/stop-tests', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop test execution');
      }
      const result = await response.json();
      setLogs(prev => [...prev, result.message]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setLogs(prev => [...prev, `Error al detener la ejecución: ${errorMessage}`]);
    }
  };

  const ConsoleTabLabel = () => (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      Console
      {isExecuting && (
        <Badge 
          color="primary" 
          variant="dot" 
          sx={{ ml: 1.5 }}
        />
      )}
    </Box>
  );

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
                setModules(() => updatedModules); // Usar la forma de función para consistencia
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
              // Usar la forma de función de actualización para garantizar la consistencia del tipo
              // y evitar problemas con closures de estado.
              setModules((currentModules: Module[]) => arrayMove(currentModules, oldIndex, newIndex));
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

                // Guardamos el estado original para poder revertir en caso de error.
                const originalModules = modules;
                
                // Actualización optimista: actualiza la UI inmediatamente
                setModules(current => 
                  current.map(m =>
                    m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m
                  )
                );

                // Llama a la API para persistir el cambio
                try {
                  const featuresToSave = updatedFeaturesWithOrder.map(({ display_tags, scenarios, color, ...rest }) => rest);
                  const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ features: featuresToSave }),
                  });
                  if (!response.ok) {
                    // Si la API falla, revertimos al estado original.
                    setModules(originalModules);
                  }
                } catch (error) {
                  console.error('Error al reordenar los features por drag:', error);
                  // En caso de error de red, también revertimos.
                  setModules(originalModules);
                }
              }
            }
            return; // Finaliza el manejador aquí
          }
        }}>
          <Box ref={layoutRef} sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch', overflow: 'hidden' }}>
            {/* File Explorer */}
            <Paper
              elevation={2}
              sx={{ width: fileExplorerWidth, minWidth: '150px', overflow: 'auto' }}
            >
              <FileExplorer onFileSelect={handleFileSelect} fontSize={fontSize} />
            </Paper>
            {/* Manija para redimensionar */}
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                width: '5px',
                cursor: 'col-resize',
                backgroundColor: 'divider',
                '&:hover': { backgroundColor: 'primary.main' },
                flexShrink: 0,
              }}
            />
            {/* Right Panel with Tabs */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Tabs value={tabValue} onChange={handleTabChange} aria-label="main tabs" sx={{ '& .MuiTab-root': { textTransform: 'none' } }}>
                    <Tab
                      label={isDirty ? `${selectedFile?.name || 'Editor'} *` : (selectedFile?.name || 'Feature Editor')}
                      id="main-tab-0"
                      aria-controls="main-tabpanel-0"
                    />
                    <Tab label="Modulos" id="main-tab-1" aria-controls="main-tabpanel-1" />
                    <Tab label="Execution Order" id="main-tab-2" aria-controls="main-tabpanel-2" />
                    <Tab label={<ConsoleTabLabel />} id="main-tab-3" aria-controls="main-tabpanel-3" />
                  </Tabs>
                </Box>
              </Box>
              <TabPanel value={tabValue} index={0}>
                <FeatureEditor
                  selectedFile={selectedFile}
                  editorContent={editorContent}
                  onEditorChange={handleEditorChange}
                  theme={themeName}
                  onSave={handleSaveFile}
                  isDirty={isDirty}
                  isResizing={isResizingRef.current}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <ModulesComponent
                  fontSize={fontSize}
                  onFeatureSelect={handleFileSelect}
                  modules={modules}
                  setModules={setModules}
                  scenarioStatuses={scenarioStatuses}
                  setScenarioStatuses={setScenarioStatuses}
                  isExecuting={isExecuting}
                  runningFeatureId={runningFeatureId}
                  onRunTests={handleRunTests}
                  onSaveModules={handleSave}
                  collapsedSections={modulesViewCollapsed}
                  onToggleSectionCollapse={handleToggleModulesViewCollapse}
                  focusedModule={focusedModule}
                  onStopTests={handleStopTests}
                  navigateToModule={navigateToModule}
                  onFocusConsumed={clearFocusedModule}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                <ExecutionOrder
                  fontSize={fontSize}
                  onFeatureSelect={handleFileSelect}
                  modules={modules}
                  setModules={setModules}
                  scenarioStatuses={scenarioStatuses}
                  setScenarioStatuses={setScenarioStatuses}
                  isExecuting={isExecuting}
                  runningFeatureId={runningFeatureId}
                  onRunTests={handleRunTests}
                  onSaveModules={handleSave}
                  collapsedSections={executionOrderCollapsed}
                  onToggleSectionCollapse={handleToggleExecutionOrderCollapse}
                  navigateToModule={navigateToModule}
                  onStopTests={handleStopTests}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={3}>
                <ConsoleView logs={logs} />
              </TabPanel>
            </Box>
          </Box>
          {/* Aquí renderizamos el "fantasma" del elemento que se está arrastrando */}
          <DragOverlay>
            {activeDragItem && activeDragItem.data.current?.type === 'file-explorer-feature' && (
              // Renderizamos una versión simplificada del TreeItem para el overlay
              <Paper elevation={4} sx={{ p: 1, display: 'flex', alignItems: 'center', backgroundColor: 'primary.light' }}>
                <DraggableTreeItemPreview 
                  path={activeDragItem.data.current.path} 
                />
              </Paper>
            )}
          </DragOverlay>
        </DndContext>
        {/* Renderizar la barra de estado en la parte inferior */}
        <StatusBar 
          message={status?.text || ''} 
          isLoading={isLoading} 
          statusType={status?.type || 'info'} 
        />
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;