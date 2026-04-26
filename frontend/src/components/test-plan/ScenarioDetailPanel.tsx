/**
 * ScenarioDetailPanel — conforms to test-scenario-node-schema-v1 v1.1
 *
 * interactions.detail_view_panel:
 *   position: right_overlay
 *   width: 450px
 *   content:
 *     title: "Full Feature Detail"
 *     data_source: raw_gherkin_content
 *     format: code_highlight_gherkin
 *     features:
 *       - Complete Given/When/Then steps
 *       - Background steps (if any)
 *       - Examples tables (if scenario outline)
 */
import React, { useEffect, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Tooltip, CircularProgress,
  Divider, Chip, alpha, useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import { ScenarioRef } from '../../types';

interface ScenarioDetailPanelProps {
  scenario: ScenarioRef | null;
  open: boolean;
  onClose: () => void;
}

// ── Gherkin keyword → color map ───────────────────────────────────────────────
const KEYWORD_COLORS: Record<string, string> = {
  feature:     '#7c3aed',
  background:  '#0891b2',
  scenario:    '#0284c7',
  'scenario outline': '#0284c7',
  examples:    '#9333ea',
  given:       '#16a34a',
  when:        '#2563eb',
  then:        '#7c3aed',
  and:         '#d97706',
  but:         '#dc2626',
  '|':         '#6b7280',
  '#':         '#6b7280',
  '@':         '#db2777',
};

function colorLine(line: string): { color: string; isBold: boolean } {
  const trimmed = line.trim().toLowerCase();
  for (const [kw, color] of Object.entries(KEYWORD_COLORS)) {
    if (trimmed.startsWith(kw) || (kw === '@' && trimmed.startsWith('@')) || (kw === '#' && trimmed.startsWith('#'))) {
      return { color, isBold: ['feature', 'scenario', 'scenario outline', 'background', 'examples'].includes(kw) };
    }
  }
  if (trimmed.startsWith('|')) return { color: '#6b7280', isBold: false };
  return { color: '#cbd5e1', isBold: false };
}

const ScenarioDetailPanel: React.FC<ScenarioDetailPanelProps> = ({ scenario, open, onClose }) => {
  const theme = useTheme();
  const [rawGherkin, setRawGherkin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch raw_gherkin_content from backend when panel opens
  useEffect(() => {
    if (!open || !scenario) {
      setRawGherkin(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/features/${encodeURIComponent(scenario.featurePath)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setRawGherkin(data.content ?? '');
      })
      .catch(e => setError(`No se pudo cargar el feature: ${e.message}`))
      .finally(() => setIsLoading(false));
  }, [open, scenario]);

  const lines = rawGherkin?.split('\n') ?? [];

  // schema v1.3: detail_view_panel.style → bg #F8FAFC, border_left: 1px solid #E2E8F0
  const isDark = theme.palette.mode === 'dark';
  const panelBg      = theme.palette.custom.bgMain;
  const panelBorder  = theme.palette.custom.border;
  const headerBg     = theme.palette.custom.bgSidebar;
  const codeAreaBg   = theme.palette.custom.bgCanvas;
  const codeTextDef  = theme.palette.text.primary;

  const TAG_COLORS: Record<string, string> = {
    '@v1': '#6366f1', '@v2': '#ec4899',
  };
  function tagChipColor(tag: string) {
    if (TAG_COLORS[tag]) return TAG_COLORS[tag];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    const palette = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#22c55e','#14b8a6','#3b82f6'];
    return palette[Math.abs(hash) % palette.length];
  }

  return (
    // schema v1.3: position=right_overlay, width=500px, bg=#F8FAFC, border_left=1px solid #E2E8F0
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '500px',                                    // schema: width
          bgcolor: panelBg,                                  // schema: bg
          borderLeft: `1px solid ${panelBorder}`,           // schema: border_left
          color: isDark ? '#e2e8f0' : '#334155',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
           fontFamily: theme.typography.fontFamily,
        },
      }}
      ModalProps={{ keepMounted: false }}
    >
      {/* ── Panel header ── */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          borderBottom: `1px solid ${panelBorder}`,
          bgcolor: headerBg,
          flexShrink: 0,
        }}
      >
        <CodeRoundedIcon sx={{ fontSize: 18, color: '#7c3aed', mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* schema: title = "Full Feature Detail" */}
           <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: 1, textTransform: 'uppercase', fontFamily: theme.typography.fontFamily }}>
            Full Feature Detail
          </Typography>
          {scenario && (
            <>
               <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: theme.palette.text.primary, mt: 0.25, wordBreak: 'break-word', fontFamily: theme.typography.fontFamily }}>
                {scenario.scenarioName}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary, mt: 0.1, fontFamily: theme.typography.fontFamily }}>
                {scenario.featurePath}
              </Typography>
            </>
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: isDark ? '#64748b' : '#94a3b8', '&:hover': { color: isDark ? '#e2e8f0' : '#1e293b' }, p: 0.4, flexShrink: 0 }}>
          <CloseRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Tags strip ── */}
      {scenario && scenario.tags.length > 0 && (
        <Box sx={{ px: 2, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, borderBottom: `1px solid ${panelBorder}`, flexShrink: 0 }}>
          {scenario.tags.map(tag => {
            const color = tagChipColor(tag);
            return (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  bgcolor: alpha(color, 0.2),
                  color,
                  border: `1px solid ${alpha(color, 0.4)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* ── Gherkin code body (code_highlight_gherkin) ── */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: codeAreaBg,
           fontFamily: 'Fira Code, monospace',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: isDark ? '#334155' : '#cbd5e1', borderRadius: 2 },
        }}
      >
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, gap: 1.5 }}>
            <CircularProgress size={20} sx={{ color: '#7c3aed' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Cargando Gherkin…</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ px: 2, py: 3 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</Typography>
          </Box>
        )}

        {rawGherkin !== null && !isLoading && !error && (
          <Box component="pre" sx={{ m: 0, px: 2.5, py: 2, fontSize: '0.75rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {lines.map((line, i) => {
              const { color, isBold } = colorLine(line);
              // Highlight the active scenario name
              const isActiveScenario = scenario && line.trim().includes(scenario.scenarioName);
              return (
                <Box
                  key={i}
                  component="span"
                  sx={{
                    display: 'block',
                    color,
                    fontWeight: isBold ? 700 : 400,
                    bgcolor: isActiveScenario ? alpha('#7c3aed', 0.12) : 'transparent',
                    borderLeft: isActiveScenario ? '3px solid #7c3aed' : '3px solid transparent',
                    pl: isActiveScenario ? 1 : 0,
                    borderRadius: isActiveScenario ? '0 4px 4px 0' : 0,
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Line number */}
                  <Box component="span" sx={{ color: '#1e3a5f', userSelect: 'none', mr: 2, fontSize: '0.65rem', display: 'inline-block', minWidth: 24, textAlign: 'right' }}>
                    {i + 1}
                  </Box>
                  {line || '\u00A0'}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Footer note ── */}
      <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${panelBorder}`, flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.65rem', color: isDark ? '#475569' : '#94a3b8', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
          data_source: raw_gherkin_content · format: code_highlight_gherkin
        </Typography>
      </Box>
    </Drawer>
  );
};

export default ScenarioDetailPanel;
