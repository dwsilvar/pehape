import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Accordion, AccordionSummary, AccordionDetails,
  CircularProgress, alpha, useTheme, Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import { useTranslation } from 'react-i18next';
import { FeatureWithScenarios } from '../../types';
import ScenarioLibraryCard from './ScenarioLibraryCard';
import { FeatureIcon } from '../PehapeIcons';

interface AssetLibraryPanelProps {
  features: FeatureWithScenarios[];
  isLoading: boolean;
}

const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({ features, isLoading }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('__all__');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(features.map(f => f.path)));

  // Collect all unique tags across all scenarios
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    features.forEach(f => f.scenarios.forEach(s => s.tags.forEach(t => tags.add(t))));
    return Array.from(tags).sort();
  }, [features]);

  // Ensure new features are expanded by default
  React.useEffect(() => {
    setExpanded(new Set(features.map(f => f.path)));
  }, [features]);

  const toggleAccordion = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // Filter features / scenarios
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: theme.palette.custom.bgSidebar,
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      {/* Panel header */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          flexShrink: 0,
        }}
      >
        <LibraryBooksRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography
          variant="overline"
          sx={{ flex: 1, fontSize: '0.62rem', letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}
        >
          {t('pages.testPlan.library.title')}
        </Typography>
      </Box>

      {/* Search & filter */}
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          id="asset-library-search"
          size="small"
          fullWidth
          placeholder={t('pages.testPlan.library.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          inputProps={{ style: { fontSize: '0.78rem' } }}
        />

        <FormControl size="small" fullWidth>
          <InputLabel sx={{ fontSize: '0.75rem' }}>{t('pages.testPlan.library.filterVersion')}</InputLabel>
          <Select
            id="asset-library-tag-filter"
            value={tagFilter}
            label={t('pages.testPlan.library.filterVersion')}
            onChange={e => setTagFilter(e.target.value)}
            sx={{ fontSize: '0.78rem' }}
          >
            <MenuItem value="__all__" sx={{ fontSize: '0.78rem' }}>
              {t('pages.testPlan.library.allVersions')}
            </MenuItem>
            {allTags.map(tag => (
              <MenuItem key={tag} value={tag} sx={{ fontSize: '0.78rem' }}>
                {tag}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Feature accordion list */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
              {t('pages.testPlan.library.loading')}
            </Typography>
          </Box>
        ) : filteredFeatures.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
              {search || tagFilter !== '__all__'
                ? t('pages.testPlan.library.noScenarios')
                : t('pages.testPlan.library.noFeatures')}
            </Typography>
          </Box>
        ) : (
          filteredFeatures.map(feature => (
            <Accordion
              key={feature.path}
              disableGutters
              elevation={0}
              expanded={expanded.has(feature.path)}
              onChange={() => toggleAccordion(feature.path)}
              sx={{
                border: 'none',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&::before': { display: 'none' },
                bgcolor: 'transparent',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  px: 1.5,
                  py: 0,
                  minHeight: 38,
                  '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center', gap: 0.75 },
                  bgcolor: alpha(theme.palette.action.hover, 0.5),
                  '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.8) },
                }}
              >
                <FeatureIcon size={15} color={theme.palette.primary.main} sx={{ flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {feature.name}
                  </Typography>
                  {feature.featureTitle && feature.featureTitle !== feature.name.replace('.feature', '') && (
                    <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', display: 'block' }}>
                      {feature.featureTitle}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={feature.scenarios.length}
                  size="small"
                  sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              </AccordionSummary>

              <AccordionDetails sx={{ px: 1.25, py: 0.75 }}>
                {feature.scenarios.map(scenario => (
                  <ScenarioLibraryCard
                    key={`${feature.path}::${scenario.name}`}
                    featurePath={feature.path}
                    featureName={feature.name}
                    featureTitle={feature.featureTitle}
                    scenario={scenario}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Box>
    </Box>
  );
};

export default AssetLibraryPanel;
