import React, { useRef } from 'react';
import {
  Box, Typography, Chip, Paper, Divider, useTheme, alpha, List, ListItem,
  ListItemButton, ListItemText,
} from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import { PlanIcon, FeatureIcon, ScenarioIcon } from '../components/PehapeIcons';

// ── Concept definitions ───────────────────────────────────────────────────────

const CONCEPTS = [
  {
    id: 'feature',
    level: 'Base',
    levelColor: '#22c55e',
    icon: <FeatureIcon size={28} color="#22c55e" />,
    title: 'Feature',
    subtitle: 'El archivo .feature de Gherkin',
    description:
      'Un archivo .feature es la unidad de escritura de pruebas. Agrupa un conjunto de escenarios relacionados a una misma funcionalidad del sistema, escritos en lenguaje natural (Gherkin).',
    whenToUse: [
      'Documentar una funcionalidad completa del sistema',
      'Agrupar escenarios relacionados bajo un mismo contexto',
      'Describir el comportamiento esperado desde la perspectiva del usuario',
    ],
    mnemonic: '¿Qué funcionalidad estoy documentando?',
    example: 'retiro/retiro.feature, login/login.feature',
    chips: ['Gherkin', '.feature file', 'Fuente de verdad'],
  },
  {
    id: 'scenario',
    level: 'Base',
    levelColor: '#14b8a6',
    icon: <ScenarioIcon size={28} color="#14b8a6" />,
    title: 'Scenario',
    subtitle: 'El caso de prueba individual',
    description:
      'Un Scenario es la unidad mínima ejecutable. Define un comportamiento específico del sistema mediante una secuencia de pasos Given / When / Then. Se asocia a tags para filtrar y categorizar la ejecución.',
    whenToUse: [
      'Probar un caso de uso o flujo específico',
      'Verificar un comportamiento puntual del sistema',
      'Reutilizar como bloque de construcción en un Test Flow',
    ],
    mnemonic: '¿Qué comportamiento específico estoy probando?',
    example: 'Scenario: Retiro exitoso con saldo suficiente',
    chips: ['Given / When / Then', 'Unidad ejecutable', 'Tags'],
  },
  {
    id: 'test-flow',
    level: 'Diseño',
    levelColor: '#6366f1',
    icon: <AltRouteRoundedIcon sx={{ fontSize: 28, color: '#6366f1' }} />,
    title: 'Test Flow',
    subtitle: 'La secuencia ordenada de escenarios',
    description:
      'Un Test Flow es una secuencia de Scenarios (de uno o varios Features) organizados en el canvas para ejecutarse en un orden específico. Es el "flujo" que diseñas arrastrando scenarios desde la biblioteca.',
    whenToUse: [
      'Definir el orden de ejecución de un conjunto de escenarios',
      'Componer flujos complejos: login → navegar → acción → logout',
      'Garantizar dependencias entre pasos de prueba',
    ],
    mnemonic: '¿En qué orden ejecuto estos escenarios?',
    example: 'Flujo Principal: login → retiro → verificar saldo → logout',
    chips: ['Canvas drag & drop', 'Orden de ejecución', 'Composición'],
  },
  {
    id: 'test-cycle',
    level: 'Organización',
    levelColor: '#f97316',
    icon: <RepeatRoundedIcon sx={{ fontSize: 28, color: '#f97316' }} />,
    title: 'Test Cycle',
    subtitle: 'La iteración o ronda de pruebas',
    description:
      'Un Test Cycle agrupa uno o más Test Flows bajo una iteración específica de pruebas. Representa una "ronda" completa: puede contener múltiples flujos paralelos o complementarios que se ejecutan juntos.',
    whenToUse: [
      'Agrupar flujos bajo una misma ronda o sprint de pruebas',
      'Organizar pruebas de regresión, smoke tests o sanity checks',
      'Separar flujos por ambiente (staging, producción)',
    ],
    mnemonic: '¿En qué iteración/ronda ejecuto estos flujos?',
    example: 'Ciclo de Regresión Semanal, Sprint 12 - Smoke Tests',
    chips: ['Iteración', 'Múltiples flujos', 'Agrupación'],
  },
  {
    id: 'test-plan',
    level: 'Campaña',
    levelColor: '#38bdf8',
    icon: <PlanIcon size={28} color="#38bdf8" />,
    title: 'Test Plan',
    subtitle: 'El contenedor raíz de la campaña',
    description:
      'El Test Plan es el contenedor de más alto nivel. Agrupa todos los ciclos de una campaña de pruebas completa. Tiene estado propio (draft → running → completed) y puede programarse para ejecución automática.',
    whenToUse: [
      'Organizar una campaña de pruebas completa (trimestral, por versión)',
      'Programar ejecuciones automáticas del conjunto de ciclos',
      'Tener una vista global del estado de todas las pruebas',
    ],
    mnemonic: '¿A qué campaña pertenece todo esto?',
    example: 'Plan de Pruebas Q2 2026, Release v3.5 — Regression Suite',
    chips: ['draft → running → completed', 'Programable', 'Campaña completa'],
  },
] as const;

// ── Hierarchy diagram ─────────────────────────────────────────────────────────

const HierarchyDiagram: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const levels = [
    { label: 'Test Plan', color: '#38bdf8', width: '100%' },
    { label: 'Test Cycle', color: '#f97316', width: '85%' },
    { label: 'Test Flow', color: '#6366f1', width: '70%' },
    { label: 'Scenario', color: '#14b8a6', width: '55%' },
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
            {i === 0 ? 'Nivel 1' : i === 1 ? 'Nivel 2' : i === 2 ? 'Nivel 3' : i === 3 ? 'Unidad' : 'Fuente'}
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
  concept: (typeof CONCEPTS)[number];
  conceptRef: React.RefObject<HTMLDivElement>;
}

const ConceptCard: React.FC<ConceptCardProps> = ({ concept, conceptRef }) => {
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
          Cuándo usarlo
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
            PREGUNTA CLAVE
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const refs = {
    feature: useRef<HTMLDivElement>(null),
    scenario: useRef<HTMLDivElement>(null),
    'test-flow': useRef<HTMLDivElement>(null),
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
              Guía de Conceptos
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
            Navegación rápida entre los conceptos de Pehape.
          </Typography>
        </Box>

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ px: 1, mb: 1 }}>
          <Typography
            variant="caption"
            sx={{ px: 1, fontSize: '0.62rem', color: 'text.disabled', fontWeight: 700, letterSpacing: 0.5 }}
          >
            JERARQUÍA
          </Typography>
        </Box>

        <List disablePadding>
          {CONCEPTS.map((c) => (
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
              De abajo hacia arriba: Feature → Scenario → Flow → Cycle → Plan
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
              Guía de Conceptos
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.95rem', color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
            Pehape organiza las pruebas en una jerarquía de cinco niveles. Entender cuándo usar
            cada concepto te permite diseñar campañas de prueba claras, reutilizables y fáciles de mantener.
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
              Jerarquía de contenedores
            </Typography>
            <HierarchyDiagram />
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
              Cada nivel puede contener uno o más elementos del nivel inferior. Feature y Scenario son la
              fuente de las pruebas; los niveles superiores son formas de organizarlos.
            </Typography>
          </Paper>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Concept cards */}
        <Box sx={{ maxWidth: 720 }}>
          {CONCEPTS.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              conceptRef={refs[concept.id as keyof typeof refs]}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ConceptsGuidePage;
