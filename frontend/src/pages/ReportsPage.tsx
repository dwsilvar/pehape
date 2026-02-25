import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import { BarChart as BarChartIcon, Refresh as RefreshIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';
import { useTranslation } from 'react-i18next';

const ReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const [reportExists, setReportExists] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const reportUrl = '/api/report/';

    const checkReport = async () => {
        setLoading(true);
        try {
            const response = await fetch(reportUrl, { method: 'HEAD' });
            setReportExists(response.ok);
        } catch (error) {
            console.error('Error checking report existence:', error);
            setReportExists(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkReport();
    }, []);

    const handleOpenExternal = () => {
        window.open(reportUrl, '_blank');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title={t('pages.reports.title')} icon={<BarChartIcon sx={{ fontSize: 32 }} />} />
            <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        {t('pages.reports.subtitle')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={checkReport}
                            variant="outlined"
                        >
                            {t('pages.reports.refresh')}
                        </Button>
                        {reportExists && (
                            <Button
                                startIcon={<OpenInNewIcon />}
                                onClick={handleOpenExternal}
                            >
                                {t('pages.reports.openNewTab')}
                            </Button>
                        )}
                    </Box>
                </Box>

                <Paper elevation={3} sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '500px', display: 'flex' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            <CircularProgress />
                            <Typography sx={{ mt: 2 }}>Checking report status...</Typography>
                        </Box>
                    ) : reportExists ? (
                        <iframe
                            src={reportUrl}
                            style={{ border: 'none', width: '100%', height: '100%' }}
                            title="Allure Report"
                        />
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No report available yet.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Run a test sequence to generate the execution report.
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default ReportsPage;
