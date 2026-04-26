import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Sidebar from './components/Sidebar';
import AppNavbar from './components/AppNavbar';
import HomePage from './pages/HomePage';
import MaintenancePage from './pages/MaintenancePage';
import TasksPage from './pages/TasksPage';
import OCRResourcesPage from './pages/OCRResourcesPage';
import RunningAppsPage from './pages/RunningAppsPage';
import ReportsPage from './pages/ReportsPage';
import FeatureEditorPage from './pages/FeatureEditorPage';
import TestPlanPage from './pages/TestPlanPage';
import { useExecutionOrder } from './hooks/useExecutionOrder';

import { LayoutProvider, useLayout } from './context/LayoutContext';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getAppTheme } from './theme';

const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeName } = useLayout();
  const muiTheme = React.useMemo(() => getAppTheme(themeName), [themeName]);

  React.useEffect(() => {
    localStorage.setItem('editorTheme', themeName);
  }, [themeName]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};


const AppLayout: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { modules, setModules } = useExecutionOrder();

  // Drag and Drop State (Lifted up because FileExplorer is in Sidebar and DropTarget is in HomePage)
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedItemPath, setDraggedItemPath] = useState<string | null>(null);
  const [, setIsOverExecutionOrder] = useState(false);
  const navigate = useNavigate();

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    navigate('/'); // Ensure we are looking at the editor
  };

  const onSaveModules = async (modulesToSave?: any) => {
    const dataToSave = modulesToSave || modules;
    if (modulesToSave) setModules(modulesToSave);
    try {
      await fetch('/api/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
    } catch (e) {
      console.error('Failed to save modules', e);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    if (active.data.current?.type === 'file-explorer-feature') {
      setDraggedItemPath(active.data.current.path);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overId = over?.id;
    const isOverModule = typeof overId === 'string' && overId.startsWith('module-drop-area-');
    setIsOverExecutionOrder(overId === 'execution-order-droppable-area' || isOverModule);
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveDragId(null);
      setDraggedItemPath(null);
      setIsOverExecutionOrder(false);
      return;
    }

    // Logic 1: File Explorer -> Module (Add Feature)
    if (active.data.current?.type === 'file-explorer-feature' && over?.data.current?.moduleName) {
      const featurePath = active.data.current.path;
      const moduleName = over.data.current.moduleName;

      try {
        const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: featurePath }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add feature to module');
        }

        const updatedModules = await response.json();
        setModules(updatedModules);

      } catch (error) {
        console.error('Error al agregar el feature:', error);
      }
    }

    // Logic 2: Reordenar Módulos
    if (active.data.current?.type === 'module' && over.data.current?.type === 'module' && active.id !== over.id) {
      setModules((prev) => {
        const oldIndex = prev.findIndex(m => m.module_name === active.id);
        const newIndex = prev.findIndex(m => m.module_name === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const newModules = arrayMove(prev, oldIndex, newIndex).map((m, i) => ({
          ...m,
          order: i + 1
        }));

        // Notificar al backend (disparar y olvidar o manejar error)
        fetch('/api/modules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newModules)
        }).catch(err => console.error('Error al guardar el nuevo orden de módulos:', err));

        return newModules;
      });
    }

    // Logic 3: Reordenar Features dentro de un módulo
    if (active.data.current?.type === 'feature' && over.data.current?.type === 'feature' && active.id !== over.id) {
      const activeContainer = active.data.current.sortable.containerId;
      const overContainer = over.data.current.sortable.containerId;

      if (activeContainer === overContainer) {
        setModules((prev) => {
          const moduleName = activeContainer;
          return prev.map(m => {
            if (m.module_name === moduleName) {
              const oldIndex = m.features.findIndex(f => f.id === active.id);
              const newIndex = m.features.findIndex(f => f.id === over.id);
              if (oldIndex === -1 || newIndex === -1) return m;

              const newFeatures = arrayMove(m.features, oldIndex, newIndex).map((f, i) => ({
                ...f,
                order: i + 1
              }));

              // Notificar al backend
              const featuresToSave = newFeatures.map(({ display_tags, scenarios, color, ...rest }) => rest);
              fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featuresToSave),
              }).catch(err => console.error('Error al guardar el nuevo orden de features:', err));

              return { ...m, features: newFeatures };
            }
            return m;
          });
        });
      }
    }

    setActiveDragId(null);
    setDraggedItemPath(null);
    setIsOverExecutionOrder(false);
  }, [setModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AppNavbar />
          <Routes>
            <Route path="/" element={<TestPlanPage />} />
            <Route path="/editor" element={
              <HomePage
                selectedFile={selectedFile}
                draggedItemPath={draggedItemPath}
                activeDragId={activeDragId}
                modules={modules}
                setModules={setModules}
                onSaveModules={onSaveModules}
              />
            } />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/ocr-resources" element={<OCRResourcesPage />} />
            <Route path="/running-apps" element={<RunningAppsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/feature-editor" element={<FeatureEditorPage />} />
          </Routes>
        </Box>
      </Box>
    </DndContext>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LayoutProvider>
        <ThemeWrapper>
          <AppLayout />
        </ThemeWrapper>
      </LayoutProvider>
    </BrowserRouter>
  );
};

export default App;