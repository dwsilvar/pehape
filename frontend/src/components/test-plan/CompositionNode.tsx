import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box, Typography, IconButton, Tooltip, alpha, useTheme, Collapse,
} from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import { BlueprintRef } from '../../types';
import { CycleIcon, FlowIcon, ScenarioIcon, FeatureIcon } from '../PehapeIcons';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';

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

interface CompositionNodeProps {
  item: BlueprintRef;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  compact: boolean;
  isSetContext?: boolean;
}

const CompositionNode: React.FC<CompositionNodeProps> = ({
  item, index, total, onRemove, onMoveUp, onMoveDown, compact, isSetContext
}) => {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'composition-item', item }
  });

  const [showBranches, setShowBranches] = useState(false);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 2 : 1,
  };

  const getIcon = () => {
    switch (item.type) {
      case 'scenario': return <ScenarioIcon size={16} color={theme.palette.success.main} />;
      case 'feature': return <FeatureIcon size={16} color={theme.palette.secondary.main} />;
      case 'flow': return <FlowIcon size={18} color={theme.palette.info.main} />;
      case 'set': return <LibraryBooksRoundedIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />;
      case 'cycle': return <CycleIcon size={18} color={theme.palette.error.main} />;
      default: return null;
    }
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ mb: compact ? 0.5 : 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: compact ? 'center' : 'flex-start',
          gap: 1,
          p: compact ? 0.5 : 1.5,
          pl: 0.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: isDragging ? 'primary.main' : 'divider',
          borderRadius: 2,
          boxShadow: isDragging ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          },
        }}
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex', alignItems: 'center', p: 0.5, cursor: 'grab', color: 'text.disabled',
            '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }
          }}
        >
          <DragIndicatorRoundedIcon sx={{ fontSize: 18 }} />
        </Box>

        <Box sx={{ mt: compact ? 0 : 0.5 }}>
          {getIcon()}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', pt: compact ? 0 : 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: compact ? '0.75rem' : '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.type === 'scenario' && item.scenarioName ? item.scenarioName : item.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5, bgcolor: 'action.hover', px: 0.75, py: 0.25, borderRadius: 1 }}>
              {item.type}
            </Typography>
          </Box>
          {item.type === 'scenario' && item.tags && item.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 0.5 }}>
              {item.tags.map((tag) => {
                const color = tagColor(tag);
                return (
                  <Box
                    key={tag}
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: alpha(color, 0.15),
                      color: color,
                      border: `1px solid ${alpha(color, 0.35)}`,
                      px: 0.75,
                      borderRadius: 1,
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    {tag}
                  </Box>
                );
              })}
            </Box>
          )}
          {!compact && item.featurePath && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', mt: 0.5, display: 'block' }}>
              {item.featurePath}
            </Typography>
          )}
        </Box>

        {isSetContext && item.type === 'feature' && (
          <Tooltip title="Ver expansión matricial">
            <IconButton size="small" onClick={() => setShowBranches(!showBranches)} sx={{ color: showBranches ? 'primary.main' : 'text.secondary' }}>
              <CallSplitRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        <Box sx={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: 0.25, opacity: compact ? 0 : 1, '.MuiBox-root:hover &': { opacity: 1 } }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton size="small" disabled={index === 0} onClick={() => onMoveUp(item.id)} sx={{ p: 0.25 }}><KeyboardArrowUpRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
            <IconButton size="small" disabled={index === total - 1} onClick={() => onMoveDown(item.id)} sx={{ p: 0.25 }}><KeyboardArrowDownRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
          </Box>
          <Tooltip title="Remover">
            <IconButton size="small" color="error" onClick={() => onRemove(item.id)} sx={{ p: compact ? 0.25 : 0.5 }}><DeleteOutlineRoundedIcon sx={{ fontSize: compact ? 14 : 16 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Expansión Matricial */}
      <Collapse in={showBranches && isSetContext && item.type === 'feature'}>
        <Box sx={{ ml: 4, mt: 1, pl: 2, borderLeft: `2px dashed ${theme.palette.divider}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Este Feature generará un flujo independiente por cada uno de sus escenarios:
          </Typography>
          {(item.steps || []).length > 0 ? (
            item.steps?.map((scenarioName, i) => (
              <Box key={i} sx={{ p: 1, bgcolor: alpha(theme.palette.secondary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.secondary.main, 0.2), borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountTreeRoundedIcon sx={{ fontSize: 14, color: theme.palette.secondary.main }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{scenarioName}</Typography>
              </Box>
            ))
          ) : (
            <Typography variant="caption" color="error">No se encontraron escenarios pre-procesados en esta referencia.</Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CompositionNode;
