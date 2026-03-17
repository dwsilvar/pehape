import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Button, Paper, CircularProgress, Tabs, Tab,
    Accordion, AccordionSummary, AccordionDetails, Chip, Tooltip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    useTheme, alpha
} from '@mui/material';
import {
    BarChart as BarChartIcon,
    Refresh as RefreshIcon,
    OpenInNew as OpenInNewIcon,
    ExpandMore as ExpandMoreIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    SkipNext as SkipNextIcon,
    Error as ErrorIcon,
    Science as ScienceIcon,
    UnfoldMore as UnfoldMoreIcon,
    UnfoldLess as UnfoldLessIcon,
    AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';
import { useTranslation } from 'react-i18next';

// --- Types ---
interface StepResult {
    name: string;
    keyword: string;
    status: string;
}

interface ScenarioResult {
    name: string;
    status: string;
    duration_ms: number;
    tags: string[];
    steps: StepResult[];
}

interface FeatureResult {
    name: string;
    scenarios: ScenarioResult[];
}

interface GherkinReport {
    features: FeatureResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        broken: number;
        skipped: number;
        total_duration_ms: number;
    };
}

// --- Helpers ---
const getStatusColor = (status: string, theme: any) => {
    switch (status) {
        case 'passed': return theme.palette.success.main;
        case 'failed': return theme.palette.error.main;
        case 'broken': return theme.palette.warning.main;
        case 'skipped': return theme.palette.grey[500];
        default: return theme.palette.text.secondary;
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'passed': return <CheckCircleIcon fontSize="small" />;
        case 'failed': return <CancelIcon fontSize="small" />;
        case 'broken': return <ErrorIcon fontSize="small" />;
        case 'skipped': return <SkipNextIcon fontSize="small" />;
        default: return null;
    }
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
};

