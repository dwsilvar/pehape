import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Box, Typography, alpha, useTheme, InputBase, IconButton, Tooltip,
} from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { useTranslation } from 'react-i18next';
import { ScenarioRef, TestFlow } from '../../types';
import ScenarioFlowNode from './ScenarioFlowNode';
import FlowConnector from './FlowConnector';


interface FlowCanvasProps {
  flow: TestFlow | null;
  noFlowSelected: boolean;
  onRemoveScenario: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onFlowNameChange: (newName: string) => void;
}

const DROPPABLE_ID = 'flow-canvas-drop';

const FlowCanvas: React.FC<FlowCanvasProps> = ({
  flow, noFlowSelected, onRemoveScenario, onMoveUp, onMoveDown, onFlowNameChange
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [compact, setCompact] = useState<boolean>(() => {
    try { return localStorage.getItem('flowCanvas.compact') === 'true'; } catch { return false; }
  });

  const toggleCompact = () => setCompact(prev => {
    const next = !prev;
    try { localStorage.setItem('flowCanvas.compact', String(next)); } catch {}
    return next;
  });

  const { setNodeRef, isOver } = useDroppable({ id: DROPPABLE_ID, data: { type: 'flow-canvas' } });

  const scenarios: ScenarioRef[] = flow?.scenarios ?? [];

  // schema: interaction_feedback.invalid_tag_warning
  // Detect if the whole cycle mixes @v1 and @v2 across any node
  const allTags = scenarios.flatMap(s => s.tags.map(t => t.toLowerCase()));
  const cycleHasMixedVersions = allTags.includes('@v1') && allTags.includes('@v2');

  // Empty / no-flow states
  if (noFlowSelected) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          color: 'text.disabled',
          bgcolor: alpha(theme.palette.action.hover, 0.3),
        }}
      >
        <AccountTreeRoundedIcon sx={{ fontSize: 52, opacity: 0.2 }} />
        <Typography variant="body2" sx={{ opacity: 0.5, textAlign: 'center', px: 4 }}>
          {t('pages.testPlan.canvas.selectCycle')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: theme.palette.custom.bgCanvas,
      }}
    >
      {/* Canvas header bar */}
      <Box
        sx={{
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <AutoFixHighRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <InputBase
          value={flow?.name || ''}
          onChange={(e) => onFlowNameChange(e.target.value)}
          placeholder={t('pages.testPlan.canvas.title')}
          sx={{
            flex: 1,
            fontSize: '0.75rem',
            letterSpacing: 0.5,
            fontWeight: 700,
            color: 'text.primary',
            '& input': {
              padding: '2px 4px',
              borderRadius: 1,
              transition: 'background-color 0.2s',
              '&:hover': {
                backgroundColor: alpha(theme.palette.action.hover, 0.5),
              },
              '&:focus': {
                backgroundColor: alpha(theme.palette.action.focus, 0.8),
              }
            }
          }}
        />
        {scenarios.length > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            {t('pages.testPlan.canvas.scenariosCount', { count: scenarios.length })}
          </Typography>
        )}
        <Tooltip title={compact ? 'Vista expandida' : 'Vista compacta'} placement="bottom">
          <IconButton
            size="small"
            onClick={toggleCompact}
            sx={{
              p: 0.5,
              borderRadius: 1,
              color: compact ? 'primary.main' : 'text.secondary',
              bgcolor: compact ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
            }}
          >
            {compact
              ? <ViewAgendaRoundedIcon sx={{ fontSize: 16 }} />
              : <ViewListRoundedIcon sx={{ fontSize: 16 }} />
            }
          </IconButton>
        </Tooltip>
      </Box>

      {/* Drop zone */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          transition: 'background-color 0.2s ease',
          bgcolor: isOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          borderRadius: 0,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        {scenarios.length === 0 ? (
          /* Empty drop zone */
          <Box
            sx={{
              height: '100%',
              minHeight: 300,
              border: '2px dashed',
              borderColor: isOver ? 'primary.main' : alpha(theme.palette.divider, 0.6),
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              transition: 'all 0.2s ease',
              bgcolor: isOver ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
              animation: isOver ? undefined : 'none',
            }}
          >
            <DragIndicatorRoundedIcon
              sx={{
                fontSize: 40,
                color: isOver ? 'primary.main' : 'text.disabled',
                opacity: isOver ? 0.8 : 0.3,
                transition: 'all 0.2s ease',
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: isOver ? 'primary.main' : 'text.disabled',
                fontWeight: isOver ? 600 : 400,
                textAlign: 'center',
                px: 4,
                transition: 'color 0.2s ease',
              }}
            >
              {t('pages.testPlan.canvas.placeholder')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', opacity: 0.6, textAlign: 'center' }}>
              {t('pages.testPlan.canvas.placeholderSub')}
            </Typography>
          </Box>
        ) : (
          /* Sortable scenario nodes with connectors between them
             spacing_between_nodes: 20px → achieved by node mb:0 + connector height
             execution_direction: downward → connectors point down
             dependency_rule: strict_sequence → one connector per adjacent pair
          */
          <SortableContext items={scenarios.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {scenarios.map((scenario, index) => (
              <React.Fragment key={scenario.id}>
                <ScenarioFlowNode
                  scenario={scenario}
                  index={index}
                  total={scenarios.length}
                  hasMixedVersionTags={cycleHasMixedVersions}
                  onRemove={onRemoveScenario}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  compact={compact}
                />
                {/* FlowConnector only in expanded mode */}
                {!compact && index < scenarios.length - 1 && (
                  <FlowConnector
                    index={index}
                    isBroken={false}
                  />
                )}
              </React.Fragment>
            ))}
            {/* Bottom drop indicator */}
            {isOver && (
              <Box
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  opacity: 0.6,
                  mt: 0.5,
                  animation: 'pulse 1s ease-in-out infinite',
                  '@keyframes pulse': { '0%,100%': { opacity: 0.6 }, '50%': { opacity: 0.2 } },
                }}
              />
            )}
          </SortableContext>
        )}
      </Box>
    </Box>
  );
};

export default FlowCanvas;
