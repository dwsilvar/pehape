import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import MaintenancePage from './pages/MaintenancePage';
import TasksPage from './pages/TasksPage';
import OCRResourcesPage from './pages/OCRResourcesPage';
import RunningAppsPage from './pages/RunningAppsPage';
import ReportsPage from './pages/ReportsPage';
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

    setActiveDragId(null);
    setDraggedItemPath(null);
    setIsOverExecutionOrder(false);
  }, [setModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor)
  );

  const onSaveModules = async (modulesToSave?: any) => {
    if (modulesToSave) setModules(modulesToSave);
    try {
      await fetch('/api/modules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modulesToSave || modules) });
    } catch (e) {
      console.error('Failed to save modules', e);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={
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