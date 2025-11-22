import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface ConsoleViewProps {
  logs: string[];
}

const ConsoleView: React.FC<ConsoleViewProps> = ({ logs }) => {
  const logsEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        height: '100%',
        p: 2, 
        overflowY: 'auto', 
        backgroundColor: 'black', 
        color: 'lightgray', 
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '0.85rem'
      }}
    >
      {logs.map((log, index) => (
        <Typography key={index} component="div" sx={{ whiteSpace: 'pre-wrap' }}>{log}</Typography>
      ))}
      <div ref={logsEndRef} />
    </Paper>
  );
};

export default ConsoleView;