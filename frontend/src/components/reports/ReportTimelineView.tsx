import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, alpha, useTheme, Chip } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import PauseCircleFilledRoundedIcon from '@mui/icons-material/PauseCircleFilledRounded';
import ErrorDetailDrawer from './ErrorDetailDrawer';

interface ReportTimelineViewProps {
    data: any;
}

const getStatusColor = (status: string, theme: any) => {
    switch (status) {
        case 'pass': return '#10B981'; // Green
        case 'fail': return '#EF4444'; // Red
        case 'skip': return '#94A3B8'; // Slate/Grey
        default: return theme.palette.text.secondary;
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'pass': return <CheckCircleRoundedIcon fontSize="small" sx={{ color: '#10B981' }} />;
        case 'fail': return <CancelRoundedIcon fontSize="small" sx={{ color: '#EF4444' }} />;
        case 'skip': return <PauseCircleFilledRoundedIcon fontSize="small" sx={{ color: '#94A3B8' }} />;
        default: return null;
    }
};

const ReportTimelineView: React.FC<ReportTimelineViewProps> = ({ data }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [selectedError, setSelectedError] = useState<any | null>(null);

    return (
        <Box sx={{ pl: 2 }}>
            {data.test_cycles?.map((cycle: any) => (
                <Box key={cycle.cycle_id} sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: theme.palette.primary.main }}>
                        {t('pages.reports.cycle')}: {cycle.cycle_name || cycle.cycle_id}
                    </Typography>

                    {cycle.test_flows?.map((flow: any) => (
                        <Box key={flow.flow_id} sx={{ ml: 3, mb: 3, borderLeft: `2px dashed ${theme.palette.divider}`, pl: 3, position: 'relative' }}>
                            <Box sx={{
                                position: 'absolute',
                                left: -6,
                                top: 6,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.divider
                            }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                                {t('pages.reports.flow')}: {(() => {
                                    let displayFlowName = flow.flow_name ? flow.flow_name.replace(' — Default', '').replace(' - Default', '') : t('pages.reports.withoutGroup');
                                    if (displayFlowName) {
                                        displayFlowName = displayFlowName.replace(/\(((?:Matriz|Caso|Case) \d+)\)/g, (match: string, p1: string) => {
                                            const numberPart = p1.split(' ').pop();
                                            const translatedCase = t('common.case') || 'case';
                                            const capitalizedCase = translatedCase.charAt(0).toUpperCase() + translatedCase.slice(1);
                                            return `(${capitalizedCase} ${numberPart})`;
                                        });
                                    }
                                    return displayFlowName;
                                })()}
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {flow.scenarios?.map((scenario: any, idx: number) => {
                                    const status = scenario.result_status || 'skip';
                                    const color = getStatusColor(status, theme);
                                    const isFailed = status === 'fail';

                                    return (
                                        <Paper
                                            key={`${scenario.scenario_name}-${idx}`}
                                            elevation={1}
                                            onClick={() => isFailed && setSelectedError(scenario)}
                                            sx={{
                                                width: 320,
                                                p: 2,
                                                border: `1px solid ${alpha(color, 0.4)}`,
                                                borderLeft: `4px solid ${color}`,
                                                backgroundColor: theme.palette.mode === 'dark' ? alpha(color, 0.05) : alpha(color, 0.02),
                                                cursor: isFailed ? 'pointer' : 'default',
                                                transition: 'all 0.2s ease',
                                                '&:hover': isFailed ? {
                                                    boxShadow: `0 4px 12px ${alpha(color, 0.2)}`,
                                                    transform: 'translateY(-2px)'
                                                } : {}
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                                <Box sx={{ mt: 0.3 }}>
                                                    {getStatusIcon(status)}
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3, wordWrap: 'break-word' }}>
                                                        {scenario.scenario_name}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                                        <Chip label={status.toUpperCase()} size="small" sx={{ fontSize: '0.65rem', height: 20, backgroundColor: alpha(color, 0.15), color: color, fontWeight: 700 }} />
                                                        {scenario.duration_ms !== undefined && (
                                                            <Chip label={`${scenario.duration_ms}ms`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))}
                </Box>
            ))}

            <ErrorDetailDrawer
                scenario={selectedError}
                isOpen={!!selectedError}
                onClose={() => setSelectedError(null)}
            />
        </Box>
    );
};

export default ReportTimelineView;
