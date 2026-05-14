/**
 * ScenarioFlowNode — v2.0
 *
 * Layout: horizontal flex
 *   LEFT sidebar (36px): drag | moveUp | moveDown | delete (con confirmación)
 *   RIGHT content:
 *     1. Scenario: icono + label "Scenario" + nombre (prominente)
 *     2. Tags: chips de colores
 *     3. Divider
 *     4. Feature: icono + label "Feature" + nombre recortado (path completo en tooltip)
 */
import React, { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box, Typography, Chip, IconButton, Tooltip, Paper, alpha, useTheme, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ScenarioRef } from '../../types';
import { FeatureIcon, ScenarioIcon } from '../PehapeIcons';
import ScenarioDetailPanel from './ScenarioDetailPanel';

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT_FAMILY = '"Inter", "Roboto", sans-serif';
const WIDTH       = '450px';
const MAX_WIDTH   = '600px';

// ── Tag color system ──────────────────────────────────────────────────────────
const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScenarioFlowNodeProps {
  scenario: ScenarioRef;
  index: number;
  total: number;
  hasMixedVersionTags?: boolean;
  compact?: boolean;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

function detectMixedVersions(tags: string[]): boolean {
  const lower = tags.map(t => t.toLowerCase());
  return lower.includes('@v1') && lower.includes('@v2');
}

// ── Component ─────────────────────────────────────────────────────────────────
const ScenarioFlowNode: React.FC<ScenarioFlowNodeProps> = ({
  scenario, index, total, hasMixedVersionTags = false, compact = false,
  onRemove, onMoveUp, onMoveDown,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hovered, setHovered]         = useState(false);

  const handleContextMenu  = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  }, []);
  const handleCloseMenu    = useCallback(() => setContextMenu(null), []);
  const handleViewDetail   = useCallback(() => { handleCloseMenu(); setDetailOpen(true); }, [handleCloseMenu]);
  const handleEditScenario = useCallback(() => {
    handleCloseMenu();
    navigate(`/feature-editor?file=${encodeURIComponent(scenario.featurePath)}`);
  }, [handleCloseMenu, navigate, scenario.featurePath]);

  const handleDeleteClick   = () => setConfirmOpen(true);
  const handleDeleteCancel  = () => setConfirmOpen(false);
  const handleDeleteConfirm = () => { setConfirmOpen(false); onRemove(scenario.id); };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scenario.id,
    data: { type: 'flow-scenario' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 9999 : undefined,
  };

  const isVersionConflict = hasMixedVersionTags || detectMixedVersions(scenario.tags);
  const visibleTags   = scenario.tags.slice(0, 5);
  const extraTagCount = Math.max(0, scenario.tags.length - 5);

  // ── Computed colors ──────────────────────────────────────────────────────────
  const cardBg      = theme.palette.custom.cardBg;
  const borderColor = isVersionConflict
    ? theme.palette.error.main
    : isDragging
      ? theme.palette.primary.main
      : theme.palette.custom.border;
  const cardShadow  = isDark ? '0 4px 6px -1px rgba(0,0,0,0.5)' : '0 1px 3px 0 rgba(0,0,0,0.1)';
  const sidebarBg   = isDark
    ? alpha(theme.palette.common.white, 0.03)
    : alpha(theme.palette.common.black, 0.025);
  const sidebarBorder = isDark ? alpha(theme.palette.common.white, 0.07) : alpha(theme.palette.common.black, 0.06);
  const menuBg      = theme.palette.custom.bgSidebar;
  const menuText    = theme.palette.text.primary;

  // Feature display name: filename only, full path in tooltip
  const featureDisplayName = scenario.featureName || scenario.featurePath.split('/').pop() || scenario.featurePath;

  // ── COMPACT ROW ─────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <>
        <Box
          ref={setNodeRef}
          style={style}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}
        >
          <Box
            sx={{
              width: WIDTH,
              maxWidth: MAX_WIDTH,
              borderRadius: '6px',
              border: `1px solid ${isVersionConflict ? theme.palette.error.main : hovered ? theme.palette.primary.main : theme.palette.custom.border}`,
              borderLeft: `3px solid ${isVersionConflict ? theme.palette.error.main : theme.palette.primary.main}`,
              backgroundColor: hovered
                ? (isDark ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04))
                : cardBg,
              fontFamily: FONT_FAMILY,
              overflow: 'hidden',
              transition: 'all 0.18s ease',
              boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : 'none',
              opacity: isDragging ? 0.4 : 1,
            }}
          >
            {/* Main row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.6, minHeight: 38 }}>
              {/* Index badge */}
              <Box
                sx={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>
                  {index + 1}
                </Typography>
              </Box>

              {/* Drag handle */}
              <Box
                {...listeners} {...attributes}
                sx={{
                  cursor: isDragging ? 'grabbing' : 'grab',
                  color: isDark ? '#475569' : '#94a3b8',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <DragIndicatorRoundedIcon sx={{ fontSize: 14 }} />
              </Box>

              {/* Scenario name */}
              <Typography
                sx={{
                  flex: 1, minWidth: 0,
                  fontSize: '0.82rem', fontWeight: 600,
                  color: 'text.primary', fontFamily: FONT_FAMILY,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {scenario.scenarioName}
              </Typography>

              {/* Tags (max 2 in compact) */}
              <Box sx={{ display: 'flex', gap: 0.4, flexShrink: 0, alignItems: 'center' }}>
                {scenario.tags.slice(0, 2).map(tag => {
                  const tc = tagColor(tag);
                  return (
                    <Chip key={tag} label={tag} size="small"
                      sx={{
                        height: 16, fontSize: '0.58rem', fontWeight: 700,
                        bgcolor: alpha(tc, 0.15), color: tc,
                        border: `1px solid ${alpha(tc, 0.35)}`,
                        borderRadius: '3px', '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  );
                })}
                {scenario.tags.length > 2 && (
                  <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', fontWeight: 600 }}>
                    +{scenario.tags.length - 2}
                  </Typography>
                )}
              </Box>

              {/* Version conflict */}
              {isVersionConflict && (
                <Tooltip title="Conflicto de versión" arrow>
                  <WarningAmberRoundedIcon sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />
                </Tooltip>
              )}

              {/* Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, ml: 0.5 }}>
                <Tooltip title={t('pages.testPlan.canvas.moveUp')} placement="top">
                  <span>
                    <IconButton size="small" disabled={index === 0} onClick={() => onMoveUp(scenario.id)} sx={{ p: 0.2 }}>
                      <KeyboardArrowUpRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('pages.testPlan.canvas.moveDown')} placement="top">
                  <span>
                    <IconButton size="small" disabled={index === total - 1} onClick={() => onMoveDown(scenario.id)} sx={{ p: 0.2 }}>
                      <KeyboardArrowDownRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('pages.testPlan.canvas.remove')} placement="top">
                  <IconButton
                    size="small"
                    onClick={handleDeleteClick}
                    sx={{ p: 0.2, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Hover-revealed Feature row */}
            <Box
              sx={{
                maxHeight: hovered ? '40px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.2s ease',
                borderTop: hovered ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, px: 1.5, py: 0.5 }}>
                <FeatureIcon size={11} color={theme.palette.text.disabled} sx={{ flexShrink: 0, mt: '1px' }} />
                <Typography
                  component="span"
                  sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', fontFamily: FONT_FAMILY, flexShrink: 0 }}
                >
                  {featureDisplayName}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'text.disabled', fontFamily: FONT_FAMILY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {scenario.featurePath}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Context menu & dialogs shared with expanded mode */}
        <Menu
          open={contextMenu !== null}
          onClose={handleCloseMenu}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
          slotProps={{ paper: { elevation: 8, sx: { minWidth: 210, borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: menuBg } } }}
        >
          <MenuItem onClick={handleEditScenario}>
            <ListItemIcon><EditRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} /></ListItemIcon>
            <ListItemText primary="Editar Scenario" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: FONT_FAMILY }} />
          </MenuItem>
          <Divider sx={{ my: 0.25 }} />
          <MenuItem onClick={handleViewDetail}>
            <ListItemIcon><VisibilityRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} /></ListItemIcon>
            <ListItemText primary="Ver Detalle" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: FONT_FAMILY }} />
          </MenuItem>
        </Menu>

        <Dialog open={confirmOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth
          slotProps={{ paper: { sx: { borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: menuBg } } }}
        >
          <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: FONT_FAMILY, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />
              Quitar del flujo
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pb: 1.5 }}>
            <DialogContentText sx={{ fontSize: '0.85rem', fontFamily: FONT_FAMILY, color: 'text.secondary' }}>
              ¿Quitar <strong style={{ color: theme.palette.text.primary }}>{scenario.scenarioName}</strong> del flujo?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
            <Button onClick={handleDeleteCancel} size="small" variant="outlined" sx={{ borderRadius: '6px', fontFamily: FONT_FAMILY, fontSize: '0.8rem', textTransform: 'none' }}>Cancelar</Button>
            <Button onClick={handleDeleteConfirm} size="small" variant="contained" color="error" sx={{ borderRadius: '6px', fontFamily: FONT_FAMILY, fontSize: '0.8rem', textTransform: 'none' }}>Quitar</Button>
          </DialogActions>
        </Dialog>

        <ScenarioDetailPanel scenario={scenario} open={detailOpen} onClose={() => setDetailOpen(false)} />
      </>
    );
  }

  return (
    <>
      {/* ── CARD ────────────────────────────────────────────────────────────── */}
      <Box
        ref={setNodeRef}
        style={style}
        onContextMenu={handleContextMenu}
        sx={{ display: 'flex', justifyContent: 'center', mb: 0 }}
      >
        <Paper
          elevation={0}
          sx={{
            width: WIDTH,
            maxWidth: MAX_WIDTH,
            borderRadius: '8px',
            border: `1px solid ${borderColor}`,
            backgroundColor: cardBg,
            boxShadow: isDragging
              ? '0 8px 24px rgba(0,0,0,0.18)'
              : isVersionConflict
                ? `0 0 0 2px ${alpha(theme.palette.error.main, 0.25)}, ${cardShadow}`
                : cardShadow,
            fontFamily: FONT_FAMILY,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            '&:hover': {
              boxShadow: isDragging ? undefined : `0 4px 12px rgba(0,0,0,0.12), ${cardShadow}`,
              borderColor: isVersionConflict ? theme.palette.error.main : theme.palette.primary.main,
            },
          }}
        >
          {/* ── LEFT SIDEBAR: controls ───────────────────────────────────────── */}
          <Box
            sx={{
              width: 34,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              bgcolor: sidebarBg,
              borderRight: `1px solid ${sidebarBorder}`,
            }}
          >
            {/* Top group: drag + move up + move down */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
              {/* 1. Drag handle */}
              <Tooltip title="Arrastrar" placement="left">
                <Box
                  {...listeners}
                  {...attributes}
                  sx={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    color: isDark ? '#475569' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                    p: 0.25,
                    '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) },
                  }}
                >
                  <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
              </Tooltip>

              {/* 2. Move up */}
              <Tooltip title={t('pages.testPlan.canvas.moveUp')} placement="left">
                <span>
                  <IconButton
                    size="small"
                    disabled={index === 0}
                    onClick={() => onMoveUp(scenario.id)}
                    sx={{ p: 0.25, borderRadius: '4px' }}
                  >
                    <KeyboardArrowUpRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </span>
              </Tooltip>

              {/* 3. Move down */}
              <Tooltip title={t('pages.testPlan.canvas.moveDown')} placement="left">
                <span>
                  <IconButton
                    size="small"
                    disabled={index === total - 1}
                    onClick={() => onMoveDown(scenario.id)}
                    sx={{ p: 0.25, borderRadius: '4px' }}
                  >
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* Bottom: delete */}
            <Tooltip title={t('pages.testPlan.canvas.remove')} placement="left">
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                sx={{
                  p: 0.25,
                  borderRadius: '4px',
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) },
                }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* ── RIGHT CONTENT AREA ───────────────────────────────────────────── */}
          <Box sx={{ flex: 1, minWidth: 0, p: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>

            {/* 1. SCENARIO — prominente ───────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
              <ScenarioIcon
                size={15}
                color={theme.palette.primary.main}
                sx={{ flexShrink: 0, mt: '2px' }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: theme.palette.primary.main,
                    fontFamily: FONT_FAMILY,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    display: 'block',
                    lineHeight: 1.2,
                    mb: 0.25,
                  }}
                >
                  Scenario
                </Typography>
                <Typography
                  component="div"
                  sx={{
                    fontSize: '0.93rem',
                    fontWeight: 700,
                    color: 'text.primary',
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}
                >
                  {scenario.scenarioName}
                </Typography>
              </Box>

              {/* Version conflict warning */}
              {isVersionConflict && (
                <Tooltip title="Conflicto de versión: @v1 y @v2 mezclados en el mismo flujo" arrow>
                  <WarningAmberRoundedIcon sx={{ fontSize: 15, color: theme.palette.error.main, flexShrink: 0, mt: '2px' }} />
                </Tooltip>
              )}
            </Box>

            {/* 2. TAGS ───────────────────────────────────────────────────── */}
            {scenario.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {visibleTags.map(tag => {
                  const tc = tagColor(tag);
                  return (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.63rem',
                        fontWeight: 700,
                        bgcolor: alpha(tc, 0.15),
                        color: tc,
                        border: `1px solid ${alpha(tc, 0.35)}`,
                        fontFamily: FONT_FAMILY,
                        borderRadius: '4px',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  );
                })}
                {extraTagCount > 0 && (
                  <Tooltip title={scenario.tags.slice(5).join(' · ')} arrow placement="top">
                    <Chip
                      label={`+${extraTagCount}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                        borderColor: 'divider',
                        fontFamily: FONT_FAMILY,
                        borderRadius: '4px',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            )}

            {/* 3. FEATURE — secundario ────────────────────────────────────── */}
            <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

            <Tooltip
              title={scenario.featurePath}
              placement="bottom-start"
              enterDelay={500}
              arrow
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'default' }}>
                <FeatureIcon
                  size={13}
                  color={theme.palette.text.disabled}
                  sx={{ flexShrink: 0 }}
                />
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.63rem',
                    fontWeight: 600,
                    color: 'text.disabled',
                    fontFamily: FONT_FAMILY,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    flexShrink: 0,
                  }}
                >
                  Feature
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                    fontFamily: FONT_FAMILY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {featureDisplayName}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* ── CONTEXT MENU ────────────────────────────────────────────────────── */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        slotProps={{
          paper: {
            elevation: 8,
            sx: {
              minWidth: 210,
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              bgcolor: menuBg,
              color: menuText,
              '& .MuiMenuItem-root': {
                py: 0.85, px: 1.5,
                fontSize: '0.82rem',
                color: menuText,
                fontFamily: FONT_FAMILY,
              },
            },
          },
        }}
      >
        <MenuItem id="ctx-edit-scenario" onClick={handleEditScenario}>
          <ListItemIcon>
            <EditRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText
            primary="Editar Scenario"
            primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: FONT_FAMILY, color: menuText }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.25, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />

        <MenuItem id="ctx-view-detail" onClick={handleViewDetail}>
          <ListItemIcon>
            <VisibilityRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText
            primary="Ver Detalle"
            primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: FONT_FAMILY, color: menuText }}
          />
        </MenuItem>
      </Menu>

      {/* ── DELETE CONFIRMATION DIALOG ───────────────────────────────────────── */}
      <Dialog
        open={confirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              bgcolor: menuBg,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: FONT_FAMILY, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />
            Quitar del flujo
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pb: 1.5 }}>
          <DialogContentText sx={{ fontSize: '0.85rem', fontFamily: FONT_FAMILY, color: 'text.secondary' }}>
            ¿Quitar <strong style={{ color: theme.palette.text.primary }}>{scenario.scenarioName}</strong> del flujo?
            Esta acción no elimina el scenario del archivo feature.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={handleDeleteCancel}
            size="small"
            variant="outlined"
            sx={{ borderRadius: '6px', fontFamily: FONT_FAMILY, fontSize: '0.8rem', textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            size="small"
            variant="contained"
            color="error"
            sx={{ borderRadius: '6px', fontFamily: FONT_FAMILY, fontSize: '0.8rem', textTransform: 'none' }}
          >
            Quitar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── DETAIL VIEW PANEL ───────────────────────────────────────────────── */}
      <ScenarioDetailPanel
        scenario={scenario}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
};

export default ScenarioFlowNode;
