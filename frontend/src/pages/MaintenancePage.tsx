import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';

import { Delete as DeleteIcon, Refresh as RefreshIcon, Build as BuildIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';
import { useTranslation } from 'react-i18next';

interface ReportUsage {
    results_size: number;
    report_size: number;
    screenshots_size: number;
    total_size: number;
}

const MaintenancePage: React.FC = () => {
    const { t } = useTranslation();
    const [usage, setUsage] = useState<ReportUsage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, target: string, title: string } | null>(null);

    const fetchUsage = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/reports/usage');
            if (!response.ok) throw new Error('Failed to fetch usage data');
            const data = await response.json();
            setUsage(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClean = async (target: string) => {
        try {
            const response = await fetch('/api/reports/clean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
            if (!response.ok) throw new Error('Failed to clean reports');
            await fetchUsage(); // Refresh data
            setConfirmDialog(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchUsage();
    }, []);

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title={t('pages.maintenance.title')} icon={<BuildIcon sx={{ fontSize: 32 }} />} />
            <Box sx={{ p: 4, flex: 1, overflow: 'auto' }}>
                <Box display="flex" justifyContent="flex-end" alignItems="center" mb={4}>
                    <Button startIcon={<RefreshIcon />} onClick={fetchUsage} variant="outlined">
                        {t('pages.maintenance.refresh')}
                    </Button>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {loading && !usage ? (
                    <CircularProgress />
                ) : (
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            md: '1fr 1fr',
                            lg: 'repeat(4, 1fr)'
                        },
                        gap: 3
                    }}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('pages.maintenance.results')}
                                </Typography>
                                <Typography variant="h5" component="div">
                                    {usage ? formatBytes(usage.results_size) : '-'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Create in reports/allure_results
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setConfirmDialog({ open: true, target: 'results', title: t('pages.maintenance.confirmTitle') })}
                                >
                                    {t('pages.maintenance.cleanDirectory')}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('pages.maintenance.reports')}
                                </Typography>
                                <Typography variant="h5" component="div">
                                    {usage ? formatBytes(usage.report_size) : '-'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Static site in reports/allure-report
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setConfirmDialog({ open: true, target: 'report', title: t('pages.maintenance.confirmTitle') })}
                                >
                                    {t('pages.maintenance.cleanDirectory')}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('pages.maintenance.screenshots')}
                                </Typography>
                                <Typography variant="h5" component="div">
                                    {usage ? formatBytes(usage.screenshots_size) : '-'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Images in reports/screenshots
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setConfirmDialog({ open: true, target: 'screenshots', title: t('pages.maintenance.confirmTitle') })}
                                >
                                    {t('pages.maintenance.cleanDirectory')}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card sx={{ bgcolor: 'action.hover' }}>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Total Usage
                                </Typography>
                                <Typography variant="h4" component="div" color="primary">
                                    {usage ? formatBytes(usage.total_size) : '-'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                    Total disk space used by Allure
                                </Typography>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={() => setConfirmDialog({ open: true, target: 'all', title: 'Delete EVERYTHING?' })}
                                >
                                    Clean All
                                </Button>
                            </CardContent>
                        </Card>
                    </Box>
                )}

                {/* Confirmation Dialog */}
                <Dialog open={confirmDialog?.open || false} onClose={() => setConfirmDialog(null)}>
                    <DialogTitle>{confirmDialog?.title}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {confirmDialog?.target === 'all'
                                ? t('pages.maintenance.confirmAll')
                                : t('pages.maintenance.confirmMessage')
                            }
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDialog(null)}>{t('common.cancel')}</Button>
                        <Button onClick={() => handleClean(confirmDialog?.target || '')} color="error" variant="contained">
                            {t('common.delete')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default MaintenancePage;
