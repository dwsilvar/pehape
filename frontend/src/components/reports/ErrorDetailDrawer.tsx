import React from 'react';
import { Drawer, Box, Typography, IconButton, Divider, useTheme, alpha } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

interface ErrorDetailDrawerProps {
    scenario: any | null;
    isOpen: boolean;
    onClose: () => void;
}

const ErrorDetailDrawer: React.FC<ErrorDetailDrawerProps> = ({ scenario, isOpen, onClose }) => {
    const theme = useTheme();

    if (!scenario) return null;

    return (
        <Drawer
            anchor="right"
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 500,
                    maxWidth: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: alpha(theme.palette.error.main, 0.1) }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: theme.palette.error.main }}>
                    <ErrorOutlineRoundedIcon />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                        Detalles del Error
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon />
                </IconButton>
            </Box>

            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="subtitle2" color="text.secondary">Escenario Fallido</Typography>
                <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{scenario.scenario_name}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}>
                    Archivo: {scenario.feature_path}
                </Typography>
            </Box>

            <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Console Output & Stacktrace</Typography>
                <Box
                    sx={{
                        backgroundColor: theme.palette.mode === 'dark' ? '#0d1117' : '#1e1e1e',
                        color: '#a0aec0',
                        p: 2,
                        borderRadius: 1,
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        overflowX: 'auto',
                        minHeight: 200
                    }}
                >
                    {scenario.logs ? scenario.logs : 'No hay logs disponibles para este escenario.'}
                </Box>
            </Box>
        </Drawer>
    );
};

export default ErrorDetailDrawer;
