import React from 'react';
import { Box, Typography, CircularProgress, Paper, Chip, LinearProgress, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

type StatusType = 'success' | 'error' | 'info' | null;

interface StatusBarProps {
  message?: string;
  isLoading?: boolean;
  statusType?: StatusType;
  // New props for execution state
  isExecuting?: boolean;
  executionStatus?: 'idle' | 'running' | 'completed' | 'error';
  currentFeature?: string;
  currentScenario?: string;
  progress?: number;
  onStop?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  message,
  isLoading = false,
  statusType,
  isExecuting = false,
  executionStatus = 'idle',
  currentFeature,
  currentScenario,
  progress,
  onStop
}) => {
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (statusType) {
      const statusColors = {
        success: 'success.main',
        error: 'error.main',
        info: 'info.main',
      };
      return statusColors[statusType];
    }

    switch (executionStatus) {
      case 'running':
        return 'info.main';
      case 'completed':
        return 'success.main';
      case 'error':
        return 'error.main';
      default:
        return 'grey.500';
    }
  };

  const getStatusIcon = () => {
    switch (executionStatus) {
      case 'running':
        return <PlayArrowIcon fontSize="small" />;
      case 'completed':
        return <CheckCircleIcon fontSize="small" />;
      case 'error':
        return <ErrorIcon fontSize="small" />;
      default:
        return <PauseIcon fontSize="small" />;
    }
  };

  const getStatusText = () => {
    if (message) return message;

    switch (executionStatus) {
      case 'running':
        if (currentScenario) {
          return `${t('status.executing', { defaultValue: 'Executing' })}: ${currentFeature} - ${currentScenario}`;
        }
        return currentFeature ? `${t('status.executing', { defaultValue: 'Executing' })}: ${currentFeature}` : t('status.running', { defaultValue: 'Running...' });
      case 'completed':
        return t('status.completed', { defaultValue: 'Execution completed successfully' });
      case 'error':
        return t('status.error', { defaultValue: 'Execution failed' });
      default:
        return t('status.ready', { defaultValue: 'Ready to execute' });
    }
  };

  // Don't render if no message and idle state
  if (!message && executionStatus === 'idle' && !isExecuting) {
    return null;
  }

  return (
    <Paper
      square
      elevation={2}
      sx={{
        p: 0.5,
        px: 2,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Chip
        icon={getStatusIcon()}
        label={getStatusText()}
        size="small"
        sx={{
          backgroundColor: getStatusColor(),
          color: 'white',
          fontWeight: 500,
          '& .MuiChip-icon': {
            color: 'white'
          }
        }}
      />
      {(isLoading || executionStatus === 'running') && progress !== undefined && (
        <Box sx={{ flex: 1, maxWidth: '300px', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: 'grey.300',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'info.main'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}
      {(isLoading || executionStatus === 'running') && progress === undefined && (
        <CircularProgress size={16} sx={{ color: 'info.main' }} />
      )}

      {/* Spacer to push controls to the right if needed, or keeping them close */}
      <Box sx={{ flexGrow: 1 }} />

      {executionStatus === 'running' && onStop && (
        <Button
          variant="contained"
          color="error"
          size="small"
          startIcon={<PauseIcon />}
          onClick={onStop}
          sx={{ textTransform: 'none', height: 24, fontSize: '0.75rem' }}
        >
          {t('common.stop', { defaultValue: 'Stop' })}
        </Button>
      )}
    </Paper>
  );
};

export default StatusBar;