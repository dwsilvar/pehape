import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Tabs, Tab, IconButton, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import CodeIcon from '@mui/icons-material/Code';
import AppToolbar from './AppToolbar';
import FileExplorer from './FileExplorer';
import { FeatureEditor } from './FeatureEditor';
import StatusBar from './StatusBar';
import ModulesComponent from './Modules';
import { FileData, Module } from '../types';
import { useExecutionOrder as useGlobalExecutionOrder } from '../hooks/useExecutionOrder';
import { useLayout } from '../context/LayoutContext';

interface MainLayoutProps {
  modules?: Module[];
  setModules?: React.Dispatch<React.SetStateAction<Module[]>>;
  onSaveModules?: (modulesToSave?: Module[]) => void;
  selectedFile?: string | null;
  draggedItemPath?: string | null;
  activeDragId?: string | null;
}

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

const MainLayout: React.FC<MainLayoutProps> = ({
  modules: propsModules,
  setModules: propsSetModules,
  onSaveModules: propsOnSaveModules,
  selectedFile: propsSelectedFile,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Internal state for file selection if not provided via props
  const [internalSelectedFile, setInternalSelectedFile] = useState<FileData | null>(null);
  const selectedFile = (propsSelectedFile && typeof propsSelectedFile === 'string')
    ? { name: propsSelectedFile.split('/').pop() || '', path: propsSelectedFile, type: 'file' as const } as FileData
    : internalSelectedFile;

  const [editorContent, setEditorContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [fontSize] = useState(14);

  // Global state from hook if not provided via props
  const { modules: hookModules, setModules: hookSetModules, isLoading: isModulesLoading, refetch } = useGlobalExecutionOrder();

  const modules = propsModules || hookModules;
  const setModules = propsSetModules || hookSetModules;

  const [tabValue, setTabValue] = useState(0);
  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  const [focusedModule, setFocusedModule] = useState<string | null>(null);
  const [validationTexts, setValidationTexts] = useState<string[]>([]);
  const lastOpenedFileRef = useRef<string | null>(null);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [stopOnFailure, setStopOnFailure] = useState(false);

  const {
    activeView: activePerspective, setActiveView, isConsoleOpen, toggleConsole,
    logs, setLogs,
    scenarioStatuses, setScenarioStatuses,
    isExecuting, setIsExecuting,
    runningFeatureId, setRunningFeatureId,
    scheduledExecutionTime, setScheduledExecutionTime,
    taskStatuses, setTaskStatuses,
    scenarioGifs, setScenarioGifs,
  } = useLayout();

  const [currentScenarioName, setCurrentScenarioName] = useState<string | null>(null);
  const [executionOrderCollapsed, setExecutionOrderCollapsed] = useState<Set<string>>(new Set());
  const [modulesViewCollapsed, setModulesViewCollapsed] = useState<Set<string>>(new Set());
  const [fileExplorerWidth, setFileExplorerWidth] = useState(250);

  const [missingFiles, setMissingFiles] = useState<{
    missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
    missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
  }>({ missing_features: [], missing_tasks: [] });

  useEffect(() => {
    const fetchValidation = async () => {
      try {
        const response = await fetch('/api/validate-files');
        if (response.ok) {
          const data = await response.json();
          setMissingFiles(data);
        }
      } catch (error) {
        console.error('Error fetching file validation:', error);
      }
    };
    fetchValidation();
  }, [modules]);

  const hasWarnings = missingFiles.missing_features.length > 0 || missingFiles.missing_tasks.length > 0;

  const layoutRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !layoutRef.current) return;
    const layoutRect = layoutRef.current.getBoundingClientRect();
    const newWidth = e.clientX - layoutRect.left;
    const maxWidth = layoutRect.width / 3;
    const minWidth = 150;
    const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setFileExplorerWidth(clampedWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    setIsSidebarResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsSidebarResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
    await new Promise(resolve => setTimeout(resolve, 0));
    await fetch('/api/ui-settings/module-collapse', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view, section_id: sectionId, is_collapsed: newCollapsedState }),
    });
  }, []);

  const handleToggleExecutionOrderCollapse = createToggleHandler('execution_order', setExecutionOrderCollapsed);
  const handleToggleModulesViewCollapse = createToggleHandler('modules_view', setModulesViewCollapsed);

  const cleanModulesForSave = (modulesToClean: Module[]): any[] => {
    return modulesToClean.map(module => {
      const { color, is_collapsed, ...restOfModule } = module;
      return {
        ...restOfModule,
        features: module.features.map(feature => {
          const { display_tags, scenarios, color, ...restOfFeature } = feature;
          return restOfFeature;
        }),
      };
    });
  };

  const handleSave = useCallback(async (modulesToSave?: Module[]) => {
    try {
      const payload = cleanModulesForSave(modulesToSave || modulesRef.current);
      const response = await fetch('/api/execution-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const updatedModules = await response.json();
      setModules(updatedModules);
      if (propsOnSaveModules) propsOnSaveModules(updatedModules);
    } catch (error) {
      console.error('Error saving execution order:', error);
    }
  }, [setModules, propsOnSaveModules]);

  const handleFileSelect = useCallback(async (path: string) => {
    const name = path.split('/').pop() || path;
    setInternalSelectedFile({ name, path, type: 'file' });
    setEditorContent(t('editor.loading_file', { path }));
    try {
      const response = await fetch(`/api/features/${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to fetch file content');
      const data = await response.json();
      setEditorContent(data.content);
      setIsDirty(false);
      setTabValue(0);
      setActiveView('editor');
    } catch (error) {
      console.error("Error loading file:", error);
      setEditorContent(t('editor.error_loading', { path }));
      setIsDirty(false);
    }
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fileToOpen = params.get('openFile');
    if (fileToOpen) {
      if (lastOpenedFileRef.current === fileToOpen) return;
      if (activePerspective !== 'editor') setActiveView('editor');
      lastOpenedFileRef.current = fileToOpen;
      handleFileSelect(fileToOpen);
    } else {
      lastOpenedFileRef.current = null;
    }
  }, [location.search, activePerspective, setActiveView, handleFileSelect]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
      setIsDirty(true);
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
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }, [selectedFile, editorContent, isDirty]);

  const navigateToModule = useCallback((moduleName: string) => {
    setTabValue(1);
    setFocusedModule(moduleName);
  }, []);

  const clearFocusedModule = useCallback(() => {
    setFocusedModule(null);
  }, []);

  const handleRefreshModules = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Error refreshing modules:', error);
    }
  }, [refetch]);

  const connectToLogStream = useCallback(() => {
    setLogs(prev => [...prev, t('orchestrator.connecting_logs')]);
    const eventSource = new EventSource('/api/stream-logs');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'scenario_status') {
        let featureId = data.feature_id?.replace(/\\/g, '/');
        if (featureId) {
          const uniqueId = `${featureId}::${data.name}`;
          if (data.status === 'running') {
            setRunningFeatureId(featureId);
            setCurrentScenarioName(data.name);
          }
          if (data.gifExecutionId) setScenarioGifs(prev => ({ ...prev, [uniqueId]: data.gifExecutionId }));
          setScenarioStatuses(prev => ({ ...prev, [uniqueId]: data.status }));
        }
        return;
      }
      if (data.type === 'task_status') {
        const featureId = data.feature_id?.replace(/\\/g, '/');
        const taskResult = data.task;
        if (featureId && taskResult && typeof taskResult.ui_index === 'number') {
          setTaskStatuses(prev => ({
            ...prev,
            [featureId]: { ...(prev[featureId] || {}), [taskResult.ui_index]: { status: taskResult.status, error: taskResult.error } }
          }));
        }
        return;
      }
      if (data.type === 'report_ready' && data.reportUrl) {
        setLogs(prev => [...prev, `--- ${t('common.finished')} ---`]);
        navigate('/reports');
        return;
      }
      if (data.log === '---EXECUTION_FINISHED---' || data.log === '---EXECUTION_STOPPED_BY_USER---' || data.log === '---EXECUTION_KILLED_BY_WATCHDOG---') {
        setLogs(prev => [...prev, data.log]);
        setIsExecuting(false);
        setRunningFeatureId(null);
        setCurrentScenarioName(null);  // Clear current scenario
        setScenarioStatuses({});       // Clear all scenario statuses
        setScenarioGifs({});           // Clear all GIF references
        setTaskStatuses({});           // Clear all task statuses
        eventSource.close();
      } else if (data.log) {
        setLogs(prev => [...prev, data.log]);
      }
    };
    eventSource.onerror = () => eventSource.close();
  }, [setLogs, setIsExecuting, setRunningFeatureId, setScenarioStatuses, setScenarioGifs, setTaskStatuses, t, navigate]);

  const handleRunTests = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([t('orchestrator.starting_execution')]);
    setScenarioStatuses({});
    setTaskStatuses({});
    setScenarioGifs({});
    setRunningFeatureId(null);
    try {
      const response = await fetch('/api/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_on_failure: stopOnFailure })
      });
      if (!response.ok) throw new Error('Failed to start execution');
      connectToLogStream();
    } catch (error) {
      console.error(error);
      setIsExecuting(false);
    }
  };

  const handleStopTests = async () => {
    try {
      await fetch('/api/stop-tests', { method: 'POST' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleScheduleTests = async (date: Date) => {
    try {
      await fetch('/api/schedule-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execution_time: date.toISOString() }),
      });
      setScheduledExecutionTime(date);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelSchedule = async () => {
    try {
      await fetch('/api/cancel-schedule', { method: 'POST' });
      setScheduledExecutionTime(null);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const scheduleResponse = await fetch('/api/schedule-status');
        if (scheduleResponse.ok) {
          const data = await scheduleResponse.json();
          setScheduledExecutionTime(data.scheduled ? new Date(data.execution_time) : null);
        }
        const executionResponse = await fetch('/api/execution-status');
        if (executionResponse.ok) {
          const data = await executionResponse.json();
          if (data.running && !isExecuting) {
            setIsExecuting(true);
            connectToLogStream();
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [isExecuting, connectToLogStream, setIsExecuting, setScheduledExecutionTime]);

  const progress = useMemo(() => {
    if (!isExecuting) return undefined;
    const activeScenarios = modules.flatMap(m => m.features).filter(f => f.active).flatMap(f => f.scenarios || []);
    if (activeScenarios.length === 0) return 0;
    const completed = Object.values(scenarioStatuses).filter(s => ['passed', 'failed', 'skipped'].includes(s)).length;
    return Math.min(100, (completed / activeScenarios.length) * 100);
  }, [isExecuting, modules, scenarioStatuses]);

  return (
    <Box ref={layoutRef} sx={{ display: 'flex', flexDirection: 'column', height: '100vh', pb: '24px', overflow: 'hidden' }}>
      <AppToolbar title="Pehape" icon={<CodeIcon />} showViewMenu={true} />

      <Box sx={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        {activePerspective === 'editor' && (
          <>
            <Paper elevation={0} sx={{ width: fileExplorerWidth, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', fontWeight: 'bold' }}>{t('common.explorer')}</Box>
              <FileExplorer onFileSelect={handleFileSelect} fontSize={fontSize} onRefreshModules={handleRefreshModules} />
            </Paper>
            <Box onMouseDown={handleMouseDown} sx={{ width: '4px', cursor: 'col-resize', bgcolor: 'divider', '&:hover': { bgcolor: 'primary.main' } }} />
          </>
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label={selectedFile?.name || t('common.editor')} />
                <Tab label={t('common.modules')} />
              </Tabs>
              <TabPanel value={tabValue} index={0}>
                <FeatureEditor
                  selectedFile={selectedFile}
                  editorContent={editorContent}
                  onEditorChange={handleEditorChange}
                  onSave={handleSaveFile}
                  isDirty={isDirty}
                  theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                  isResizing={isSidebarResizing}
                  validationTexts={validationTexts}
                  onValidationTextsChange={setValidationTexts}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <ModulesComponent
                  modules={modules}
                  setModules={setModules}
                  fontSize={fontSize}
                  onFeatureSelect={handleFileSelect}
                  onRunTests={handleRunTests}
                  onSaveModules={handleSave}
                  scenarioStatuses={scenarioStatuses}
                  setScenarioStatuses={setScenarioStatuses}
                  isExecuting={isExecuting}
                  runningFeatureId={runningFeatureId}
                  collapsedSections={modulesViewCollapsed}
                  onToggleSectionCollapse={handleToggleModulesViewCollapse}
                  navigateToModule={navigateToModule}
                  onStopTests={handleStopTests}
                  focusedModule={focusedModule}
                  onFocusConsumed={clearFocusedModule}
                />
              </TabPanel>
            </Box>
          </Box>
        </Box>
      </Box>

      <StatusBar
        message={''}
        isExecuting={isExecuting}
        progress={progress}
        onStop={handleStopTests}
        currentFeature={runningFeatureId || undefined}
        currentScenario={currentScenarioName || undefined}
      />
    </Box>
  );
};

export default MainLayout;