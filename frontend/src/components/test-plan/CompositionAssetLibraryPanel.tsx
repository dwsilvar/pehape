import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Accordion, AccordionSummary, AccordionDetails,
  CircularProgress, alpha, useTheme, Chip, List, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import { useTranslation } from 'react-i18next';
import { FeatureWithScenarios, BlueprintsData, BlueprintRef } from '../../types';
import ScenarioLibraryCard from './ScenarioLibraryCard';
import { FeatureIcon, CycleIcon, FlowIcon } from '../PehapeIcons';
import { useDraggable } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';

interface DraggableBlueprintItemProps {
  item: BlueprintRef;
}

const DraggableBlueprintItem: React.FC<DraggableBlueprintItemProps> = ({ item }) => {
  const theme = useTheme();
  // Drag data uses a unique ID so it doesn't conflict
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${item.type}-${item.refId}`,
    data: {
      type: 'library-item',
      item: { ...item, id: uuidv4() } // generate new id for the canvas
    }
  });

  const getIcon = () => {
    switch (item.type) {
      case 'feature': return <FeatureIcon size={16} color={theme.palette.secondary.main} />;
      case 'flow': return <FlowIcon size={16} color={theme.palette.info.main} />;
      case 'set': return <LibraryBooksRoundedIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />;
      case 'cycle': return <CycleIcon size={16} color={theme.palette.error.main} />;
      default: return null;
    }
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      dense
      sx={{
        px: 1.5, py: 0.5, opacity: isDragging ? 0.5 : 1,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
        cursor: 'grab'
      }}
    >
      <ListItemIcon sx={{ minWidth: 24 }}>{getIcon()}</ListItemIcon>
      <ListItemText
        primary={item.name}
        secondary={item.featurePath || ''}
        primaryTypographyProps={{ sx: { fontSize: '0.75rem', fontWeight: 500 } }}
        secondaryTypographyProps={{ sx: { fontSize: '0.65rem' } }}
      />
    </ListItemButton>
  );
};


interface CompositionAssetLibraryPanelProps {
  features: FeatureWithScenarios[];
  blueprints: BlueprintsData;
  isLoading: boolean;
  activeCategory: 'plans' | 'cycles' | 'sets' | 'flows';
}

const CompositionAssetLibraryPanel: React.FC<CompositionAssetLibraryPanelProps> = ({ features, blueprints, isLoading, activeCategory }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('__all__');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Collect all unique tags across all scenarios
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    features.forEach(f => f.scenarios.forEach(s => s.tags.forEach(t => tags.add(t))));
    return Array.from(tags).sort();
  }, [features]);

  const toggleAccordion = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // Filter features / scenarios for 'flows' mode
  const filteredFeatures = useMemo(() => {
    const q = search.toLowerCase().trim();
    return features
      .map(feature => {
        const scenarios = feature.scenarios.filter(s => {
          const matchesTag = tagFilter === '__all__' || s.tags.includes(tagFilter);
          const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q));
          return matchesTag && matchesSearch;
        });
        return { ...feature, scenarios };
      })
      .filter(f => f.scenarios.length > 0);
  }, [features, search, tagFilter]);

  // Derived available items based on active category
  const availableItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    let items: BlueprintRef[] = [];

    if (activeCategory === 'sets') {
      // Sets can contain Features and Flows
      features.forEach(f => {
        if (!q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
          items.push({ id: '', refId: f.path, type: 'feature', name: f.name, featurePath: f.path, steps: f.scenarios.map(s => s.name) });
        }
      });
      (blueprints.flows || []).forEach(f => {
        if (!q || f.name.toLowerCase().includes(q)) {
          items.push({ id: '', refId: f.id, type: 'flow', name: f.name });
        }
      });
    } else if (activeCategory === 'cycles') {
      // Cycles can contain Sets and Flows
      (blueprints.sets || []).forEach(s => {
        if (!q || s.name.toLowerCase().includes(q)) items.push({ id: '', refId: s.id, type: 'set', name: s.name });
      });
      (blueprints.flows || []).forEach(f => {
        if (!q || f.name.toLowerCase().includes(q)) items.push({ id: '', refId: f.id, type: 'flow', name: f.name });
      });
    } else if (activeCategory === 'plans') {
      // Plans can contain Cycles
      (blueprints.cycles || []).forEach(c => {
        if (!q || c.name.toLowerCase().includes(q)) items.push({ id: '', refId: c.id, type: 'cycle', name: c.name });
      });
    }

    return items;
  }, [activeCategory, features, blueprints, search]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: theme.palette.custom.bgSidebar, borderLeft: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', flexShrink: 0 }}>
        <LibraryBooksRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography variant="overline" sx={{ flex: 1, fontSize: '0.62rem', letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}>
          {t('pages.testPlan.library.title')}
        </Typography>
      </Box>

      {/* Search & filter */}
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          size="small" fullWidth placeholder={t('pages.testPlan.library.search')} value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>) }}
          inputProps={{ style: { fontSize: '0.78rem' } }}
        />

        {activeCategory === 'flows' && (
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.75rem' }}>{t('pages.testPlan.library.filterVersion')}</InputLabel>
            <Select value={tagFilter} label={t('pages.testPlan.library.filterVersion')} onChange={e => setTagFilter(e.target.value)} sx={{ fontSize: '0.78rem' }}>
              <MenuItem value="__all__" sx={{ fontSize: '0.78rem' }}>{t('pages.testPlan.library.allVersions')}</MenuItem>
              {allTags.map(tag => (
                <MenuItem key={tag} value={tag} sx={{ fontSize: '0.78rem' }}>{tag}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>Cargando...</Typography>
          </Box>
        ) : activeCategory === 'flows' ? (
          /* FLOWS MODE: Show Accordions of Features -> Scenarios */
          filteredFeatures.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>No se encontraron escenarios.</Typography></Box>
          ) : (
            filteredFeatures.map(feature => (
              <Accordion
                key={feature.path} disableGutters elevation={0} expanded={expanded.has(feature.path)} onChange={() => toggleAccordion(feature.path)}
                sx={{ border: 'none', borderBottom: '1px solid', borderColor: 'divider', '&::before': { display: 'none' }, bgcolor: 'transparent' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />} sx={{ px: 1.5, py: 0, minHeight: 38, '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center', gap: 0.75 }, bgcolor: alpha(theme.palette.primary.main, 0.06), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) } }}>
                  <FeatureIcon size={15} color={theme.palette.primary.main} sx={{ flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.73rem', fontWeight: 700, color: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {feature.name}
                    </Typography>
                  </Box>
                  <Chip label={feature.scenarios.length} size="small" sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }} />
                </AccordionSummary>
                <AccordionDetails sx={{ px: 1.25, py: 0.75 }}>
                  {feature.scenarios.map(scenario => (
                    <ScenarioLibraryCard
                      key={`${feature.path}::${scenario.name}`} featurePath={feature.path} featureName={feature.name} featureTitle={feature.featureTitle} scenario={scenario}
                    />
                  ))}
                </AccordionDetails>
              </Accordion>
            ))
          )
        ) : (
          /* SETS/CYCLES/PLANS MODE: Show Flat list of compatible items */
          availableItems.length === 0 ? (
             <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>No hay insumos disponibles para esta categoría.</Typography></Box>
          ) : (
             <List dense disablePadding>
               {availableItems.map((item, idx) => (
                 <DraggableBlueprintItem key={`${item.type}-${item.refId}-${idx}`} item={item} />
               ))}
             </List>
          )
        )}
      </Box>
    </Box>
  );
};

export default CompositionAssetLibraryPanel;
