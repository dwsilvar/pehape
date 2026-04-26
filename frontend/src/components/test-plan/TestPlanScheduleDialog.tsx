import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, TextField, alpha, useTheme
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useTranslation } from 'react-i18next';

interface TestPlanScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (scheduledAt: string) => void;
}

const toLocalISO = (d: Date): string => {
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
};

const TestPlanScheduleDialog: React.FC<TestPlanScheduleDialogProps> = ({
    open, onClose, onConfirm
}) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [scheduledTime, setScheduledTime] = useState('');

    useEffect(() => {
        if (open) {
            // Default to 15 mins from now
            setScheduledTime(toLocalISO(new Date(Date.now() + 15 * 60000)));
        }
    }, [open]);

    const handleConfirm = () => {
        if (scheduledTime) {
            // Convert local datetime to UTC ISO string to send to backend
            const localDate = new Date(scheduledTime);
            if (!isNaN(localDate.getTime())) {
                onConfirm(localDate.toISOString());
            }
            onClose();
        }
    };

    const isDark = theme.palette.mode === 'dark';
    const BG = isDark ? '#1E293B' : '#FFFFFF';
    const PRIMARY = theme.palette.primary.main;

    const targetDate = new Date(scheduledTime);
    const isValid = !isNaN(targetDate.getTime()) && targetDate.getTime() > Date.now();

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
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                }
            }}
        >
            <DialogTitle sx={{ p: 0 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 3,
                        py: 2.5,
                        borderBottom: `1px solid ${alpha(PRIMARY, 0.15)}`,
                        background: `linear-gradient(135deg, ${alpha(PRIMARY, 0.08)} 0%, ${alpha(PRIMARY, 0.02)} 100%)`,
                    }}
                >
                    <ScheduleIcon sx={{ color: PRIMARY, fontSize: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '1.1rem' }}>
                        Programar Ejecución
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    Selecciona la fecha y hora exacta en la que deseas que el Test Plan comience a ejecutarse.
                </Typography>
                <TextField
                    id="schedule-datetime"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="medium"
                    error={!isValid && scheduledTime !== ''}
                    helperText={!isValid && scheduledTime !== '' ? 'La hora seleccionada ya pasó.' : ''}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                        }
                    }}
                />
            </DialogContent>

            <DialogActions
                sx={{
                    px: 3,
                    py: 2.5,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    justifyContent: 'flex-end',
                    gap: 1.5,
                    bgcolor: alpha(theme.palette.background.default, 0.4)
                }}
            >
                <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        color: 'text.secondary',
                        borderColor: alpha(theme.palette.divider, 0.8),
                        borderRadius: '8px',
                        '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.8), borderColor: 'text.secondary' },
                    }}
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={!scheduledTime || !isValid}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '8px',
                        backgroundColor: PRIMARY,
                        color: '#fff',
                        px: 3,
                        boxShadow: `0 4px 12px ${alpha(PRIMARY, 0.3)}`,
                        '&:hover': { backgroundColor: alpha(PRIMARY, 0.85) },
                        '&.Mui-disabled': { opacity: 0.5, color: '#fff' },
                    }}
                >
                    Programar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TestPlanScheduleDialog;
