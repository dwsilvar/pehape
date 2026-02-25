import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface ConsoleViewProps {
  logs: string[];
}

const ConsoleView: React.FC<ConsoleViewProps> = React.memo(({ logs }) => {
  const logsEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCopy = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      // Opcionalmente podrías mostrar un toast o feedback
    }).catch(err => {
      console.error('Error al copiar logs: ', err);
    });
  };

  return (
    <Box sx={{ height: '100%', position: 'relative' }}>
      <Tooltip title="Copiar todo al portapapeles">
        <IconButton 
          onClick={handleCopy}
          sx={{ 
            position: 'absolute', 
            top: 10, 
            right: 25, 
            color: '#4af626',
            backgroundColor: 'rgba(255,255,255,0.05)',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)'
            },
            zIndex: 10
          }}
          size="small"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
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
          borderTop: '1px solid #333',
          userSelect: 'text', // Habilitar selección explícitamente
          WebkitUserSelect: 'text',
          msUserSelect: 'text',
          MozUserSelect: 'text'
        }}
      >
        {logs.map((log, index) => (
          <Typography 
            key={index} 
            component="div" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              fontFamily: 'inherit', 
              fontWeight: 300, 
              letterSpacing: '0.05em',
              userSelect: 'text' // Asegurar selección en cada línea
            }}
          >
            {log}
          </Typography>
        ))}
        <div ref={logsEndRef} />
      </Paper>
    </Box>
  );
});

export default ConsoleView;