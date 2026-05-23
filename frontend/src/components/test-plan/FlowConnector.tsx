/**
 * FlowConnector — conforms to test-flow-connector-logic-v1
 *
 * visual_spec:
 *   type               → vertical-arrow-line (SVG line + arrowhead)
 *   thickness          → 2px stroke
 *   color              → #334155 (slate-700, adapts to light/dark)
 *   animation          → dash-flow-active (animated stroke-dashoffset, flowing downward)
 *   spacing_between_nodes → 20px (margin top/bottom handled by FlowCanvas)
 *
 * logic:
 *   execution_direction → downward (arrowhead at bottom)
 *   dependency_rule     → strict_sequence (label "NEXT →" below arrow)
 *   error_propagation   → break_flow_on_failure
 *                         (if isBroken=true: line turns red, dashes stop, shows ✕ badge)
 */
import React from 'react';
import { Box, Tooltip, useTheme } from '@mui/material';

interface FlowConnectorProps {
  /** If true, renders in error/break state (break_flow_on_failure) */
  isBroken?: boolean;
  /** Index of the connector (between node[index] and node[index+1]) */
  index?: number;
}

// Visual constants from schema
const LINE_COLOR_DARK  = '#334155';   // schema: color
const LINE_COLOR_LIGHT = '#94a3b8';   // lighter variant for light mode readability
const ERROR_COLOR      = '#ef4444';   // break_flow_on_failure
const THICKNESS        = 2;           // schema: thickness = 2px
const CONNECTOR_HEIGHT = 48;          // total SVG height (includes arrowhead + spacing)
const ARROW_HEAD_SIZE  = 7;

const FlowConnector: React.FC<FlowConnectorProps> = ({ isBroken = false, index = 0 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const baseColor  = isDark ? LINE_COLOR_DARK : LINE_COLOR_LIGHT;
  const lineColor  = isBroken ? ERROR_COLOR : baseColor;
  const animId     = `dash-flow-${index}`;
  const arrowId    = `arrow-head-${index}`;

  // SVG geometry
  const cx = 20;          // center X (out of 40)
  const lineTop    = 0;
  const lineBottom = CONNECTOR_HEIGHT - ARROW_HEAD_SIZE;
  const arrowTip   = CONNECTOR_HEIGHT;
  const dashLen    = 6;
  const gapLen     = 4;

  return (
    <Tooltip
      title={
        isBroken
          ? 'Flujo interrumpido — error_propagation: break_flow_on_failure'
          : 'Secuencia estricta — strict_sequence (execution_direction: downward)'
      }
      placement="right"
      arrow
      enterDelay={600}
    >
      {/* spacing_between_nodes = 20px: handled by margin */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '40px',     // narrow width to keep SVG centered
          mx: 'auto',        // centered_in_sequence
          my: 0,             // vertical spacing handled by ScenarioFlowNode mb + this svg height
          position: 'relative',
          userSelect: 'none',
        }}
      >
        <svg
          width="100%"
          height={CONNECTOR_HEIGHT}
          viewBox={`0 0 40 ${CONNECTOR_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {/* Arrowhead marker (execution_direction: downward) */}
            <marker
              id={arrowId}
              viewBox={`0 0 ${ARROW_HEAD_SIZE * 2} ${ARROW_HEAD_SIZE * 2}`}
              refX={ARROW_HEAD_SIZE}
              refY={ARROW_HEAD_SIZE}
              markerWidth={ARROW_HEAD_SIZE}
              markerHeight={ARROW_HEAD_SIZE}
              orient="auto"
            >
              <path
                d={`M 0 0 L ${ARROW_HEAD_SIZE * 2} ${ARROW_HEAD_SIZE} L 0 ${ARROW_HEAD_SIZE * 2} Z`}
                fill={lineColor}
              />
            </marker>
          </defs>

          {/* Vertical line — thickness: 2px, animation: dash-flow-active */}
          <line
            x1={cx}
            y1={lineTop}
            x2={cx}
            y2={lineBottom}
            stroke={lineColor}
            strokeWidth={THICKNESS}
            strokeDasharray={isBroken ? `${dashLen} ${gapLen}` : `${dashLen} ${gapLen}`}
            strokeLinecap="round"
            markerEnd={isBroken ? undefined : `url(#${arrowId})`}
            style={
              isBroken
                ? { opacity: 0.7 }
                : {
                    // dash-flow-active: dashes animate downward (positive dashoffset decreasing)
                    animation: `dashFlowDown-${animId} 1.2s linear infinite`,
                  }
            }
          >
            {/* inline keyframes via <animate> for SVG (no CSS class needed) */}
            {!isBroken && (
              <animate
                attributeName="stroke-dashoffset"
                from={dashLen + gapLen}
                to="0"
                dur="1.2s"
                repeatCount="indefinite"
              />
            )}
          </line>

          {/* Broken flow: red × badge at midpoint */}
          {isBroken && (
            <>
              {/* Red circle */}
              <circle
                cx={cx}
                cy={(lineTop + lineBottom) / 2}
                r="8"
                fill={ERROR_COLOR}
                opacity={0.9}
              />
              {/* × symbol */}
              <text
                x={cx}
                y={(lineTop + lineBottom) / 2 + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="white"
              >
                ✕
              </text>
            </>
          )}

          {/* Normal: arrowhead tip (drawn as solid triangle for crisp rendering) */}
          {!isBroken && (
            <polygon
              points={`
                ${cx - ARROW_HEAD_SIZE * 0.7},${lineBottom + 1}
                ${cx + ARROW_HEAD_SIZE * 0.7},${lineBottom + 1}
                ${cx},${arrowTip}
              `}
              fill={lineColor}
            />
          )}
        </svg>
      </Box>
    </Tooltip>
  );
};

export default FlowConnector;
