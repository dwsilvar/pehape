import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Box, Typography, Chip, Tooltip, Paper, alpha, useTheme,
} from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { useTranslation } from 'react-i18next';
import { ScenarioMeta } from '../../types';

interface ScenarioLibraryCardProps {
  featurePath: string;
  featureName: string;
  featureTitle: string;
  scenario: ScenarioMeta;
}

// Stable tag → color palette
const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];
function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

const ScenarioLibraryCard: React.FC<ScenarioLibraryCardProps> = ({
  featurePath, featureName, featureTitle, scenario,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const draggableId = `lib-scenario::${featurePath}::${scenario.name}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      type: 'library-scenario',
      featurePath,
      featureName,
      featureTitle,
      scenario,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 9999 : undefined,
  };

  const tooltipContent = (
    <Box sx={{ maxWidth: 260 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        {t('pages.testPlan.library.steps')}
      </Typography>
      {scenario.steps.slice(0, 6).map((step, i) => (
        <Typography
          key={i}
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem', lineHeight: 1.5 }}
        >
          {step}
        </Typography>
      ))}
      {scenario.steps.length > 6 && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
          +{scenario.steps.length - 6} more steps…
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} placement="left" arrow enterDelay={400}>
      <Paper
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        elevation={isDragging ? 8 : 0}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.75,
          px: 1,
          py: 0.75,
          mb: 0.5,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: isDragging
            ? 'primary.main'
            : alpha(theme.palette.divider, 0.6),
          bgcolor: isDragging
            ? alpha(theme.palette.primary.main, 0.08)
            : 'background.default',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: 'primary.light',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}`,
          },
          userSelect: 'none',
        }}
      >
        {/* Drag handle */}
        <DragIndicatorRoundedIcon
          sx={{ fontSize: 16, color: 'text.disabled', mt: 0.25, flexShrink: 0 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Scenario name */}
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {scenario.name}
          </Typography>

          {/* Tags */}
          {scenario.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 0.5 }}>
              {scenario.tags.map((tag) => {
                const color = tagColor(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: alpha(color, 0.15),
                      color: color,
                      border: `1px solid ${alpha(color, 0.35)}`,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>
    </Tooltip>
  );
};

export default ScenarioLibraryCard;
