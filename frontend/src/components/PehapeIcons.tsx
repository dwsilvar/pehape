/**
 * PehapeIcons — pehape-brand-identity-v1
 *
 * icon_hierarchy:
 *   LEVEL_0  terminal_square  → BrandIcon       (app logo)
 *   LEVEL_1  layers_3         → PlanIcon        2.5px stroke  (management)
 *   LEVEL_2  repeat_2         → CycleIcon       2.5px stroke  (management)
 *   LEVEL_3  git_branch_plus  → FlowIcon        1.5px stroke  (technical)
 *   LEVEL_4  file_text_code   → FeatureIcon     1.5px stroke  (technical)
 *   LEVEL_5  play_square      → ScenarioIcon    1.5px stroke  (technical)
 *   LEVEL_6  list_checks      → StepsIcon       1.5px stroke  (technical)
 *
 * visual_rules (size_hierarchy):
 *   plan_icon          → 24px
 *   cycle_icon         → 20px
 *   flow_icon          → 18px
 *   scenario_step_icon → 14px
 *
 * stroke_weight_rule:
 *   management (L1-L2) → strokeWidth: 2.5  (bold, commanding presence)
 *   technical  (L3-L6) → strokeWidth: 1.5  (refined, subordinate)
 */

import React from 'react';
import { SxProps, Theme } from '@mui/material';
import { Box } from '@mui/material';

interface IconProps {
  size?: number;
  color?: string;
  sx?: SxProps<Theme>;
  className?: string;
}

interface FeatureIndexIconProps extends IconProps {
  /** Sequence number to render inside the file body */
  label: number | string;
  /** Fill color for the file body background (default: transparent) */
  fill?: string;
}

// ─── Shared SVG wrapper ────────────────────────────────────────────────────────
const SvgIcon: React.FC<{
  size: number;
  viewBox?: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  className?: string;
}> = ({ size, viewBox = '0 0 24 24', children, sx, className }) => (
  <Box
    component="svg"
    xmlns="http://www.w3.org/2000/svg"
    viewBox={viewBox}
    width={size}
    height={size}
    fill="none"
    sx={{ display: 'inline-flex', flexShrink: 0, ...sx }}
    className={className}
  >
    {children}
  </Box>
);

// ─── LEVEL_0 · BRAND ─ terminal_square ────────────────────────────────────────
export const BrandIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="2" />
    <path d="M8 9l3 3-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 15h3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </SvgIcon>
);

// ─── LEVEL_1 · PLAN ─ layers_3 ──────────────────────────────────────────────
// strokeWidth: 2.5px (management / bold)
export const PlanIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    {/* Bottom layer */}
    <path
      d="M3 17l9 4 9-4"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Middle layer */}
    <path
      d="M3 13l9 4 9-4"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top layer */}
    <path
      d="M3 9l9-4 9 4-9 4-9-4z"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

// ─── LEVEL_2 · CYCLE ─ repeat_2 ──────────────────────────────────────────────
// strokeWidth: 2.5px (management / bold)
export const CycleIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    {/* Outer arc (top-right, clockwise) */}
    <path
      d="M17 2l4 4-4 4"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top arc path */}
    <path
      d="M3 11V9a4 4 0 0 1 4-4h14"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bottom arc (left, counter-clockwise) */}
    <path
      d="M7 22l-4-4 4-4"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bottom path */}
    <path
      d="M21 13v2a4 4 0 0 1-4 4H3"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

// ─── LEVEL_3 · FLOW ─ git_branch_plus ────────────────────────────────────────
// strokeWidth: 1.5px (technical / refined)
export const FlowIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    {/* Main branch stem */}
    <path
      d="M6 3v10"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Main branch circle top */}
    <circle cx="6" cy="3" r="1.5" stroke={color} strokeWidth="1.5" />
    {/* Main branch circle bottom */}
    <circle cx="6" cy="18" r="1.5" stroke={color} strokeWidth="1.5" />
    {/* Right branch circle */}
    <circle cx="18" cy="7" r="1.5" stroke={color} strokeWidth="1.5" />
    {/* Curve to right branch */}
    <path
      d="M6 9c0-2 2-4 4-4h6.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Plus crosshair — branch_plus */}
    <path
      d="M18 3v4M16 5h4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </SvgIcon>
);

// ─── LEVEL_4 · FEATURE ─ file_text_code ──────────────────────────────────────
// strokeWidth: 1.5px (technical / refined)
export const FeatureIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    {/* File outline with folded corner */}
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Code lines inside file */}
    <path d="M9 13l-2 2 2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 13l2 2-2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </SvgIcon>
);

// ─── LEVEL_4 · FEATURE (indexed) ─ file_text_code + sequence number ───────────
// Used in ScenarioFlowNode canvas: replaces the circular badge with the
// file_text_code icon shape, rendering the sequence index inside the body.
export const FeatureIndexIcon: React.FC<FeatureIndexIconProps> = ({
  size = 28,
  color = 'currentColor',
  fill = 'transparent',
  label,
  sx,
  className,
}) => {
  // Compute a font-size that fits well regardless of the icon size.
  // The file body area in the 24×24 viewBox spans roughly x:[4,20], y:[8,22]
  // Center of body: cx≈12, cy≈16
  const fontSize = Math.max(5, Math.round(24 * 0.33)); // ≈8 in 24px viewBox
  return (
    <SvgIcon size={size} sx={sx} className={className}>
      {/* File outline with folded corner */}
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Folded corner crease */}
      <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Sequence index — rendered as SVG text in the file body */}
      <text
        x="12"
        y="17"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="Inter, Roboto, sans-serif"
        fill={color}
        stroke="none"
      >
        {label}
      </text>
    </SvgIcon>
  );
};

// ─── LEVEL_5 · SCENARIO ─ play_square ────────────────────────────────────────
// strokeWidth: 1.5px (technical / refined)
export const ScenarioIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" />
    <path
      d="M10 8l6 4-6 4V8z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

// ─── LEVEL_6 · STEPS ─ list_checks ───────────────────────────────────────────
// strokeWidth: 1.5px (technical / refined)
export const StepsIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    {/* Check row 1 */}
    <path d="M4 7l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {/* Check row 2 */}
    <path d="M4 13l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 12h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {/* Check row 3 */}
    <path d="M4 19l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 18h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </SvgIcon>
);

// ─── Utility icons (brand spec: UTILITIES) ────────────────────────────────────

// scheduler → calendar_clock  (MUI: EventNoteRounded proxy)
export const SchedulerIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    <rect x="3" y="4" width="18" height="17" rx="2" stroke={color} strokeWidth="1.5" />
    <path d="M8 2v4M16 2v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 9h18" stroke={color} strokeWidth="1.5" />
    {/* Clock hands */}
    <circle cx="16" cy="15" r="3.5" stroke={color} strokeWidth="1.5" />
    <path d="M16 13.5v2l1 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
);

// export_pdf → picture_as_pdf
export const ExportPdfIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', sx, className }) => (
  <SvgIcon size={size} sx={sx} className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 13h2c.6 0 1 .4 1 1v1c0 .6-.4 1-1 1H9v-3z" stroke={color} strokeWidth="1.2" />
    <path d="M14 13h1.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H14v-3z" stroke={color} strokeWidth="1.2" />
  </SvgIcon>
);
