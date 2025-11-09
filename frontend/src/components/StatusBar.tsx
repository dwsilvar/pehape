import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';

interface StatusBarProps {
  message: string;
  isLoading?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ message, isLoading = false }) => {
  // No renderizar nada si no hay mensaje
  if (!message) {
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
        zIndex: (theme) => theme.zIndex.drawer + 1, // Asegura que esté por encima de otros elementos
        display: 'flex', 
        alignItems: 'center',
      }}
    >
      {isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
      <Typography variant="caption">{message}</Typography>
    </Paper>
  );
};

export default StatusBar;