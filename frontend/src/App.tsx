import React, { useState, useCallback } from 'react';
import { createBrowserRouter, RouterProvider, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Box, Alert, Button } from '@mui/material';
import { DndContext, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
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
import ExecutionPage from './pages/ExecutionPage';
import ConceptsGuidePage from './pages/ConceptsGuidePage';
import SettingsPage from './pages/SettingsPage';

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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');

  // Drag and Drop State (File Explorer -> Editor)
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedItemPath, setDraggedItemPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isTestPlanVisible = location.pathname === '/';

  React.useEffect(() => {
    const checkUpdateStatus = async () => {
      try {
        const res = await fetch('/api/update/status');
        if (res.ok) {
          const data = await res.json();
          if (data.local_update_available) {
            setUpdateAvailable(true);
            setUpdateVersion(data.local_update_version);
          } else {
            setUpdateAvailable(false);
          }
        }
      } catch (e) {
        console.error("Error checking updates on mount:", e);
      }
    };
    checkUpdateStatus();
  }, [location.pathname]);

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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null);
    setDraggedItemPath(null);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {updateAvailable && (
            <Alert 
              severity="info" 
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/settings')}>
                  Ver Detalles
                </Button>
              }
              sx={{ borderRadius: 0 }}
            >
              Nueva versión de la aplicación disponible localmente (v{updateVersion}).
            </Alert>
          )}
          <AppNavbar />
          <Box sx={{ display: isTestPlanVisible ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
            <TestPlanPage />
          </Box>
          <Routes>
            <Route path="/editor" element={
              <HomePage
                selectedFile={selectedFile}
                draggedItemPath={draggedItemPath}
                activeDragId={activeDragId}
              />
            } />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/ocr-resources" element={<OCRResourcesPage />} />
            <Route path="/running-apps" element={<RunningAppsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/feature-editor" element={<FeatureEditorPage />} />
            <Route path="/guide" element={<ConceptsGuidePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Box>
      </Box>
    </DndContext>
  );
};

const router = createBrowserRouter([
  {
    path: '*',
    element: <AppLayout />
  }
]);

const App: React.FC = () => {
  return (
    <LayoutProvider>
      <ThemeWrapper>
        <RouterProvider router={router} />
      </ThemeWrapper>
    </LayoutProvider>
  );
};

export default App;