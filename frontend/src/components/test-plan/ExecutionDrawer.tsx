import React, { useRef, useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, alpha, useTheme, Button, CircularProgress
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface ExecutionDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  taskId: string | null;
  onExecutionFinished: () => void;
  onStatusChange?: (status: string) => void;
  onReportGenerating?: (generating: boolean) => void;
}

const DRAWER_HEIGHT = 220;
const HANDLE_HEIGHT = 36;

const ExecutionDrawer: React.FC<ExecutionDrawerProps> = ({ isOpen, onToggle, taskId, onExecutionFinished, onStatusChange, onReportGenerating }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const logRef = useRef<HTMLDivElement>(null);
  const onExecutionFinishedRef = useRef(onExecutionFinished);
  useEffect(() => { onExecutionFinishedRef.current = onExecutionFinished; }, [onExecutionFinished]);

  const [logs, setLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [execStatus, setExecStatus] = useState<string>('pending');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      setIsDone(false);
      setExecStatus('pending');
      setScheduledAt(null);
      setIsGeneratingReport(false);
      onReportGenerating?.(false);
      onStatusChange?.('idle');
      return;
    }

    setLogs([t('pages.testPlan.drawer.connectingOrchestrator')]);
    setIsDone(false);
    // Let the initial fetch set the correct status
    // onStatusChange?.('pending');

    // Initial fetch to get scheduledAt if applicable
    fetch(`/api/execution-status/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          setExecStatus(data.status);
          onStatusChange?.(data.status);
        }
        if (data.scheduled_at) {
          setScheduledAt(data.scheduled_at);
        }
      })
      .catch(err => console.error('Error fetching initial status', err));

    const es = new EventSource(`/api/execution-status/${taskId}/stream`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status) {
          setExecStatus(data.status);
          onStatusChange?.(data.status);
        }
        if (data.line) {
          // Detect structured allure_report events embedded in log lines
          try {
            const ev = JSON.parse(data.line);
            if (ev.type === 'allure_report') {
              if (ev.status === 'generating') {
                setIsGeneratingReport(true);
                onReportGenerating?.(true);
              } else if (ev.status === 'ready') {
                setIsGeneratingReport(false);
                onReportGenerating?.(false);
              }
              return; // Don't add this JSON line to the visible log
            }
          } catch { /* not a structured event, render as plain log */ }

          setLogs(prev => [...prev, data.line]);
        }
        if (data.done) {
          setIsGeneratingReport(false);
          onReportGenerating?.(false);
          setIsDone(true);
          onExecutionFinishedRef.current();
          es.close();
        }
      } catch (err) {
        console.error('Error parsing SSE message', err);
      }
    };

    es.onerror = () => {
      setLogs(prev => [...prev, t('pages.testPlan.drawer.connLogStreamError')]);
      setIsDone(true);
      onExecutionFinishedRef.current();
      es.close();
    };

    return () => {
      es.close();
    };
  // onStatusChange is intentionally excluded: it comes from setState (stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Countdown timer
  useEffect(() => {
    if (execStatus !== 'scheduled' || !scheduledAt) return;
    
    const interval = setInterval(() => {
      const target = new Date(scheduledAt).getTime();
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown(`00:00:00 ${t('pages.testPlan.drawer.remaining')}`);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${t('pages.testPlan.drawer.remaining')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [execStatus, scheduledAt]);

  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await fetch(`/api/execution-status/${taskId}/cancel`, { method: 'POST' });
      setExecStatus('cancelled');
      onStatusChange?.('cancelled');
      onExecutionFinished();
    } catch (err) {
      console.error('Failed to cancel task', err);
    }
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {/* Handle bar (always visible) */}
      <Box
        onClick={onToggle}
        sx={{
          height: HANDLE_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 1,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          cursor: 'pointer',
          userSelect: 'none',
          borderTop: isOpen ? 0 : 1,
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
          transition: 'background-color 0.15s ease',
        }}
      >
        <TerminalRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography
          variant="overline"
          sx={{ flex: 1, fontSize: '0.62rem', letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}
        >
          {t('pages.testPlan.drawer.title')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', mr: 1 }}>
          {t('pages.testPlan.drawer.subtitle')}
        </Typography>
        <Tooltip title={isOpen ? t('common.collapse') : t('common.expand')}>
          <IconButton size="small" sx={{ p: 0.25 }}>
            {isOpen ? (
              <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandLessRoundedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Drawer body */}
      {isOpen && (
        <Box
          ref={logRef}
          sx={{
            height: DRAWER_HEIGHT,
            bgcolor: theme.palette.mode === 'dark' ? '#0d1117' : '#1e1e1e',
            overflow: 'auto',
            px: 2,
            py: 1.5,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: '0.72rem',
            color: '#a0aec0',
            lineHeight: 1.6,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#374151', borderRadius: 2 },
          }}
        >
          {!taskId && logs.length === 0 ? (
            <Typography
              component="div"
              sx={{
                color: '#4ade80',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                mb: 0.5,
              }}
            >
              {t('pages.testPlan.drawer.readyToRun')}
            </Typography>
          ) : execStatus === 'scheduled' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <Typography sx={{ color: '#38BDF8', fontFamily: 'inherit', fontSize: '1.2rem', fontWeight: 600 }}>
                {t('pages.testPlan.drawer.scheduled')}
              </Typography>
              <Typography sx={{ color: '#F8FAFC', fontFamily: 'inherit', fontSize: '2rem', fontWeight: 700 }}>
                {countdown}
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<CancelRoundedIcon />}
                onClick={handleCancel}
                sx={{ 
                  mt: 1,
                  borderColor: '#f87171', 
                  color: '#f87171', 
                  textTransform: 'none',
                  '&:hover': { borderColor: '#ef4444', bgcolor: alpha('#ef4444', 0.1) }
                }}
              >
                {t('pages.testPlan.drawer.cancelRun')}
              </Button>
            </Box>
          ) : (
            logs.map((log, i) => (
              <Typography
                key={i}
                component="div"
                sx={{
                  color: log.includes('ERROR') || log.includes('FAIL') || log.includes('failed') ? '#f87171' 
                         : log.includes('PASS') || log.includes('passed') ? '#4ade80'
                         : log.includes('cancelled') ? '#f59e0b'
                         : 'inherit',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {log}
              </Typography>
            ))
          )}

          {/* ── Allure report generation indicator ── */}
          {isGeneratingReport && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mt: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: alpha('#818cf8', 0.35),
                bgcolor: alpha('#818cf8', 0.08),
                animation: 'pulse 1.8s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                },
              }}
            >
              <CircularProgress size={13} thickness={4} sx={{ color: '#818cf8', flexShrink: 0 }} />
              <Typography
                sx={{
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  color: '#818cf8',
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {t('pages.testPlan.drawer.generatingAllure')}
              </Typography>
            </Box>
          )}

          {isDone && (
             <Box sx={{ mt: 2, pb: 1 }}>
               <Button 
                 variant="outlined" 
                 size="small" 
                 startIcon={<OpenInNewRoundedIcon />}
                 onClick={() => navigate('/reports')}
                 sx={{ 
                   borderColor: '#4ade80', 
                   color: '#4ade80', 
                   textTransform: 'none',
                   '&:hover': { borderColor: '#22c55e', bgcolor: alpha('#22c55e', 0.1) }
                 }}
               >
                 {t('pages.testPlan.drawer.goToReports')}
               </Button>
             </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ExecutionDrawer;
