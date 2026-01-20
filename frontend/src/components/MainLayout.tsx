import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Tabs, Tab, MenuItem, AppBar, Toolbar, Button, Menu, ThemeProvider, CssBaseline, Badge, IconButton, Tooltip, Divider, Typography, CircularProgress } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TerminalIcon from '@mui/icons-material/Terminal';
import CloseIcon from '@mui/icons-material/Close';
import { DndContext, closestCenter, DragOverlay, Active, useSensor, useSensors, PointerSensor, TouchSensor, pointerWithin, rectIntersection } from '@dnd-kit/core';
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
import { useLayout } from '../context/LayoutContext';

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
  const { modules, setModules, isLoading: isModulesLoading, refetch } = useExecutionOrder();
  const [tabValue, setTabValue] = useState(0);
  const modulesRef = useRef(modules);
  const [focusedModule, setFocusedModule] = useState<string | null>(null);

  // --- UI PERSPECTIVE STATE (Now shared via Context) ---
  const {
    activeView: activePerspective, setActiveView, isConsoleOpen, toggleConsole,
    logs, setLogs,
    scenarioStatuses, setScenarioStatuses,
    isExecuting, setIsExecuting,
    runningFeatureId, setRunningFeatureId,
    scheduledExecutionTime, setScheduledExecutionTime
  } = useLayout();
  // const [activePerspective, setActivePerspective] = useState<'editor' | 'orchestrator'>('editor'); // REMOVED local state
  // const [isConsoleOpen, setIsConsoleOpen] = useState(true); // REMOVED local state
  const [orchestratorTab, setOrchestratorTab] = useState(0); // 0: ExecutionOrder, 1: Modules

  // --- LIFTED STATE FOR COLLAPSE/EXPAND ---
  const [executionOrderCollapsed, setExecutionOrderCollapsed] = useState<Set<string>>(new Set());
  const [modulesViewCollapsed, setModulesViewCollapsed] = useState<Set<string>>(new Set());
  const [fileExplorerWidth, setFileExplorerWidth] = useState(250);
  const [consoleHeight, setConsoleHeight] = useState(200); // Height for dockable console

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
  // AHORA gestionados por LayoutContext para percistencia entre rutas.

  // Estado para gestionar el elemento que se está arrastrando y mostrar el overlay
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);
  const runningFeatureIdRef = useRef(runningFeatureId);

  // Buffer for logs to prevent high-frequency state updates
  const bufferedLogsRef = useRef<string[]>([]);

  // Deferred rendering state
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    // Defer heavy component rendering to allow initial paint to finish fast
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Flush logs buffer periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferedLogsRef.current.length > 0) {
        const logsToFlush = [...bufferedLogsRef.current];
        bufferedLogsRef.current = [];
        setLogs(prev => [...prev, ...logsToFlush]);
      }
    }, 100); // Flush every 100ms
    return () => clearInterval(interval);
  }, []);

  const availableThemes = {
    'vs-light': 'VS Light',
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

  // Configurar sensores para distinguir entre click y drag
  // Memoize options objects to prevent unnecessary DndContext updates
  const pointerSensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 4,
    },
  }), []);

  const touchSensorOptions = useMemo(() => ({
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions),
    useSensor(TouchSensor, touchSensorOptions)
  );
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

  // Handle URL query param for opening files
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fileToOpen = params.get('openFile');

    if (fileToOpen) {
      // Ensure we are in the editor view
      if (activePerspective !== 'editor') {
        setActiveView('editor');
      }

      // If file is already selected, don't re-fetch unless it's different
      if (selectedFile?.path !== fileToOpen) {
        console.log("Auto-opening file from URL:", fileToOpen);
        handleFileSelect(fileToOpen);
      }

      // Optional: Clear the param so refreshing doesn't force-reopen or to leave URL clean
      // But keep it clean for now to see it works
      // navigate('/', { replace: true }); 
    }
  }, [location.search, handleFileSelect, selectedFile, navigate]);

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
  // Refactorizar la lógica de conexión a logs en una función reutilizable
  const connectToLogStream = useCallback(() => {
    setLogs(prev => [...prev, 'Conectando al flujo de logs...']);
    const eventSource = new EventSource('/api/stream-logs');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'scenario_status') {
        const featureIdForUpdate = data.feature_id;
        if (featureIdForUpdate) {
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
      } else if (data.log === '---EXECUTION_KILLED_BY_WATCHDOG---') {
        setLogs(prev => [...prev, '--- Ejecución terminada por el Watchdog (Tiempo de espera agotado) ---']);
        setRunningFeatureId(null);
        setIsExecuting(false);
        eventSource.close();
      } else {
        if (data.log) {
          bufferedLogsRef.current.push(data.log);
        }
      }
    };

    eventSource.onerror = () => {
      console.log("EventSource connection closed or error.");
      eventSource.close();
    };

    return eventSource;
  }, []);

  const handleRunTests = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setLogs(['Iniciando ejecución...']);
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

      // Conectar al stream
      connectToLogStream();

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

  const handleScheduleTests = async (date: Date) => {
    try {
      setLogs(prev => [...prev, `Programando ejecución para: ${date.toLocaleString()}...`]);
      const response = await fetch('/api/schedule-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execution_time: date.toISOString() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule tests');
      }
      const result = await response.json();
      setLogs(prev => [...prev, result.message]);
      setScheduledExecutionTime(date);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setLogs(prev => [...prev, `Error al programar ejecución: ${errorMessage}`]);
    }
  };

  const handleCancelSchedule = async () => {
    try {
      const response = await fetch('/api/cancel-schedule', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel schedule');
      }
      setScheduledExecutionTime(null);
      setLogs(prev => [...prev, 'Ejecución programada cancelada.']);
    } catch (error) {
      setLogs(prev => [...prev, 'Error al cancelar la programación.']);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const scheduleResponse = await fetch('/api/schedule-status');
        if (scheduleResponse.ok) {
          const data = await scheduleResponse.json();
          if (data.scheduled && data.execution_time) {
            setScheduledExecutionTime(new Date(data.execution_time));
          } else {
            setScheduledExecutionTime(null);
          }
        }

        const executionResponse = await fetch('/api/execution-status');
        if (executionResponse.ok) {
          const execData = await executionResponse.json();
          if (execData.running && !isExecuting) {
            console.log("Detectada ejecución en segundo plano. Conectando logs...");
            setIsExecuting(true);
            setScheduledExecutionTime(null);
            connectToLogStream();
          }
        }
      } catch (error) {
        console.error("Error polling statuses", error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [isExecuting, connectToLogStream]);

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
          sensors={sensors}
          collisionDetection={(args) => {
            const activeType = args.active.data.current?.type as string;
            if (activeType === 'file-explorer-feature') {
              // Switch to rectIntersection for better cross-container detection
              return rectIntersection(args);
            }
            const droppableContainers = args.droppableContainers.filter((container) => {
              return container.data.current?.type === activeType;
            });
            return closestCenter({ ...args, droppableContainers: droppableContainers });
          }}
          onDragStart={(event) => {
            setActiveDragItem(event.active);
          }}
          onDragCancel={() => { // Added onDragCancel wrapper
            // Si se cancela el arrastre, limpiamos el estado
            setActiveDragItem(null);
          }} // Closing bracket for onDragCancel
          onDragEnd={async (event) => {
            // Al finalizar el arrastre, limpiamos el estado
            setActiveDragItem(null);
            const { active, over } = event;

            if (!over) return;

            // ... (Drag Logic remains largely the same, ensuring variables activePerspective don't break logic) ...
            // ... Since I am replacing the block, I need to include the logic or refer to it.
            // ... Given the tool limitation, I will copy the logic but verify context availability.

            // CASO 1: Arrastrar un feature desde el FileExplorer a un Módulo
            const isFileExplorerDrag = active.data.current?.type === 'file-explorer-feature';

            // Logica mejorada de detección de target
            let targetModuleName = null;

            if (isFileExplorerDrag) {
              const overId = over.id.toString();

              // 1. Direct drop on module container (created by useDroppable in Modules.tsx)
              if (overId.startsWith('module-drop-area-')) {
                targetModuleName = over.data.current?.moduleName;
              }
              // 2. Drop on an existing feature inside a module (handled by useSortable -> implicit droppable)
              else {
                // Buscar si el ID sobre el que se soltó corresponde a algún feature de algún módulo
                // Esto permite soltar "entre" features o sobre features existentes
                for (const mod of modules) {
                  // Check if 'overId' matches a feature ID in this module
                  const isOverFeature = mod.features.some(f => f.id === overId);
                  // Also check if 'overId' matches the SortableContext ID (which is the module name)
                  const isOverSortableContext = overId === mod.module_name;

                  if (isOverFeature || isOverSortableContext) {
                    targetModuleName = mod.module_name;
                    break;
                  }
                }
              }

              if (targetModuleName) {
                const featurePath = active.data.current?.path;
                if (featurePath) {
                  try {
                    const response = await fetch(`/api/modules/${encodeURIComponent(targetModuleName)}/features`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: featurePath }),
                    });
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to add feature');
                    }
                    const updatedModules = await response.json();
                    setModules(() => updatedModules);
                  } catch (error) { console.error('Error adding feature:', error); }
                }
                return;
              }
            }

            // CASO 2: Reordenar Módulos
            const isModuleDrag = active.data.current?.type === 'module';
            if (isModuleDrag) {
              if (active.id !== over.id) {
                const oldIndex = modules.findIndex((m) => m.module_name === active.id);
                const newIndex = modules.findIndex((m) => m.module_name === over.id);
                setModules((currentModules: Module[]) => arrayMove(currentModules, oldIndex, newIndex));
                setIsModifiedByDrag(true);
              }
              return;
            }

            // CASO 3: Reordenar Features dentro del mismo módulo
            const isFeatureDrag = active.data.current?.type === 'feature';
            if (isFeatureDrag) {
              const activeContainer = active.data.current?.sortable.containerId;
              const overContainer = over.data.current?.sortable.containerId;

              if (activeContainer === overContainer) {
                const moduleName = activeContainer;
                const module = modules.find(m => m.module_name === moduleName);
                if (!module) return;
                const oldIndex = module.features.findIndex(f => f.id === active.id);
                const newIndex = module.features.findIndex(f => f.id === over.id);
                if (oldIndex !== newIndex) {
                  const reorderedFeatures = arrayMove(module.features, oldIndex, newIndex);
                  const updatedFeaturesWithOrder = reorderedFeatures.map((feature, index) => ({ ...feature, order: index + 1 }));
                  const originalModules = modules;
                  setModules(current => current.map(m => m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m));
                  try {
                    const featuresToSave = updatedFeaturesWithOrder.map(({ display_tags, scenarios, color, ...rest }) => rest);
                    const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ features: featuresToSave }),
                    });
                    if (!response.ok) setModules(originalModules);
                  } catch (e) {
                    console.error('Error reordering:', e);
                    setModules(originalModules);
                  }
                }
              }
              return;
            }
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>

            {/* 2. SIDEBAR (File Explorer) - Only visible in Editor Mode */}
            {activePerspective === 'editor' && (
              <>
                <Paper
                  elevation={1}
                  sx={{ width: fileExplorerWidth, minWidth: '150px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                >
                  <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', fontWeight: 'bold' }}>Explorer</Box>
                  {isReady ? (
                    <FileExplorer onFileSelect={handleFileSelect} fontSize={fontSize} />
                  ) : (
                    <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>Loading explorer...</Typography>
                  )}
                </Paper>
                {/* Resizer Handle */}
                <Box
                  onMouseDown={handleMouseDown}
                  sx={{
                    width: '4px',
                    cursor: 'col-resize',
                    bgcolor: 'divider',
                    '&:hover': { bgcolor: 'primary.main' }
                  }}
                />
              </>
            )}

            {/* 3. MAIN WORKSPACE */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              {/* CONTENT AREA */}
              <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {activePerspective === 'editor' ? (
                  // --- EDITOR VIEW (Tabs: Code | Modules) ---
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                      <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        aria-label="editor tabs"
                        sx={{ minHeight: '48px', '& .MuiTab-root': { textTransform: 'none' } }}
                      >
                        <Tab
                          label={isDirty ? `${selectedFile?.name || 'Editor'} *` : (selectedFile?.name || 'Feature Editor')}
                          id="editor-tab-0"
                        />
                        <Tab label="Review Modules" id="editor-tab-1" />
                      </Tabs>
                    </Box>

                    {/* TabPanel 0: Feature Editor */}
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

                    {/* TabPanel 1: Modules Component */}
                    <TabPanel value={tabValue} index={1}>
                      {isReady && !isModulesLoading ? (
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
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
                          <CircularProgress size={40} thickness={4} />
                          <Typography variant="caption" color="text.secondary">Loading modules...</Typography>
                        </Box>
                      )}
                    </TabPanel>
                  </Box>
                ) : (
                  // --- ORCHESTRATOR VIEW (Execution Flow Only) ---
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 0, bgcolor: '#f5f5f5', overflow: 'hidden' }}>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                      {isReady && !isModulesLoading ? (
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
                          onScheduleTests={handleScheduleTests}
                          scheduledExecutionTime={scheduledExecutionTime}
                          onCancelSchedule={handleCancelSchedule}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
                          <CircularProgress size={40} thickness={4} />
                          <Typography variant="caption" color="text.secondary">Loading execution plan...</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* 4. CONSOLE DOCK */}
              {/* Hide console entirely in editor mode as per user request */}
              {isConsoleOpen && activePerspective !== 'editor' && (
                <Paper
                  elevation={8}
                  sx={{
                    height: '250px',
                    borderTop: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1100
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="overline" sx={{ flexGrow: 1, fontWeight: 'bold' }}>Console / Output</Typography>
                    <IconButton size="small" onClick={toggleConsole}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    <ConsoleView logs={logs} />
                  </Box>
                </Paper>
              )}

            </Box>

          </Box>
          {/* Aquí renderizamos el "fantasma" del elemento que se está arrastrando */}
          <DragOverlay dropAnimation={null}>
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
          isLoading={isModulesLoading}
          statusType={status?.type || 'info'}
        />
      </Box >
    </ThemeProvider >
  );
};

export default MainLayout;