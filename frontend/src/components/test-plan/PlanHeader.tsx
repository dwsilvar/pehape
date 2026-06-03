import React, { useState, useRef } from 'react';
import {
  Box, Typography, Chip, Tooltip, Button, Breadcrumbs,
  Link, useTheme, alpha, ButtonGroup, ClickAwayListener, Grow, Paper, Popper, MenuList, MenuItem, IconButton
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import { useTranslation } from 'react-i18next';
import { PlanBlueprint, CycleBlueprint, FlowBlueprint } from '../../types';
import TestPlanScheduleDialog from './TestPlanScheduleDialog';
import ExportPlanDialog from './ExportPlanDialog';

interface PlanHeaderProps {
  plan: PlanBlueprint | null;
  cycle: CycleBlueprint | null;
  flow: FlowBlueprint | null;
  activeBlueprintName?: string;
  targetPlanName?: string;
  targetPlanId?: string | null;
  isSaved: boolean;
  onSave: () => void;
  onExecute: (scheduledAt?: string) => void;
  isExecuting: boolean;
  executionStatus?: string;
  canExecute?: boolean;
  onImport?: (file: File) => void;
}

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'info'> = {
  draft: 'default',
  running: 'warning',
  completed: 'success',
};

const PlanHeader: React.FC<PlanHeaderProps> = ({ plan, cycle, flow, activeBlueprintName, targetPlanName, targetPlanId, isSaved, onSave, onExecute, isExecuting, executionStatus, canExecute = false, onImport }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [openSplit, setOpenSplit] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
          {targetPlanName || '—'}
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

        {/* Import/Export Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, borderLeft: 1, borderColor: 'divider', pl: 1, ml: 0.5 }}>
          <Tooltip title="Exportar Plan (.desb)">
            <span>
              <IconButton
                size="small"
                disabled={!targetPlanId || !isSaved}
                onClick={() => setExportDialogOpen(true)}
                sx={{ color: theme.palette.primary.main, '&.Mui-disabled': { opacity: 0.5 } }}
              >
                <FileDownloadRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Importar Plan (.desb)">
            <IconButton 
              size="small" 
              onClick={() => fileInputRef.current?.click()}
              sx={{ color: theme.palette.primary.main }}
            >
              <FileUploadRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <input
            type="file"
            accept=".desb"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0 && onImport) {
                onImport(e.target.files[0]);
                e.target.value = ''; // reset
              }
            }}
          />
        </Box>

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

      {/* Export Options Dialog */}
      <ExportPlanDialog
        open={exportDialogOpen}
        planId={targetPlanId}
        planName={targetPlanName}
        onClose={() => setExportDialogOpen(false)}
      />
    </Box>
  );
};

export default PlanHeader;
