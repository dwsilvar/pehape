import React, { useRef } from 'react';
import {
  Box, Typography, Chip, Paper, Divider, useTheme, alpha, List, ListItem,
  ListItemButton, ListItemText,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import { PlanIcon, FeatureIcon, ScenarioIcon } from '../components/PehapeIcons';

// ── Types and Interfaces ──────────────────────────────────────────────────────

interface ConceptItem {
  id: string;
  levelColor: string;
  icon: React.ReactNode;
  title: string;
  level: string;
  subtitle: string;
  description: string;
  whenToUse: string[];
  mnemonic: string;
  example: string;
  chips: string[];
}

// ── Hierarchy diagram ─────────────────────────────────────────────────────────

interface HierarchyDiagramProps {
  t: any;
}

const HierarchyDiagram: React.FC<HierarchyDiagramProps> = ({ t }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const levels = [
    { label: 'Test Plan', color: '#38bdf8', width: '100%' },
    { label: 'Test Cycle', color: '#f97316', width: '88%' },
    { label: 'Test Set', color: '#d946ef', width: '76%' },
    { label: 'Test Flow', color: '#6366f1', width: '64%' },
    { label: 'Scenario', color: '#14b8a6', width: '52%' },
    { label: 'Feature', color: '#22c55e', width: '40%' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, my: 2 }}>
      {levels.map((l, i) => (
        <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              width: 80,
              textAlign: 'right',
              fontSize: '0.7rem',
              color: 'text.secondary',
              flexShrink: 0,
            }}
          >
            {i === 0 ? t('pages.guide.level1', 'Nivel 1') : i === 1 ? t('pages.guide.level2', 'Nivel 2') : i === 2 ? t('pages.guide.level3', 'Nivel 3') : i === 3 ? t('pages.guide.level4', 'Nivel 4') : i === 4 ? t('pages.guide.unit', 'Unidad') : t('pages.guide.source', 'Fuente')}
          </Typography>
          <Box
            sx={{
              width: l.width,
              py: 0.75,
              px: 1.5,
              borderRadius: '6px',
              bgcolor: alpha(l.color, isDark ? 0.15 : 0.1),
              border: `1px solid ${alpha(l.color, 0.4)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: alpha(l.color, isDark ? 0.22 : 0.16) },
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: l.color,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: l.color }}>
              {l.label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ── Concept card ──────────────────────────────────────────────────────────────

interface ConceptCardProps {
  concept: ConceptItem;
  conceptRef: React.RefObject<HTMLDivElement | null>;
  t: any;
}

const ConceptCard: React.FC<ConceptCardProps> = ({ concept, conceptRef, t }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      ref={conceptRef}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: `1px solid ${alpha(concept.levelColor, 0.3)}`,
        bgcolor: alpha(concept.levelColor, isDark ? 0.05 : 0.03),
        mb: 3,
        scrollMarginTop: '24px',
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: alpha(concept.levelColor, 0.5) },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1.5,
            bgcolor: alpha(concept.levelColor, isDark ? 0.15 : 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {concept.icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {concept.title}
            </Typography>
            <Chip
              label={concept.level}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor: alpha(concept.levelColor, 0.15),
                color: concept.levelColor,
                border: `1px solid ${alpha(concept.levelColor, 0.35)}`,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
            {concept.subtitle}
          </Typography>
        </Box>
      </Box>

      {/* Description */}
      <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.primary', mb: 2 }}>
        {concept.description}
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* When to use */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="overline"
          sx={{ fontSize: '0.65rem', letterSpacing: 1, color: 'text.disabled', fontWeight: 700, display: 'block', mb: 0.75 }}
        >
          {t('pages.guide.whenToUse', 'Cuándo usarlo')}
        </Typography>
        {concept.whenToUse.map((item, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: concept.levelColor,
                mt: '7px',
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: '0.83rem', color: 'text.primary', lineHeight: 1.6 }}>
              {item}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Tags */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
        {concept.chips.map((chip) => (
          <Chip
            key={chip}
            label={chip}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 500,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiChip-label': { px: 1 },
            }}
          />
        ))}
      </Box>

      {/* Mnemonic */}
      <Box
        sx={{
          borderLeft: `3px solid ${concept.levelColor}`,
          pl: 1.5,
          py: 0.25,
          bgcolor: alpha(concept.levelColor, 0.05),
          borderRadius: '0 6px 6px 0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <LightbulbRoundedIcon sx={{ fontSize: 13, color: concept.levelColor }} />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 700, letterSpacing: 0.5 }}>
            {t('pages.guide.keyQuestion', 'PREGUNTA CLAVE')}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'text.primary', fontWeight: 500 }}>
          "{concept.mnemonic}"
        </Typography>
      </Box>

      {/* Example */}
      <Box
        sx={{
          mt: 1.5,
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          bgcolor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <CodeRoundedIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
          {concept.example}
        </Typography>
      </Box>
    </Paper>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ConceptsGuidePage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const conceptIds = ['feature', 'scenario', 'test-flow', 'test-set', 'test-cycle', 'test-plan'] as const;

  const getConceptIcon = (id: string, color: string) => {
    switch (id) {
      case 'feature':
        return <FeatureIcon size={28} color={color} />;
      case 'scenario':
        return <ScenarioIcon size={28} color={color} />;
      case 'test-flow':
        return <AltRouteRoundedIcon sx={{ fontSize: 28, color }} />;
      case 'test-set':
        return <LibraryBooksRoundedIcon sx={{ fontSize: 28, color }} />;
      case 'test-cycle':
        return <RepeatRoundedIcon sx={{ fontSize: 28, color }} />;
      case 'test-plan':
        return <PlanIcon size={28} color={color} />;
      default:
        return null;
    }
  };

  const getConceptColor = (id: string) => {
    switch (id) {
      case 'feature': return '#22c55e';
      case 'scenario': return '#14b8a6';
      case 'test-flow': return '#6366f1';
      case 'test-set': return '#d946ef';
      case 'test-cycle': return '#f97316';
      case 'test-plan': return '#38bdf8';
      default: return '#777777';
    }
  };

  const concepts: ConceptItem[] = conceptIds.map((id) => {
    const levelColor = getConceptColor(id);
    const whenToUse = t(`pages.guide.concepts.${id}.whenToUse`, { returnObjects: true }) as string[];
    const chips = t(`pages.guide.concepts.${id}.chips`, { returnObjects: true }) as string[];
    
    return {
      id,
      levelColor,
      icon: getConceptIcon(id, levelColor),
      title: t(`pages.guide.concepts.${id}.title`),
      level: t(`pages.guide.concepts.${id}.level`),
      subtitle: t(`pages.guide.concepts.${id}.subtitle`),
      description: t(`pages.guide.concepts.${id}.description`),
      mnemonic: t(`pages.guide.concepts.${id}.mnemonic`),
      example: t(`pages.guide.concepts.${id}.example`),
      whenToUse: Array.isArray(whenToUse) ? whenToUse : [],
      chips: Array.isArray(chips) ? chips : [],
    };
  });

  const refs = {
    feature: useRef<HTMLDivElement>(null),
    scenario: useRef<HTMLDivElement>(null),
    'test-flow': useRef<HTMLDivElement>(null),
    'test-set': useRef<HTMLDivElement>(null),
    'test-cycle': useRef<HTMLDivElement>(null),
    'test-plan': useRef<HTMLDivElement>(null),
  };

  const scrollTo = (id: string) => {
    const el = refs[id as keyof typeof refs]?.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* ── LEFT NAV ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          pt: 3,
          pb: 2,
          bgcolor: 'background.paper',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ px: 2, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <LayersRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography
              variant="overline"
              sx={{ fontSize: '0.62rem', letterSpacing: 1.2, color: 'text.disabled', fontWeight: 700 }}
            >
              {t('pages.guide.title', 'Guía de Conceptos')}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
            {t('pages.guide.navDesc', 'Navegación rápida entre los conceptos de Pehape.')}
          </Typography>
        </Box>

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ px: 1, mb: 1 }}>
          <Typography
            variant="caption"
            sx={{ px: 1, fontSize: '0.62rem', color: 'text.disabled', fontWeight: 700, letterSpacing: 0.5 }}
          >
            {t('pages.guide.hierarchy', 'JERARQUÍA')}
          </Typography>
        </Box>

        <List disablePadding>
          {concepts.map((c) => (
            <ListItem key={c.id} disablePadding>
              <ListItemButton
                onClick={() => scrollTo(c.id)}
                sx={{
                  px: 2,
                  py: 0.6,
                  borderRadius: 1,
                  mx: 0.5,
                  '&:hover': { bgcolor: alpha(c.levelColor, 0.1) },
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: c.levelColor,
                    mr: 1.5,
                    flexShrink: 0,
                  }}
                />
                <ListItemText
                  primary={c.title}
                  primaryTypographyProps={{ fontSize: '0.83rem', fontWeight: 600 }}
                  secondary={c.subtitle}
                  secondaryTypographyProps={{ fontSize: '0.68rem', noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ flexGrow: 1 }} />
        <Divider sx={{ mt: 2, mb: 1 }} />
        <Box sx={{ px: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              p: 1,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.07),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <AccountTreeRoundedIcon sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.4 }}>
              {t('pages.guide.bottomUp', 'De abajo hacia arriba: Feature → Scenario → Flow → Set → Cycle → Plan')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, sm: 4 },
          py: 3,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        {/* Page header */}
        <Box sx={{ mb: 4, maxWidth: 720 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <LayersRoundedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {t('pages.guide.title', 'Guía de Conceptos')}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.95rem', color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
            {t('pages.guide.description', 'Pehape organiza las pruebas en una jerarquía de cinco niveles. Entender cuándo usar cada concepto te permite diseñar campañas de prueba claras, reutilizables y fáciles de mantener.')}
          </Typography>

          {/* Hierarchy diagram */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              mb: 2,
            }}
          >
            <Typography
              variant="overline"
              sx={{ fontSize: '0.62rem', letterSpacing: 1, color: 'text.disabled', fontWeight: 700 }}
            >
              {t('pages.guide.containersHierarchy', 'Jerarquía de contenedores')}
            </Typography>
            <HierarchyDiagram t={t} />
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
              {t('pages.guide.containersDescription', 'Cada nivel puede contener uno o más elementos del nivel inferior. Feature y Scenario son la fuente de las pruebas; los niveles superiores son formas de organizarlos.')}
            </Typography>
          </Paper>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Concept cards */}
        <Box sx={{ maxWidth: 720 }}>
          {concepts.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              conceptRef={refs[concept.id as keyof typeof refs]}
              t={t}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ConceptsGuidePage;
