import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Chip, TextField, alpha, useTheme, Divider
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface ScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    scheduledTime: string;
    setScheduledTime: (time: string) => void;
    onConfirm: () => void;
}

const QUICK_OPTIONS = [
    { label: '+1 min',  value: 1  },
    { label: '+5 min',  value: 5  },
    { label: '+15 min', value: 15 },
    { label: '+30 min', value: 30 },
    { label: '+1 hora', value: 60 },
];

const pad = (n: number) => String(n).padStart(2, '0');

const formatClock = (d: Date) =>
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const formatFull = (isoLocal: string): string => {
    if (!isoLocal) return '';
    const d = new Date(isoLocal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
};

const getRelativeTime = (isoLocal: string): { mins: number; label: string } | null => {
    if (!isoLocal) return null;
    const target = new Date(isoLocal);
    if (isNaN(target.getTime())) return null;
    const totalMins = Math.round((target.getTime() - Date.now()) / 60000);
    if (totalMins >= 60) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return { mins: totalMins, label: m > 0 ? `${h}h ${m}min` : `${h}h` };
    }
    return { mins: totalMins, label: `${totalMins} min` };
};

const toLocalISO = (d: Date): string => {
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
};

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({
    open, onClose, scheduledTime, setScheduledTime, onConfirm
}) => {
    const theme = useTheme();
    const [now, setNow] = useState(new Date());
    const [customInput, setCustomInput] = useState('');
    const [selectedChip, setSelectedChip] = useState<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (open) {
            setNow(new Date());
            timerRef.current = setInterval(() => setNow(new Date()), 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [open]);

    const applyMinutes = (mins: number) => {
        setScheduledTime(toLocalISO(new Date(Date.now() + mins * 60 * 1000)));
        setSelectedChip(mins);
        setCustomInput('');
    };

    const handleCustomApply = () => {
        const mins = parseInt(customInput, 10);
        if (!isNaN(mins) && mins > 0) {
            applyMinutes(mins);
            setSelectedChip(null);
        }
    };

    const handleChipClick = (value: number) => {
        if (selectedChip === value) {
            setSelectedChip(null);
            setScheduledTime('');
        } else {
            applyMinutes(value);
        }
    };

    const relative = getRelativeTime(scheduledTime);
    const isExpired = relative !== null && relative.mins < 0;
    const hasTarget = scheduledTime && relative !== null;

    const BG = theme.palette.mode === 'dark' ? '#1E1E1E' : '#FAFAFA';
    const PRIMARY = '#75BCF4';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    backgroundColor: BG,
                    backgroundImage: 'none',
                    overflow: 'hidden',
                }
            }}
        >
            {/* ── Header ── */}
            <DialogTitle sx={{ p: 0 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        py: 2,
                        borderBottom: `1px solid ${alpha(PRIMARY, 0.15)}`,
                        background: `linear-gradient(135deg, ${alpha(PRIMARY, 0.12)} 0%, ${alpha(PRIMARY, 0.04)} 100%)`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon sx={{ color: PRIMARY, fontSize: 20 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Programar Ejecución
                        </Typography>
                    </Box>
                    {/* Live Clock */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '8px',
                            backgroundColor: alpha(PRIMARY, 0.12),
                            border: `1px solid ${alpha(PRIMARY, 0.25)}`,
                        }}
                    >
                        <AccessTimeIcon sx={{ fontSize: 14, color: PRIMARY }} />
                        <Typography
                            variant="body2"
                            sx={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: PRIMARY,
                                letterSpacing: '0.05em',
                                fontSize: '0.82rem',
                            }}
                        >
                            {formatClock(now)}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* ── Programación rápida ── */}
                <Box>
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'text.secondary',
                            display: 'block',
                            mb: 1,
                        }}
                    >
                        Programación Rápida
                    </Typography>

                    {/* Chips */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                        {QUICK_OPTIONS.map(opt => (
                            <Chip
                                key={opt.value}
                                label={opt.label}
                                onClick={() => handleChipClick(opt.value)}
                                variant={selectedChip === opt.value ? 'filled' : 'outlined'}
                                size="small"
                                sx={{
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                    borderColor: selectedChip === opt.value ? 'transparent' : alpha(PRIMARY, 0.4),
                                    backgroundColor: selectedChip === opt.value ? PRIMARY : 'transparent',
                                    color: selectedChip === opt.value ? '#fff' : PRIMARY,
                                    '&:hover': {
                                        backgroundColor: selectedChip === opt.value
                                            ? alpha(PRIMARY, 0.85)
                                            : alpha(PRIMARY, 0.1),
                                    },
                                    transition: 'all 0.15s ease',
                                }}
                            />
                        ))}
                    </Box>

                    {/* Custom input */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="Personalizado (minutos)"
                            value={customInput}
                            onChange={e => {
                                const v = e.target.value.replace(/\D/, '');
                                setCustomInput(v);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') handleCustomApply(); }}
                            inputProps={{ inputMode: 'numeric' }}
                            sx={{ flex: 1 }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleCustomApply}
                            disabled={!customInput || parseInt(customInput, 10) <= 0}
                            sx={{
                                backgroundColor: PRIMARY,
                                color: '#fff',
                                textTransform: 'none',
                                fontWeight: 600,
                                borderRadius: '8px',
                                '&:hover': { backgroundColor: alpha(PRIMARY, 0.85) },
                                '&.Mui-disabled': { opacity: 0.4 },
                            }}
                        >
                            Aplicar
                        </Button>
                    </Box>
                </Box>

                <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.6) }}>
                    <Typography variant="caption" color="text.disabled">
                        o fecha/hora específica
                    </Typography>
                </Divider>

                {/* ── Fecha y hora específica ── */}
                <Box>
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'text.secondary',
                            display: 'block',
                            mb: 1,
                        }}
                    >
                        Fecha y Hora Específica
                    </Typography>
                    <TextField
                        id="schedule-datetime"
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={e => {
                            setScheduledTime(e.target.value);
                            setSelectedChip(null);
                            setCustomInput('');
                        }}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                            }
                        }}
                    />
                </Box>

                {/* ── Feedback area ── */}
                {hasTarget && (
                    <Box
                        sx={{
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: `1px solid ${isExpired
                                ? alpha(theme.palette.error.main, 0.35)
                                : alpha('#4CAF50', 0.35)}`,
                            background: isExpired
                                ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.14)} 0%, ${alpha(theme.palette.error.main, 0.06)} 100%)`
                                : `linear-gradient(135deg, ${alpha('#4CAF50', 0.18)} 0%, ${alpha('#4CAF50', 0.06)} 100%)`,
                        }}
                    >
                        {/* Top accent stripe */}
                        <Box sx={{
                            height: '3px',
                            background: isExpired
                                ? theme.palette.error.main
                                : 'linear-gradient(90deg, #4CAF50, #81C784)',
                        }} />

                        <Box sx={{ px: 2, py: 1.75 }}>
                            {isExpired ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ErrorOutlineIcon sx={{ color: theme.palette.error.main, fontSize: 22 }} />
                                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'error.main' }}>
                                        La hora seleccionada ya pasó
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    {/* Label */}
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            color: '#4CAF50',
                                            display: 'block',
                                            mb: 0.5,
                                            opacity: 0.85,
                                        }}
                                    >
                                        Iniciará en
                                    </Typography>

                                    {/* Big countdown */}
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.75 }}>
                                        <Typography
                                            variant="h4"
                                            sx={{
                                                fontWeight: 800,
                                                color: '#4CAF50',
                                                fontFamily: 'monospace',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {relative!.label}
                                        </Typography>
                                    </Box>

                                    {/* Full datetime */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#4CAF50', opacity: 0.7 }} />
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.primary', fontWeight: 500, opacity: 0.9 }}
                                        >
                                            {formatFull(scheduledTime)}
                                        </Typography>
                                    </Box>
                                </>
                            )}
                        </Box>
                    </Box>
                )}

            </DialogContent>

            {/* ── Actions ── */}
            <DialogActions
                sx={{
                    px: 2.5,
                    py: 1.75,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    justifyContent: 'flex-end',
                    gap: 1,
                }}
            >
                <Button
                    onClick={onClose}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        color: 'text.secondary',
                        '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.8) },
                    }}
                >
                    Cancelar
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    disabled={!scheduledTime || isExpired}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: '8px',
                        backgroundColor: PRIMARY,
                        color: '#fff',
                        px: 2.5,
                        '&:hover': { backgroundColor: alpha(PRIMARY, 0.85) },
                        '&.Mui-disabled': { opacity: 0.4, color: '#fff' },
                    }}
                >
                    Programar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScheduleDialog;
