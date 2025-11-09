import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';

type StatusType = 'success' | 'error' | 'info' | null;

interface StatusBarProps {
  message: string;
  isLoading?: boolean;
  statusType: StatusType;
}

const StatusBar: React.FC<StatusBarProps> = ({ message, isLoading = false, statusType }) => {
  // No renderizar nada si no hay mensaje
  if (!message) {
    return null;
  }

  const statusColors = {
    success: { bg: 'success.main', text: 'common.white' },
    error: { bg: 'error.main', text: 'common.white' },
    info: { bg: 'info.main', text: 'common.white' },
  };

  const bgColor = statusType ? statusColors[statusType].bg : 'background.paper';
  const textColor = statusType ? statusColors[statusType].text : 'text.primary';

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
        zIndex: (theme) => theme.zIndex.drawer + 1, // Asegura que esté por encima de otros elementos
        display: 'flex', 
        alignItems: 'center',
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {isLoading && <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />}
      <Typography variant="caption">{message}</Typography>
    </Paper>
  );
};

export default StatusBar;