import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import { BarChart as BarChartIcon, Refresh as RefreshIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';

const ReportsPage: React.FC = () => {
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
        <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BarChartIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Typography variant="h4" component="h1">
                        Test Execution Reports
                    </Typography>
                </Box>
                <Box>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={checkReport}
                        sx={{ mr: 1 }}
                    >
                        Refresh status
                    </Button>
                    {reportExists && (
                        <Button
                            variant="outlined"
                            startIcon={<OpenInNewIcon />}
                            onClick={handleOpenExternal}
                        >
                            Open in New Tab
                        </Button>
                    )}
                </Box>
            </Box>

            <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                View detailed Allure reports for the latest test executions.
            </Typography>

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
    );
};

export default ReportsPage;
