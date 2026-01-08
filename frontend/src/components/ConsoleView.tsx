import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface ConsoleViewProps {
  logs: string[];
}

const ConsoleView: React.FC<ConsoleViewProps> = React.memo(({ logs }) => {
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
        backgroundColor: '#1e1e1e', // Fondo oscuro de consola
        color: '#4af626', // Texto verde tipo terminal retro
        fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
        fontSize: '0.9rem',
        WebkitFontSmoothing: 'antialiased', // Mejora el renderizado en fondo oscuro
        MozOsxFontSmoothing: 'grayscale',
        borderTop: '1px solid #333'
      }}
    >
      {logs.map((log, index) => (
        <Typography key={index} component="div" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontWeight: 300, letterSpacing: '0.05em' }}>{log}</Typography>
      ))}
      <div ref={logsEndRef} />
    </Paper>
  );
});

export default ConsoleView;