import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Paper, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import CodeIcon from '@mui/icons-material/Code';
import AppToolbar from './AppToolbar';
import FileExplorer from './FileExplorer';
import { FeatureEditor } from './FeatureEditor';
import { FileData } from '../types';
import { useLayout } from '../context/LayoutContext';

interface MainLayoutProps {
  selectedFile?: string | null;
  draggedItemPath?: string | null;
  activeDragId?: string | null;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  selectedFile: propsSelectedFile,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();

  // Internal state for file selection if not provided via props
  const [internalSelectedFile, setInternalSelectedFile] = useState<FileData | null>(null);
  const selectedFile = (propsSelectedFile && typeof propsSelectedFile === 'string')
    ? { name: propsSelectedFile.split('/').pop() || '', path: propsSelectedFile, type: 'file' as const } as FileData
    : internalSelectedFile;

  const [editorContent, setEditorContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [fontSize] = useState(14);
  const [validationTexts, setValidationTexts] = useState<string[]>([]);
  const lastOpenedFileRef = useRef<string | null>(null);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [fileExplorerWidth, setFileExplorerWidth] = useState(250);

  const { activeView: activePerspective, setActiveView } = useLayout();

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
      setActiveView('editor');
    } catch (error) {
      console.error("Error loading file:", error);
      setEditorContent(t('editor.error_loading', { path }));
      setIsDirty(false);
    }
  }, [t, setActiveView]);

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

  return (
    <Box ref={layoutRef} sx={{ display: 'flex', flexDirection: 'column', height: '100vh', pb: '24px', overflow: 'hidden' }}>
      <AppToolbar title="Pehape" icon={<CodeIcon />} showViewMenu={true} />

      <Box sx={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        {activePerspective === 'editor' && (
          <>
            <Paper elevation={0} sx={{ width: fileExplorerWidth, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', fontWeight: 'bold' }}>{t('common.explorer')}</Box>
              <FileExplorer onFileSelect={handleFileSelect} fontSize={fontSize} />
            </Paper>
            <Box onMouseDown={handleMouseDown} sx={{ width: '4px', cursor: 'col-resize', bgcolor: 'divider', '&:hover': { bgcolor: 'primary.main' } }} />
          </>
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;