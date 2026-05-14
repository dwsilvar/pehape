/**
 * ScenarioFlowNode — conforms to test-scenario-node-schema-v1 v1.3
 *
 * visual_constraints:
 *   width: 450px (fixed), max-width: 600px, centered in sequence, padding: 16px
 *   border: 1px solid #E2E8F0, background: #FFFFFF, border-radius: 8px
 *   box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1)
 *   NOTE: dashed hover removed — border_style is now "solid"
 *
 * typography:
 *   font_family: Inter, sans-serif
 *   text_wrapping: word-wrap, overflow: break-word, line_height: 1.5
 *
 * content_structure (ui_mapping):
 *   header_section → Feature: "{feature_name}"
 *     color:#64748B, font_weight:600, font_size:12px
 *   body_section   → Scenario: "{scenario_name}"
 *     color:#1E293B, font_weight:700, font_size:14px, margin_top:4px
 *   footer_section → tag_chips_container (max 5)
 *     chip: bg #F1F5F9, text #475569, border 1px solid #CBD5E1
 *
 * interactions:
 *   context_menu:
 *     trigger: right_click
 *     style: bg #FFFFFF, text #334155, shadow lg
 *     edit_scenario → disabled_with_tooltip (icon: edit_off, not_implemented)
 *     view_detail   → open_side_panel      (icon: visibility, active)
 *   detail_view_panel: right_overlay, width 500px, bg #F8FAFC
 *
 * interaction_feedback:
 *   - drag handle + sequence index on canvas presence
 *   - red outline if @v1 and @v2 mixed
 */
