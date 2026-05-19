import React, { useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Collapse,
  List, ListItemButton, ListItemIcon, ListItemText,
  alpha, useTheme, Tabs, Tab
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import { useTranslation } from 'react-i18next';
import { BlueprintsData, PlanBlueprint, CycleBlueprint, SetBlueprint, FlowBlueprint } from '../../types';
import { PlanIcon, CycleIcon, FlowIcon } from '../PehapeIcons';

interface BlueprintCatalogPanelProps {
  blueprints: BlueprintsData;
  activeCategory: 'plans' | 'cycles' | 'sets' | 'flows';
  onCategoryChange: (cat: 'plans' | 'cycles' | 'sets' | 'flows') => void;
  selectedBlueprintId: string | null;
  onSelectBlueprint: (id: string | null) => void;
  onAddBlueprint: (category: 'plans' | 'cycles' | 'sets' | 'flows', name: string) => void;
  onDeleteBlueprint: (category: 'plans' | 'cycles' | 'sets' | 'flows', id: string) => void;
}

const BlueprintCatalogPanel: React.FC<BlueprintCatalogPanelProps> = ({
  blueprints,
  activeCategory,
  onCategoryChange,
  selectedBlueprintId,
  onSelectBlueprint,
  onAddBlueprint,
  onDeleteBlueprint,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    onAddBlueprint(activeCategory, name);
    setNewName('');
    setShowNewInput(false);
  };

  const getList = () => {
    switch (activeCategory) {
      case 'plans': return blueprints.plans || [];
      case 'cycles': return blueprints.cycles || [];
      case 'sets': return blueprints.sets || [];
      case 'flows': return blueprints.flows || [];
      default: return [];
    }
  };

  const list = getList();

  const getIcon = (cat: string, active: boolean) => {
    const color = active ? theme.palette.primary.main : theme.palette.text.secondary;
    switch (cat) {
      case 'plans': return <PlanIcon size={18} color={color} />;
      case 'cycles': return <CycleIcon size={18} color={color} />;
      case 'sets': return <LibraryBooksRoundedIcon sx={{ fontSize: 18, color }} />;
      case 'flows': return <FlowIcon size={18} color={color} />;
      default: return null;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: theme.palette.custom.bgSidebar,
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Tabs
          value={activeCategory}
          onChange={(e, v) => onCategoryChange(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40 }}
        >
          <Tab value="plans" label="Plans" sx={{ minHeight: 40, py: 0, fontSize: '0.7rem', textTransform: 'none' }} />
          <Tab value="cycles" label="Cycles" sx={{ minHeight: 40, py: 0, fontSize: '0.7rem', textTransform: 'none' }} />
          <Tab value="sets" label="Sets" sx={{ minHeight: 40, py: 0, fontSize: '0.7rem', textTransform: 'none' }} />
          <Tab value="flows" label="Flows" sx={{ minHeight: 40, py: 0, fontSize: '0.7rem', textTransform: 'none' }} />
        </Tabs>
      </Box>

      {/* Header action */}
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="overline" sx={{ fontSize: '0.62rem', letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}>
          {activeCategory.toUpperCase()} ({list.length})
        </Typography>
        <Tooltip title="Crear nuevo">
          <IconButton size="small" onClick={() => setShowNewInput(v => !v)} sx={{ p: 0.3 }}>
            <AddRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={showNewInput}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Ingresar nombre..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setShowNewInput(false); setNewName(''); }
            }}
            inputProps={{ style: { fontSize: '0.78rem' } }}
          />
        </Box>
      </Collapse>

      {/* List */}
      <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
        {list.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
              No hay elementos guardados.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {list.map(item => {
              const isSelected = item.id === selectedBlueprintId;
              return (
                <ListItemButton
                  key={item.id}
                  dense
                  selected={isSelected}
                  onClick={() => onSelectBlueprint(item.id)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {getIcon(activeCategory, isSelected)}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      sx: { fontSize: '0.78rem', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }}
                  />
                  <Box sx={{ display: 'flex', opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 } }}>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" sx={{ p: 0.3, color: 'error.main' }} onClick={e => { e.stopPropagation(); onDeleteBlueprint(activeCategory, item.id); }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default BlueprintCatalogPanel;
