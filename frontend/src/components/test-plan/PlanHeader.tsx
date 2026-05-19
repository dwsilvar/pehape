import React, { useState, useRef } from 'react';
import {
  Box, Typography, Chip, Tooltip, Button, Breadcrumbs,
  Link, useTheme, alpha, ButtonGroup, ClickAwayListener, Grow, Paper, Popper, MenuList, MenuItem
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import { PlanBlueprint, CycleBlueprint, FlowBlueprint } from '../../types';
import TestPlanScheduleDialog from './TestPlanScheduleDialog';

interface PlanHeaderProps {
  plan: PlanBlueprint | null;
  cycle: CycleBlueprint | null;
  flow: FlowBlueprint | null;
  activeBlueprintName?: string;
  isSaved: boolean;
  onSave: () => void;
  onExecute: (scheduledAt?: string) => void;
  isExecuting: boolean;
  executionStatus?: string;
  canExecute?: boolean;
}

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'info'> = {
  draft: 'default',
  running: 'warning',
  completed: 'success',
};

const PlanHeader: React.FC<PlanHeaderProps> = ({ plan, cycle, flow, activeBlueprintName, isSaved, onSave, onExecute, isExecuting, executionStatus, canExecute = false }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [openSplit, setOpenSplit] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggle = () => {
    setOpenSplit((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setOpenSplit(false);
  };

  const handleScheduleOption = (option: string) => {
    setOpenSplit(false);
    if (option === 'instant') {
      onExecute();
    } else if (option === 'delay_short') {
      onExecute(new Date(Date.now() + 60000).toISOString());
    } else if (option === 'delay_medium') {
      onExecute(new Date(Date.now() + 300000).toISOString());
    } else if (option === 'custom') {
      setDialogOpen(true);
    }
  };

  const statusLabel = plan ? t(`pages.testPlan.status.draft`) : '';
  const statusColor = plan ? statusColors['draft'] : 'default';

  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
        flexShrink: 0,
        minHeight: 52,
      }}
    >
      {/* Breadcrumb */}
      <Breadcrumbs
        aria-label="test plan breadcrumb"
        sx={{ flex: 1, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
      >
        <Link
          underline="hover"
          color="text.secondary"
          sx={{ fontSize: '0.8rem', cursor: 'default' }}
        >
          {t('pages.testPlan.title')}
        </Link>
        {activeBlueprintName ? (
          <Typography
            sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}
          >
            {activeBlueprintName}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
        )}
      </Breadcrumbs>

      {/* Status chip */}
      {activeBlueprintName && (
        <Chip
          label="Borrador"
          color="default"
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 0.5 }}
        />
      )}

      {/* Save button */}
      <Tooltip title={isSaved ? t('pages.testPlan.saved') : t('pages.testPlan.save')}>
        <span>
          <Button
            size="small"
            variant="outlined"
            onClick={onSave}
            disabled={isExecuting}
            startIcon={
              isSaved ? (
                <CheckRoundedIcon sx={{ fontSize: '16px !important', color: 'success.main' }} />
              ) : (
                <SaveRoundedIcon sx={{ fontSize: '16px !important' }} />
              )
            }
            sx={{
              fontSize: '0.75rem',
              borderColor: isSaved ? 'success.main' : undefined,
              color: isSaved ? 'success.main' : undefined,
              transition: 'all 0.3s ease',
              minWidth: 100,
            }}
          >
            {isSaved ? t('pages.testPlan.saved') : t('pages.testPlan.save')}
          </Button>
        </span>
      </Tooltip>

      {/* Execute Full Plan Group */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pl: 1.5,
          pr: 0.5,
          py: 0.5,
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.2),
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeBlueprintName || '—'}
        </Typography>

        <Tooltip title={isExecuting && executionStatus !== 'scheduled' ? t('pages.testPlan.executing') : t('pages.testPlan.executePlan')} arrow>
          <ButtonGroup
            variant="contained"
            size="small"
            ref={anchorRef}
            disabled={!canExecute || !isSaved || (isExecuting && executionStatus !== 'scheduled')}
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.8)}, ${alpha(theme.palette.secondary.main, 0.8)})`,
              '& .MuiButton-root': {
                color: '#fff',
                borderColor: alpha(theme.palette.common.white, 0.2),
              },
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
              '&.Mui-disabled': {
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                opacity: 0.8,
              },
            }}
          >
            <Button
              onClick={() => onExecute()}
              startIcon={
                executionStatus === 'scheduled' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PlayArrowRoundedIcon sx={{ fontSize: 18, mr: -0.5 }} />
                    <AccessTimeIcon sx={{ fontSize: 12, mt: 1 }} />
                  </Box>
                ) : (
                  <PlayArrowRoundedIcon />
                )
              }
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {executionStatus === 'scheduled' 
                ? 'Programado' 
                : isExecuting ? t('pages.testPlan.executing') : t('pages.testPlan.executePlan')}
            </Button>
            <Button
              size="small"
              onClick={handleToggle}
              sx={{ px: 0.5 }}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
        </Tooltip>

        <Popper
          sx={{ zIndex: 1300 }}
          open={openSplit}
          anchorEl={anchorRef.current}
          role={undefined}
          transition
          disablePortal
        >
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              style={{
                transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden', boxShadow: theme.shadows[4] }}>
                <ClickAwayListener onClickAway={handleClose}>
                  <MenuList autoFocusItem sx={{ p: 0 }}>
                    <MenuItem onClick={() => handleScheduleOption('instant')} sx={{ fontSize: '0.8rem', py: 1 }}>
                      ⚡ Ejecutar Ahora
                    </MenuItem>
                    <MenuItem onClick={() => handleScheduleOption('delay_short')} sx={{ fontSize: '0.8rem', py: 1 }}>
                      ⏱️ En 1 minuto
                    </MenuItem>
                    <MenuItem onClick={() => handleScheduleOption('delay_medium')} sx={{ fontSize: '0.8rem', py: 1 }}>
                      ⏱️ En 5 minutos
                    </MenuItem>
                    <MenuItem onClick={() => handleScheduleOption('custom')} sx={{ fontSize: '0.8rem', py: 1 }}>
                      📅 Programar Fecha/Hora...
                    </MenuItem>
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </Box>

      {/* Schedule Dialog */}
      <TestPlanScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={(scheduledAt) => {
          setDialogOpen(false);
          onExecute(scheduledAt);
        }}
      />
    </Box>
  );
};

export default PlanHeader;
