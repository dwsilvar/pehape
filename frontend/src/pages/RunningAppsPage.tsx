import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Alert, CircularProgress, IconButton, Tooltip, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Window as WindowIcon, Warning as WarningIcon, Refresh as RefreshIcon, CropSquare, Minimize, CheckCircle, DesktopWindows } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';
import { useTranslation } from 'react-i18next';

interface WindowGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface AppItem {
    title: string;
    id: number;
    isActive: boolean;
    isMaximized: boolean;
    isMinimized: boolean;
    geometry: WindowGeometry;
}

interface RunningAppsResponse {
    platform: string;
    count?: number;
    windows?: AppItem[];
    error?: string;
}

const RunningAppsPage: React.FC = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<RunningAppsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRunningApps();
    }, []);

    const fetchRunningApps = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/tools/running-apps');
            const result = await response.json();

            if (!response.ok) {
                setData({ platform: 'Unknown', error: result.error || 'Failed to fetch' });
            } else {
                setData(result);
            }
        } catch (err) {
            setError(t('pages.runningApps.connectionError'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title={t('pages.runningApps.title')} icon={<WindowIcon sx={{ fontSize: 32 }} />} showControls={false} />
            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
                        {t('pages.runningApps.subtitle')}
                    </Typography>
                    <Tooltip title={t('pages.runningApps.refresh')}>
                        <IconButton onClick={fetchRunningApps} color="primary" size="large">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {data?.error ? (
                    <Alert severity="warning" icon={<WarningIcon fontSize="inherit" />}>
                        {data.error}
                    </Alert>
                ) : (
                    <Paper elevation={2} sx={{ maxWidth: 1000 }}>
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                            <Typography variant="h6">
                                {t('pages.runningApps.windowsFound', { count: data?.count || 0 })}
                            </Typography>
                        </Box>

                        {loading ? (
                            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <TableContainer sx={{ maxHeight: '70vh' }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell width={80}>{t('pages.runningApps.columns.handle')}</TableCell>
                                            <TableCell>{t('pages.runningApps.columns.title')}</TableCell>
                                            <TableCell width={200}>{t('pages.runningApps.columns.geometry')}</TableCell>
                                            <TableCell width={150}>{t('pages.runningApps.columns.state')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data?.windows?.map((app, index) => (
                                            <TableRow key={`${app.id}-${index}`} hover selected={app.isActive}>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={app.id}
                                                        sx={{ fontFamily: 'monospace' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <WindowIcon fontSize="small" color={app.isActive ? "primary" : "action"} />
                                                        <Typography variant="body2" fontWeight={app.isActive ? 'bold' : 'normal'}>
                                                            {app.title}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={`(${app.geometry.left}, ${app.geometry.top})`}>
                                                        <Chip
                                                            size="small"
                                                            variant="outlined"
                                                            icon={<CropSquare />}
                                                            label={`${app.geometry.width}x${app.geometry.height}`}
                                                        />
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5}>
                                                        {app.isActive && <Chip size="small" label={t('pages.runningApps.states.active')} color="success" icon={<CheckCircle />} />}
                                                        {app.isMinimized && <Chip size="small" label={t('pages.runningApps.states.minimized')} icon={<Minimize />} />}
                                                        {app.isMaximized && <Chip size="small" label={t('pages.runningApps.states.maximized')} icon={<DesktopWindows />} />}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {data?.windows?.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                                    <Typography color="text.secondary">{t('pages.runningApps.noApps')}</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                )}
            </Box>
        </Box>
    );
};

export default RunningAppsPage;
