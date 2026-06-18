import React, { useMemo } from 'react';
import { Box, Typography, Paper, Grid, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

interface ReportExecutiveViewProps {
    data: any;
}

const ReportExecutiveView: React.FC<ReportExecutiveViewProps> = ({ data }) => {
    const theme = useTheme();
    const { t } = useTranslation();

    const stats = useMemo(() => {
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let totalTime = 0;

        if (data && data.test_cycles) {
            for (const cycle of data.test_cycles) {
                if (cycle.test_flows) {
                    for (const flow of cycle.test_flows) {
                        if (flow.scenarios) {
                            for (const sc of flow.scenarios) {
                                if (sc.result_status === 'pass') passed++;
                                else if (sc.result_status === 'fail') failed++;
                                else skipped++;

                                if (sc.duration_ms) totalTime += sc.duration_ms;
                            }
                        }
                    }
                }
            }
        }

        return {
            passed, failed, skipped, total: passed + failed + skipped,
            totalTimeSeconds: (totalTime / 1000).toFixed(1)
        };
    }, [data]);

    const chartData = [
        { name: t('pages.reports.passed'), value: stats.passed, color: '#10B981' },
        { name: t('pages.reports.failed'), value: stats.failed, color: '#EF4444' },
        { name: t('pages.reports.skipped'), value: stats.skipped, color: '#94A3B8' }
    ].filter(d => d.value > 0);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>{t('pages.reports.dashboardExecutive')}</Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper elevation={1} sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                            {stats.total}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">{t('pages.reports.totalScenarios')}</Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper elevation={1} sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: stats.failed > 0 ? '#EF4444' : '#10B981' }}>
                            {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">{t('pages.reports.globalSuccessRate')}</Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper elevation={1} sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700 }}>
                            {stats.totalTimeSeconds}s
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">{t('pages.reports.totalExecutionTime')}</Typography>
                    </Paper>
                </Grid>

                {/* Donut Chart */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={1} sx={{ p: 3, height: 350 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{t('pages.reports.resultsDistribution')}</Typography>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ReportExecutiveView;