import React, { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box, Typography, Chip, IconButton, Tooltip, Paper, alpha, useTheme, Divider,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import EditOffRoundedIcon from '@mui/icons-material/EditOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ScenarioRef } from '../../types';
import { FeatureIndexIcon, ScenarioIcon } from '../PehapeIcons';
import ScenarioDetailPanel from './ScenarioDetailPanel';

// ── Schema v1.3 token constants ───────────────────────────────────────────────
const S = {
  // visual_constraints
  WIDTH:          '450px',
  MAX_WIDTH:      '600px',
  PADDING:        '16px',
  BORDER_COLOR:   '#E2E8F0',
  BG:             '#FFFFFF',
  BORDER_RADIUS:  '8px',
  BOX_SHADOW:     '0 1px 3px 0 rgba(0,0,0,0.1)',

  // content: Feature label
  FEAT_COLOR:     '#64748B',
  FEAT_WEIGHT:    600,
  FEAT_SIZE:      '12px',

  // content: Scenario label
  SCEN_COLOR:     '#1E293B',
  SCEN_WEIGHT:    700,
  SCEN_SIZE:      '14px',
  SCEN_MT:        '4px',

  // context_menu
  MENU_BG:        '#FFFFFF',
  MENU_TEXT:      '#334155',

  // typography
  FONT_FAMILY:    '"Inter", "Roboto", sans-serif',
  LINE_HEIGHT:    1.5,
} as const;

// ── Tag color system (mismo que ScenarioLibraryCard) ─────────────────────────
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

interface ScenarioFlowNodeProps {
  scenario: ScenarioRef;
  index: number;
  total: number;
  hasMixedVersionTags?: boolean;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

function detectMixedVersions(tags: string[]): boolean {
  const lower = tags.map(t => t.toLowerCase());
  return lower.includes('@v1') && lower.includes('@v2');
}

const ScenarioFlowNode: React.FC<ScenarioFlowNodeProps> = ({
  scenario, index, total, hasMixedVersionTags = false,
  onRemove, onMoveUp, onMoveDown,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const navigate = useNavigate();

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  }, []);
  const handleCloseMenu  = useCallback(() => setContextMenu(null), []);
  const handleViewDetail = useCallback(() => { handleCloseMenu(); setDetailOpen(true); }, [handleCloseMenu]);
  const handleEditScenario = useCallback(() => {
    handleCloseMenu();
    navigate(`/feature-editor?file=${encodeURIComponent(scenario.featurePath)}`);
  }, [handleCloseMenu, navigate, scenario.featurePath]);

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
  const visibleTags   = scenario.tags.slice(0, 5);   // max_display: 5
  const extraTagCount = Math.max(0, scenario.tags.length - 5);

  // Adaptive colors: use theme custom tokens
  const cardBg      = theme.palette.custom.cardBg;
  const borderColor = isVersionConflict
    ? theme.palette.error.main
    : isDragging
      ? theme.palette.primary.main
      : theme.palette.custom.border;
  const featColor   = theme.palette.text.secondary;
  const scenColor   = theme.palette.text.primary;
  // chipBg/chipText/chipBorder ahora son dinámicos por tag (ver tagColor())
  const menuBg      = theme.palette.custom.bgSidebar;
  const menuText    = theme.palette.text.primary;
  const cardShadow  = isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)' : S.BOX_SHADOW;

  return (
    <>
      <Box
        ref={setNodeRef}
        style={style}
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          justifyContent: 'center',   // alignment: centered_in_sequence
          mb: 0,                       // spacing owned by FlowConnector
        }}
      >
        <Paper
          elevation={0}
          sx={{
            // ── visual_constraints ──────────────────────────────────────────
            width: S.WIDTH,
            maxWidth: S.MAX_WIDTH,
            padding: S.PADDING,
            borderRadius: S.BORDER_RADIUS,
            border: `1px solid ${borderColor}`,  // border_style: solid, border_width: 1px
            backgroundColor: cardBg,
            boxShadow: isDragging
              ? `0 8px 24px rgba(0,0,0,0.18)`
              : isVersionConflict
                ? `0 0 0 2px ${alpha(theme.palette.error.main, 0.25)}, ${cardShadow}`
                : cardShadow,
            // ── typography ──────────────────────────────────────────────────
            fontFamily: S.FONT_FAMILY,
            lineHeight: S.LINE_HEIGHT,
            wordBreak: 'break-word',    // overflow_behavior: break-word
            overflowWrap: 'word-wrap',  // text_wrapping
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            cursor: 'context-menu',
            '&:hover': {
              boxShadow: isDragging ? undefined : `0 4px 12px rgba(0,0,0,0.12), ${cardShadow}`,
              borderColor: isVersionConflict ? theme.palette.error.main : theme.palette.primary.main,
            },
          }}
        >
          {/* ── HEADER SECTION ───────────────────────────────────────────────
              Feature: "{feature_name}"
              color:#64748B | font_weight:600 | font_size:12px
          ─────────────────────────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>

            {/* L4 FeatureIndexIcon — file_text_code with sequence number inside (brand-identity-v1) */}
            <FeatureIndexIcon
              size={28}
              color={isVersionConflict ? theme.palette.error.main : theme.palette.primary.main}
              label={index + 1}
            />

            <Typography
              component="span"
              sx={{
                flex: 1,
                color: featColor,
                fontWeight: S.FEAT_WEIGHT,
                fontSize: S.FEAT_SIZE,
                fontFamily: S.FONT_FAMILY,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Feature: &ldquo;{scenario.featureName || scenario.featurePath.split('/').pop()}&rdquo;
            </Typography>

            {isVersionConflict && (
              <Tooltip title="Conflicto de versión: @v1 y @v2 mezclados en el mismo flujo" arrow>
                <WarningAmberRoundedIcon sx={{ fontSize: 15, color: theme.palette.error.main, flexShrink: 0 }} />
              </Tooltip>
            )}

            {/* Drag handle */}
            <Box {...listeners} {...attributes} sx={{ cursor: isDragging ? 'grabbing' : 'grab', color: isDark ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', flexShrink: 0, '&:hover': { color: isDark ? '#94a3b8' : '#94a3b8' } }}>
              <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />

          {/* ── BODY SECTION ──────────────────────────────────────────────────
              Scenario: "{scenario_name}"
              color:#1E293B | font_weight:700 | font_size:14px | margin_top:4px
          ─────────────────────────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: '4px', mb: 1 }}>
            {/* L5 Scenario icon — play_square, brand-identity-v1 */}
            <ScenarioIcon
              size={15}
              color={scenColor}
              sx={{ flexShrink: 0, mt: '1px', opacity: 0.8 }}
            />
            <Typography
              component="div"
              sx={{
                color: scenColor,
                fontWeight: S.SCEN_WEIGHT,
                fontSize: S.SCEN_SIZE,
                fontFamily: S.FONT_FAMILY,
                lineHeight: S.LINE_HEIGHT,
                wordBreak: 'break-word',
              }}
            >
              Scenario: &ldquo;{scenario.scenarioName}&rdquo;
            </Typography>
          </Box>

          {/* ── FOOTER SECTION ───────────────────────────────────────────────
              tag_chips_container
              chip: bg #F1F5F9, text #475569, border 1px solid #CBD5E1, max_display:5
          ─────────────────────────────────────────────────────────────────── */}
          {scenario.tags.length > 0 && (
            <>
              <Divider sx={{ mb: 0.75, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />
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
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: alpha(tc, 0.15),
                        color: tc,
                        border: `1px solid ${alpha(tc, 0.35)}`,
                        fontFamily: S.FONT_FAMILY,
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
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                        borderColor: 'divider',
                        fontFamily: S.FONT_FAMILY,
                        borderRadius: '4px',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            </>
          )}

          {/* ── Actions row ────────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mt: 1, pt: 0.5, borderTop: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` }}>
            <Tooltip title={t('pages.testPlan.canvas.moveUp')}>
              <span>
                <IconButton size="small" disabled={index === 0} onClick={() => onMoveUp(scenario.id)} sx={{ p: 0.3 }}>
                  <KeyboardArrowUpRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('pages.testPlan.canvas.moveDown')}>
              <span>
                <IconButton size="small" disabled={index === total - 1} onClick={() => onMoveDown(scenario.id)} sx={{ p: 0.3 }}>
                  <KeyboardArrowDownRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('pages.testPlan.canvas.remove')}>
              <IconButton size="small" onClick={() => onRemove(scenario.id)} sx={{ p: 0.3, color: 'error.main' }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* ── CONTEXT MENU — trigger: right_click ──────────────────────────────
          style: bg #FFFFFF, text_color #334155, shadow lg
          edit_scenario  → disabled_with_tooltip (icon: edit_off, not_implemented)
          view_detail    → open_side_panel        (icon: visibility,  active)
      ─────────────────────────────────────────────────────────────────────── */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        slotProps={{
          paper: {
            elevation: 8,   // shadow: lg
            sx: {
              minWidth: 210,
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              bgcolor: menuBg,
              color: menuText,
              '& .MuiMenuItem-root': {
                py: 0.85,
                px: 1.5,
                fontSize: '0.82rem',
                color: menuText,
                fontFamily: S.FONT_FAMILY,
              },
            },
          },
        }}
      >
        {/* edit_scenario — active, icon: edit */}
        <MenuItem id="ctx-edit-scenario" onClick={handleEditScenario}>
          <ListItemIcon>
            <EditRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText primary="Editar Scenario" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: S.FONT_FAMILY, color: menuText }} />
        </MenuItem>

        <Divider sx={{ my: 0.25, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />

        {/* view_detail — active, icon: visibility */}
        <MenuItem id="ctx-view-detail" onClick={handleViewDetail}>
          <ListItemIcon>
            <VisibilityRoundedIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
          </ListItemIcon>
          <ListItemText primary="Ver Detalle" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: S.FONT_FAMILY, color: menuText }} />
        </MenuItem>
      </Menu>

      {/* ── DETAIL VIEW PANEL — right_overlay, 500px, bg #F8FAFC ──────────── */}
      <ScenarioDetailPanel
        scenario={scenario}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
};

export default ScenarioFlowNode;