// --- Sub-component: Summary Cards ---
const SummaryCards: React.FC<{ summary: GherkinReport['summary']; t: any }> = ({ summary, t }) => {
    const theme = useTheme();
    const cards = [
        { label: t('pages.reports.total'), value: summary.total, color: theme.palette.primary.main },
        { label: t('pages.reports.passed'), value: summary.passed, color: theme.palette.success.main },
        { label: t('pages.reports.failed'), value: summary.failed, color: theme.palette.error.main },
        { label: t('pages.reports.broken'), value: summary.broken, color: theme.palette.warning.main },
        { label: t('pages.reports.skipped'), value: summary.skipped, color: theme.palette.grey[500] },
        { label: t('pages.reports.totalTime'), value: formatDuration(summary.total_duration_ms || 0), color: theme.palette.info.main },
    ];

    return (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {cards.map((card) => (
                <Paper
                    key={card.label}
                    elevation={2}
                    sx={{
                        flex: '1 1 120px',
                        maxWidth: 180,
                        p: 2,
                        textAlign: 'center',
                        borderTop: `3px solid ${card.color}`,
                        background: alpha(card.color, 0.04),
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 4px 12px ${alpha(card.color, 0.25)}`
                        }
                    }}
                >
                    <Typography variant="h4" sx={{ fontWeight: 700, color: card.color, fontSize: typeof card.value === 'string' ? '1.5rem' : undefined }}>
                        {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5 }}>
                        {card.label}
                    </Typography>
                </Paper>
            ))}
        </Box>
    );
};

// --- Sub-component: Scenario Steps Table ---
const StepsTable: React.FC<{ steps: StepResult[] }> = ({ steps }) => {
    const theme = useTheme();

    return (
        <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 600, width: 80 }}>Keyword</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Step</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: 90, textAlign: 'center' }}>Status</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {steps.map((step, idx) => (
                        <TableRow
                            key={idx}
                            sx={{
                                '&:last-child td': { borderBottom: 0 },
                                backgroundColor: step.status === 'failed'
                                    ? alpha(theme.palette.error.main, 0.06)
                                    : step.status === 'broken'
                                        ? alpha(theme.palette.warning.main, 0.06)
                                        : 'transparent'
                            }}
                        >
                            <TableCell>
                                <Chip
                                    label={step.keyword || '—'}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        borderColor: theme.palette.primary.main,
                                        color: theme.palette.primary.main
                                    }}
                                />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.85rem' }}>{step.name}</TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                                <Tooltip title={step.status}>
                                    <Box sx={{ color: getStatusColor(step.status, theme), display: 'inline-flex' }}>
                                        {getStatusIcon(step.status)}
                                    </Box>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// --- Sub-component: Gherkin Tab Content ---
const GherkinTabContent: React.FC<{ t: any }> = ({ t }) => {
    const theme = useTheme();
    const [report, setReport] = useState<GherkinReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
    const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

    const fetchResults = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/reports/gherkin-results');
            const data = await response.json();
            setReport(data);
            // Auto-expand all features by default
            setExpandedFeatures(new Set(data.features.map((f: FeatureResult) => f.name)));
        } catch (error) {
            console.error('Error fetching gherkin results:', error);
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    const toggleAllFeatures = () => {
        if (expandedFeatures.size === (report?.features.length ?? 0)) {
            setExpandedFeatures(new Set());
            setExpandedScenarios(new Set());
        } else {
            setExpandedFeatures(new Set(report?.features.map(f => f.name) ?? []));
        }
    };

    const toggleFeature = (name: string) => {
        setExpandedFeatures(prev => {
            const next = new Set(prev);
            if (next.has(name)) { next.delete(name); } else { next.add(name); }
            return next;
        });
    };

    const toggleScenario = (id: string) => {
        setExpandedScenarios(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>{t('pages.reports.loading')}</Typography>
            </Box>
        );
    }

    if (!report || report.features.length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, textAlign: 'center' }}>
                <ScienceIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    {t('pages.reports.noResults')}
                </Typography>
            </Box>
        );
    }

    const allExpanded = expandedFeatures.size === report.features.length;

    return (
        <Box>
            {/* Action bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('pages.reports.summary')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        startIcon={allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                        onClick={toggleAllFeatures}
                        variant="outlined"
                    >
                        {allExpanded ? t('pages.reports.collapseAll') : t('pages.reports.expandAll')}
                    </Button>
                    <Button size="small" startIcon={<RefreshIcon />} onClick={fetchResults} variant="outlined">
                        {t('pages.reports.refresh')}
                    </Button>
                </Box>
            </Box>

            <SummaryCards summary={report.summary} t={t} />

            {/* Features List */}
            {report.features.map((feature) => {
                // Compute feature-level summary
                const featurePassed = feature.scenarios.filter(s => s.status === 'passed').length;
                const featureFailed = feature.scenarios.filter(s => s.status === 'failed' || s.status === 'broken').length;

                return (
                    <Accordion
                        key={feature.name}
                        expanded={expandedFeatures.has(feature.name)}
                        onChange={() => toggleFeature(feature.name)}
                        sx={{
                            mb: 1,
                            '&:before': { display: 'none' },
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden'
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) }
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2 }}>
                                <Typography sx={{ fontWeight: 600, flex: 1 }}>
                                    {feature.name}
                                </Typography>
                                <Chip
                                    label={`${feature.scenarios.length} ${t('pages.reports.scenarios').toLowerCase()}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 500 }}
                                />
                                {featurePassed > 0 && (
                                    <Chip
                                        icon={<CheckCircleIcon />}
                                        label={featurePassed}
                                        size="small"
                                        sx={{ backgroundColor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main, fontWeight: 600 }}
                                    />
                                )}
                                {featureFailed > 0 && (
                                    <Chip
                                        icon={<CancelIcon />}
                                        label={featureFailed}
                                        size="small"
                                        sx={{ backgroundColor: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.main, fontWeight: 600 }}
                                    />
                                )}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            {feature.scenarios.map((scenario, sIdx) => {
                                const scenarioId = `${feature.name}::${scenario.name}::${sIdx}`;
                                return (
                                    <Accordion
                                        key={scenarioId}
                                        expanded={expandedScenarios.has(scenarioId)}
                                        onChange={() => toggleScenario(scenarioId)}
                                        disableGutters
                                        sx={{
                                            boxShadow: 'none',
                                            '&:before': { display: 'none' },
                                            borderTop: '1px solid',
                                            borderColor: 'divider'
                                        }}
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon fontSize="small" />}
                                            sx={{
                                                pl: 4,
                                                minHeight: 48,
                                                '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
                                                <Box sx={{ color: getStatusColor(scenario.status, theme), display: 'flex' }}>
                                                    {getStatusIcon(scenario.status)}
                                                </Box>
                                                <Typography sx={{ flex: 1, fontSize: '0.9rem' }}>
                                                    {scenario.name}
                                                </Typography>
                                                {scenario.tags.map((tag) => (
                                                    <Chip
                                                        key={tag}
                                                        label={tag}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                                    />
                                                ))}
                                                {scenario.duration_ms > 0 && (
                                                    <Tooltip title={t('pages.reports.duration')}>
                                                        <Chip
                                                            icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important' }} />}
                                                            label={formatDuration(scenario.duration_ms)}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                                        />
                                                    </Tooltip>
                                                )}
                                                <Chip
                                                    label={scenario.status}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem',
                                                        height: 22,
                                                        backgroundColor: alpha(getStatusColor(scenario.status, theme), 0.12),
                                                        color: getStatusColor(scenario.status, theme)
                                                    }}
                                                />
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails sx={{ pl: 4, pr: 2, pb: 2, pt: 0 }}>
                                            {scenario.steps.length > 0 ? (
                                                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                                                    <StepsTable steps={scenario.steps} />
                                                </Paper>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('pages.reports.steps')}: —
                                                </Typography>
                                            )}
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })}
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Box>
    );
};

// --- Sub-component: Allure Tab Content ---
const AllureTabContent: React.FC<{ t: any }> = ({ t }) => {
    const [reportExists, setReportExists] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const reportUrl = '/api/report/';

    const checkReport = async () => {
        setLoading(true);
        try {
            const response = await fetch(reportUrl, { method: 'HEAD' });
            setReportExists(response.ok);
        } catch {
            setReportExists(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkReport();
    }, []);

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, gap: 1 }}>
                <Button size="small" startIcon={<RefreshIcon />} onClick={checkReport} variant="outlined">
                    {t('pages.reports.refresh')}
                </Button>
                {reportExists && (
                    <Button
                        size="small"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => window.open(reportUrl, '_blank')}
                    >
                        {t('pages.reports.openNewTab')}
                    </Button>
                )}
            </Box>
            <Paper elevation={3} sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '500px', display: 'flex' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }}>{t('pages.reports.loading')}</Typography>
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
                            {t('pages.reports.noReport')}
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

// --- Main Page ---
const ReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title={t('pages.reports.title')} icon={<BarChartIcon sx={{ fontSize: 32 }} />} />
            <Box sx={{ px: 2, pt: 0 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{
                        minHeight: 36,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', minHeight: 36, py: 0.5 }
                    }}
                >
                    <Tab
                        id="tab-gherkin"
                        label={t('pages.reports.tabGherkin')}
                        icon={<ScienceIcon sx={{ fontSize: 20 }} />}
                        iconPosition="start"
                    />
                    <Tab
                        id="tab-allure"
                        label={t('pages.reports.tabAllure')}
                        icon={<BarChartIcon sx={{ fontSize: 20 }} />}
                        iconPosition="start"
                    />
                </Tabs>
            </Box>
            <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {activeTab === 0 && <GherkinTabContent t={t} />}
                {activeTab === 1 && <AllureTabContent t={t} />}
            </Box>
        </Box>
    );
};

export default ReportsPage;
