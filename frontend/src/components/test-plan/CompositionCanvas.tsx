import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Box, Typography, alpha, useTheme, InputBase, IconButton, Tooltip,
} from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { BlueprintRef, BlueprintsData, PlanTask } from '../../types';
import CompositionNode from './CompositionNode';
import FlowConnector from './FlowConnector';
import TaskAssociationDialog from './TaskAssociationDialog';

interface CompositionCanvasProps {
  category: 'plans' | 'cycles' | 'sets' | 'flows';
  blueprintId: string | null;
  name: string;
  items: BlueprintRef[];
  onNameChange: (newName: string) => void;
  onRemoveItem: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  blueprints?: BlueprintsData;
  onUpdateItemTasks: (id: string, tasks: PlanTask[]) => void;
  tasks?: PlanTask[];
  onUpdateTasks?: (tasks: PlanTask[]) => void;
}

const DROPPABLE_ID = 'composition-canvas-drop';

const CompositionCanvas: React.FC<CompositionCanvasProps> = ({
  category,
  blueprintId,
  name,
  items,
  onNameChange,
  onRemoveItem,
  onMoveUp,
  onMoveDown,
  blueprints,
  onUpdateItemTasks,
  tasks = [],
  onUpdateTasks,
}) => {
  const theme = useTheme();

  const [compact, setCompact] = useState<boolean>(false);
  const [blueprintTaskDialogOpen, setBlueprintTaskDialogOpen] = useState<boolean>(false);
  const toggleCompact = () => setCompact(prev => !prev);

  const { setNodeRef, isOver } = useDroppable({ id: DROPPABLE_ID, data: { type: 'composition-canvas' } });

  if (!blueprintId) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.disabled', bgcolor: alpha(theme.palette.action.hover, 0.3) }}>
        <AccountTreeRoundedIcon sx={{ fontSize: 52, opacity: 0.2 }} />
        <Typography variant="body2" sx={{ opacity: 0.5, textAlign: 'center', px: 4 }}>
          Selecciona un {category.slice(0, -1)} para comenzar a editar
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: theme.palette.custom.bgCanvas }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', flexShrink: 0 }}>
        <InputBase
          value={name || ''}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={`Nombre del ${category.slice(0, -1)}...`}
          sx={{
            flex: 1, fontSize: '0.75rem', letterSpacing: 0.5, fontWeight: 700, color: 'text.primary',
            '& input': { padding: '2px 4px', borderRadius: 1, transition: 'background-color 0.2s', '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }, '&:focus': { backgroundColor: alpha(theme.palette.action.focus, 0.8) } }
          }}
        />
        {items.length > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            {items.length} items
          </Typography>
        )}
        {onUpdateTasks && (
          <Tooltip title={`Configurar tareas del ${category.slice(0, -1)}`}>
            <IconButton size="small" onClick={() => setBlueprintTaskDialogOpen(true)} sx={{ p: 0.5, position: 'relative' }}>
              <AssignmentIcon sx={{ fontSize: 16 }} />
              {tasks.length > 0 && (
                <Box sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'primary.main', width: 6, height: 6, borderRadius: '50%' }} />
              )}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={compact ? 'Vista expandida' : 'Vista compacta'}>
          <IconButton size="small" onClick={toggleCompact} sx={{ p: 0.5, color: compact ? 'primary.main' : 'text.secondary' }}>
            {compact ? <ViewAgendaRoundedIcon sx={{ fontSize: 16 }} /> : <ViewListRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Drop Zone */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1, overflow: 'auto', px: 2, py: 2, transition: 'background-color 0.2s ease',
          bgcolor: isOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {items.length === 0 ? (
          <Box sx={{ minHeight: 300, width: '100%', border: '2px dashed', borderColor: isOver ? 'primary.main' : alpha(theme.palette.divider, 0.6), borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, bgcolor: isOver ? alpha(theme.palette.primary.main, 0.04) : 'transparent' }}>
            <DragIndicatorRoundedIcon sx={{ fontSize: 40, color: isOver ? 'primary.main' : 'text.disabled', opacity: isOver ? 0.8 : 0.3 }} />
            <Typography variant="body2" sx={{ color: isOver ? 'primary.main' : 'text.disabled', fontWeight: isOver ? 600 : 400 }}>
              Arrastra elementos aquí
            </Typography>
          </Box>
        ) : (
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                <CompositionNode
                  item={item}
                  index={index}
                  total={items.length}
                  onRemove={onRemoveItem}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onUpdateTasks={onUpdateItemTasks}
                  compact={compact}
                  isSetContext={category === 'sets'}
                  blueprints={blueprints}
                />
                {!compact && index < items.length - 1 && (
                  <FlowConnector
                    index={index}
                    isBroken={false}
                    mode={category === 'plans' || category === 'cycles' ? 'independent' : 'sequential'}
                  />
                )}
              </React.Fragment>
            ))}
            {isOver && (
              <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'primary.main', opacity: 0.6, mt: 0.5, animation: 'pulse 1s ease-in-out infinite' }} />
            )}
          </SortableContext>
        )}
      </Box>
      {onUpdateTasks && (
        <TaskAssociationDialog
          open={blueprintTaskDialogOpen}
          onClose={() => setBlueprintTaskDialogOpen(false)}
          nodeName={name || category.slice(0, -1)}
          initialTasks={tasks}
          onSave={onUpdateTasks}
          nodeType={category.slice(0, -1)}
          nodeId={blueprintId || undefined}
        />
      )}
    </Box>
  );
};
export default CompositionCanvas;
