/**
 * FeatureEditorPage — styled with test-orchestrator-themes-v1
 *
 * design_system_id: test-orchestrator-themes-v1
 * theme_strategy: CSS Variables / Design Tokens (adapts to MUI theme mode)
 * primary_font: Inter, system-ui, sans-serif
 * monospace_font: Fira Code, monospace
 *
 * themes.dark:
 *   bg_main:    #0F172A   bg_sidebar: #1E293B   bg_canvas: #0B1120
 *   card_bg:    rgba(30,41,59,0.7)
 *   text_main:  #F8FAFC   text_muted: #94A3B8   border: rgba(255,255,255,0.1)
 *
 * themes.light:
 *   bg_main:    #F8FAFC   bg_sidebar: #FFFFFF   bg_canvas: #F1F5F9
 *   card_bg:    #FFFFFF
 *   text_main:  #1E293B   text_muted: #64748B   border: #E2E8F0
 *
 * shared_accents:
 *   primary: #38BDF8  success: #22C55E  error: #EF4444  warning: #F59E0B
 */
import React, { useState, useCallback, useRef } from 'react';
import { Box, useTheme, Typography, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer';
import { FeatureEditor } from '../components/FeatureEditor';
import { FileData } from '../types';
import CloseIcon from '@mui/icons-material/Close';
import CircleIcon from '@mui/icons-material/Circle';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';

// ── Shared accents (theme-invariant) ──────────────────────────────────────────
const ACCENT = {
  PRIMARY: '#38BDF8',
  SUCCESS: '#22C55E',
  ERROR:   '#EF4444',
  WARNING: '#F59E0B',
} as const;

// ── Font tokens ───────────────────────────────────────────────────────────────
const FONT = {
  PRIMARY: '"Inter", system-ui, sans-serif',
  MONO:    '"Fira Code", monospace',
} as const;

// ── Theme-aware token factory ─────────────────────────────────────────────────
// Returns the correct set of tokens based on the current MUI theme mode.
function useThemeTokens() {
  const { palette } = useTheme();
  const isDark = palette.mode === 'dark';

  return isDark
    ? {
        // themes.dark
        BG_MAIN:    '#0F172A',
        BG_SIDEBAR: '#1E293B',
        BG_CANVAS:  '#0B1120',
        CARD_BG:    'rgba(30, 41, 59, 0.7)',
        TEXT_MAIN:  '#F8FAFC',
        TEXT_MUTED: '#94A3B8',
        BORDER:     'rgba(255, 255, 255, 0.1)',
        SHADOW:     '0 4px 6px -1px rgba(0, 0, 0, 0.5)',  // component_overrides.shadow.dark
        EDITOR_THEME: 'vs-dark' as const,
        IS_DARK: true,
      }
    : {
        // themes.light
        BG_MAIN:    '#F8FAFC',
        BG_SIDEBAR: '#FFFFFF',
        BG_CANVAS:  '#F1F5F9',
        CARD_BG:    '#FFFFFF',
        TEXT_MAIN:  '#1E293B',
        TEXT_MUTED: '#64748B',
        BORDER:     '#E2E8F0',
        SHADOW:     '0 1px 3px 0 rgba(0, 0, 0, 0.1)',     // component_overrides.shadow.light
        EDITOR_THEME: 'light' as const,
        IS_DARK: false,
      };
}

// ── Tab model ────────────────────────────────────────────────────────────────
interface EditorTab {
  file: FileData;
  content: string;
  isDirty: boolean;
  validationTexts: string[];
  isLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
const FeatureEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const T = useThemeTokens();   // live theme tokens
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tabs state ──────────────────────────────────────────────────
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // ── Opened files ref to prevent double opening race conditions ──
  const openedFilesRef = useRef<Set<string>>(new Set());

  // ── Explorer key state (for force refreshing explorer) ──────────
  const [explorerKey, setExplorerKey] = useState(0);

  // ── Snackbar notification state ─────────────────────────────────
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  // ── File input reference for ZIP import ─────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resize state ────────────────────────────────────────────────
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(260);
  const layoutRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const activeTab = tabs.find(tab => tab.file.path === activeTabPath) ?? null;

  // ── Resize handlers ─────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    setExplorerWidth(Math.max(150, Math.min(e.clientX - rect.left, rect.width / 2)));
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

  // ── File selection ───────────────────────────────────────────────
  const handleFileSelect = useCallback(async (path: string) => {
    // Normalizar la ruta del archivo (eliminar el prefijo 'features/' si existe)
    let normalizedPath = path.replace(/\\/g, '/');
    if (normalizedPath.startsWith('features/')) {
      normalizedPath = normalizedPath.substring(9);
    }

    if (openedFilesRef.current.has(normalizedPath)) {
      setActiveTabPath(normalizedPath);
      return;
    }
    openedFilesRef.current.add(normalizedPath);

    const name = normalizedPath.split('/').pop() || normalizedPath;
    const loadingTab: EditorTab = {
      file: { name, path: normalizedPath, type: 'file' },
      content: t('editor.loading_file', { path: normalizedPath }),
      isDirty: false, validationTexts: [], isLoading: true,
    };
    setTabs(prev => {
      if (prev.some(tab => tab.file.path === normalizedPath)) return prev;
      return [...prev, loadingTab];
    });
    setActiveTabPath(normalizedPath);

    try {
      const res = await fetch(`/api/features/${encodeURIComponent(normalizedPath)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTabs(prev => prev.map(tab =>
        tab.file.path === normalizedPath ? { ...tab, content: data.content, isLoading: false } : tab
      ));
    } catch {
      setTabs(prev => prev.map(tab =>
        tab.file.path === normalizedPath
          ? { ...tab, content: t('editor.error_loading', { path: normalizedPath }), isLoading: false }
          : tab
      ));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // ── Initial Param Load ──────────────────────────────────────────
  const fileToOpen = searchParams.get('file');
  React.useEffect(() => {
    if (fileToOpen) {
      handleFileSelect(fileToOpen);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileToOpen]);

  // ── Editor change ────────────────────────────────────────────────
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined || !activeTabPath) return;
    setTabs(prev => prev.map(tab =>
      tab.file.path === activeTabPath ? { ...tab, content: value, isDirty: true } : tab
    ));
  }, [activeTabPath]);

  // ── Save ─────────────────────────────────────────────────────────
  const handleSaveFile = useCallback(async () => {
    if (!activeTab || !activeTab.isDirty) return;
    try {
      const res = await fetch(`/api/features/${encodeURIComponent(activeTab.file.path)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: activeTab.content }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      setTabs(prev => prev.map(tab =>
        tab.file.path === activeTab.file.path ? { ...tab, isDirty: false } : tab
      ));
    } catch (err) { console.error('Error saving file:', err); }
  }, [activeTab]);

  // ── Close tab ────────────────────────────────────────────────────
  const handleCloseTab = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    openedFilesRef.current.delete(path);
    setTabs(prev => {
      const remaining = prev.filter(tab => tab.file.path !== path);
      if (path === activeTabPath) {
        const idx = prev.findIndex(tab => tab.file.path === path);
        setActiveTabPath(remaining[Math.min(idx, remaining.length - 1)]?.file.path ?? null);
      }
      return remaining;
    });

    const currentParam = searchParams.get('file');
    let normalizedParam = currentParam ? currentParam.replace(/\\/g, '/') : null;
    if (normalizedParam && normalizedParam.startsWith('features/')) {
      normalizedParam = normalizedParam.substring(9);
    }

    if (normalizedParam === path) {
      searchParams.delete('file');
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTabPath, searchParams, setSearchParams]);

  // ── Export all features ──────────────────────────────────────────
  const handleExportAllFeatures = useCallback(async () => {
    try {
      const response = await fetch('/api/export-all-features');
      if (!response.ok) throw new Error('Failed to export features');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'all_features.zip');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSnackbar({
        open: true,
        message: 'Features exportados exitosamente.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error exporting features:', err);
      setSnackbar({
        open: true,
        message: 'Error al exportar features.',
        severity: 'error'
      });
    }
  }, []);

  // ── Import features ──────────────────────────────────────────────
  const handleImportFeatures = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    e.target.value = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
      setSnackbar({
        open: true,
        message: 'Importando features...',
        severity: 'info'
      });
      
      const res = await fetch('/api/import-features', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to import features');
      }

      const result = await res.json();
      setSnackbar({
        open: true,
        message: result.message || 'Features importados correctamente.',
        severity: 'success'
      });

      setExplorerKey(prev => prev + 1);
    } catch (err) {
      console.error('Error importing features:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Error al importar features.',
        severity: 'error'
      });
    }
  }, []);

  // ── Validation texts ─────────────────────────────────────────────
  const handleValidationTextsChange = useCallback(
    (update: React.SetStateAction<string[]>) => {
      if (!activeTabPath) return;
      setTabs(prev => prev.map(tab => {
        if (tab.file.path !== activeTabPath) return tab;
        const next = typeof update === 'function' ? update(tab.validationTexts) : update;
        return { ...tab, validationTexts: next };
      }));
    },
    [activeTabPath]
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Box
      ref={layoutRef}
      sx={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        bgcolor: T.BG_MAIN,       // themes.[mode].bg_main
        fontFamily: FONT.PRIMARY,  // identity.primary_font
      }}
    >
      {/* ══ LEFT PANEL: File Explorer ══════════════════════════════════
          themes.[mode].bg_sidebar
      ════════════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          width: explorerWidth,
          flexShrink: 0,
          bgcolor: T.BG_SIDEBAR,              // themes.[mode].bg_sidebar
          borderRight: `1px solid ${T.BORDER}`, // themes.[mode].border
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <Box
          sx={{
            px: 1.5,
            py: 0.9,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: `1px solid ${T.BORDER}`,
            bgcolor: T.IS_DARK
              ? 'rgba(15, 23, 42, 0.5)'
              : 'rgba(241, 245, 249, 0.8)',
            flexShrink: 0,
          }}
        >
          <FolderOpenRoundedIcon sx={{ fontSize: 15, color: ACCENT.PRIMARY }} />
          <Typography
            variant="overline"
            sx={{
              fontSize: '0.62rem',
              letterSpacing: 1.5,
              color: T.TEXT_MUTED,         // themes.[mode].text_muted
              fontWeight: 700,
              fontFamily: FONT.PRIMARY,
              flex: 1,
            }}
          >
            {t('common.file_explorer')}
          </Typography>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".zip"
            style={{ display: 'none' }}
          />
          <Tooltip title={t('editor.import_features') || "Importar features (.zip)"}>
            <IconButton
              size="small"
              onClick={handleImportFeatures}
              sx={{
                p: 0.25,
                color: T.TEXT_MUTED,
                '&:hover': { color: ACCENT.PRIMARY },
              }}
            >
              <FileUploadRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('editor.export_all_features') || "Exportar todos los features"}>
            <IconButton
              size="small"
              onClick={handleExportAllFeatures}
              sx={{
                p: 0.25,
                color: T.TEXT_MUTED,
                '&:hover': { color: ACCENT.PRIMARY },
              }}
            >
              <FileDownloadRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <FileExplorer key={explorerKey} onFileSelect={handleFileSelect} fontSize={13} />
        </Box>
      </Box>

      {/* ══ RESIZE HANDLE ══════════════════════════════════════════════
          shared_accents.primary on hover
      ════════════════════════════════════════════════════════════════ */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '4px',
          cursor: 'col-resize',
          bgcolor: T.BORDER,
          flexShrink: 0,
          transition: 'background-color 0.15s ease',
          '&:hover': { bgcolor: ACCENT.PRIMARY },
        }}
      />

      {/* ══ RIGHT PANEL: Tabs + Editor ════════════════════════════════
          themes.[mode].bg_canvas
      ════════════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          bgcolor: T.BG_CANVAS,              // themes.[mode].bg_canvas
        }}
      >
        {/* ── Tab bar ─────────────────────────────────────────────── */}
        {tabs.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              overflowX: 'auto',
              flexShrink: 0,
              borderBottom: `1px solid ${T.BORDER}`,
              bgcolor: T.BG_SIDEBAR,
              '&::-webkit-scrollbar': { height: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: T.TEXT_MUTED, borderRadius: 2 },
            }}
          >
            {tabs.map(tab => {
              const isActive = tab.file.path === activeTabPath;
              return (
                <Box
                  key={tab.file.path}
                  onClick={() => setActiveTabPath(tab.file.path)}
                  title={tab.file.path}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    minWidth: 110,
                    maxWidth: 210,
                    height: 36,
                    cursor: 'pointer',
                    flexShrink: 0,
                    borderRight: `1px solid ${T.BORDER}`,
                    // Active: canvas bg + primary top border
                    bgcolor: isActive ? T.BG_CANVAS : 'transparent',
                    borderTop: `2px solid ${isActive ? ACCENT.PRIMARY : 'transparent'}`,
                    transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    '&:hover': {
                      bgcolor: T.IS_DARK
                        ? 'rgba(56, 189, 248, 0.06)'
                        : 'rgba(56, 189, 248, 0.08)',
                    },
                  }}
                >
                  {/* Dirty indicator — shared_accents.warning */}
                  {tab.isDirty && (
                    <CircleIcon
                      sx={{
                        fontSize: 7,
                        color: ACCENT.WARNING,
                        flexShrink: 0,
                        animation: 'editorTabPulse 1.5s ease-in-out infinite',
                        '@keyframes editorTabPulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.3 },
                        },
                      }}
                    />
                  )}

                  {/* File name — identity.monospace_font: Fira Code */}
                  <Typography
                    noWrap
                    sx={{
                      fontSize: '0.74rem',
                      flexGrow: 1,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? T.TEXT_MAIN : T.TEXT_MUTED,
                      fontFamily: FONT.MONO,           // identity.monospace_font
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      letterSpacing: '-0.1px',
                    }}
                  >
                    {tab.file.name}
                  </Typography>

                  {/* Close button */}
                  <Tooltip
                    title="Cerrar"
                    placement="top"
                    arrow
                    componentsProps={{
                      tooltip: {
                        sx: {
                          bgcolor: T.BG_MAIN,
                          color: T.TEXT_MAIN,
                          border: `1px solid ${T.BORDER}`,
                          fontSize: '0.68rem',
                          fontFamily: FONT.PRIMARY,
                        },
                      },
                      arrow: { sx: { color: T.BG_MAIN } },
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={e => handleCloseTab(e, tab.file.path)}
                      sx={{
                        p: 0.25,
                        flexShrink: 0,
                        opacity: 0.4,
                        color: T.TEXT_MUTED,
                        '&:hover': { opacity: 1, color: ACCENT.ERROR },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}

        {/* ── Editor area ─────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {tabs.length === 0 ? (
            // Empty state — card_bg with shadow from component_overrides
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                bgcolor: T.BG_CANVAS,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 4,
                  py: 3.5,
                  borderRadius: '12px',
                  bgcolor: T.CARD_BG,           // themes.[mode].card_bg
                  boxShadow: T.SHADOW,           // component_overrides.test_scenario_node.shadow.[mode]
                  border: `1px solid ${T.BORDER}`,
                  backdropFilter: T.IS_DARK ? 'blur(12px)' : 'none',
                  transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    borderColor: ACCENT.PRIMARY,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px rgba(56, 189, 248, 0.12)`,
                  },
                }}
              >
                <CodeRoundedIcon
                  sx={{ fontSize: 44, color: ACCENT.PRIMARY, opacity: 0.65 }}
                />
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: T.TEXT_MAIN,
                    fontFamily: FONT.PRIMARY,
                    textAlign: 'center',
                  }}
                >
                  {t('editor.placeholder')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: T.TEXT_MUTED,
                    fontFamily: FONT.PRIMARY,
                    textAlign: 'center',
                    maxWidth: 280,
                    lineHeight: 1.6,
                  }}
                >
                  Selecciona un archivo .feature del explorador para comenzar a editar
                </Typography>
              </Box>
            </Box>
          ) : (
            // Render all tabs (keep Monaco instances alive)
            tabs.map(tab => (
              <Box
                key={tab.file.path}
                sx={{
                  height: '100%',
                  display: tab.file.path === activeTabPath ? 'flex' : 'none',
                  flexDirection: 'column',
                }}
              >
                <FeatureEditor
                  selectedFile={tab.file}
                  editorContent={tab.content}
                  onEditorChange={handleEditorChange}
                  onSave={handleSaveFile}
                  isDirty={tab.isDirty}
                  theme={T.EDITOR_THEME}     // adapts to themes.[mode]
                  isResizing={isSidebarResizing}
                  validationTexts={tab.validationTexts}
                  onValidationTextsChange={handleValidationTextsChange}
                />
              </Box>
            ))
          )}
        </Box>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FeatureEditorPage;
