import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, useTheme, alpha, Button, Select, MenuItem, FormControl, Typography, Tooltip } from '@mui/material';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import StepInspectorDrawer from './StepInspectorDrawer';
import { ScenarioIcon, CycleIcon, FlowIcon } from '../PehapeIcons';

interface ReportMatrixViewProps {
    data: any;
}

const getStatusColor = (status: string, theme: any) => {
    switch (status) {
        case 'pass': return '#10B981';
        case 'fail': return '#EF4444';
        case 'skip': return '#94A3B8';
        default: return theme.palette.text.secondary;
    }
};

const getTaskChipStyles = (status: 'pending' | 'running' | 'passed' | 'failed', theme: any) => {
  const isDark = theme.palette.mode === 'dark';
  
  if (status === 'running') {
    return {
      bgcolor: alpha(theme.palette.warning.main, 0.12),
      color: theme.palette.warning.main,
      border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
      animation: 'taskPulse 1.5s ease-in-out infinite',
      '@keyframes taskPulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.6 },
      },
    };
  }
  if (status === 'passed') {
    return {
      bgcolor: alpha(theme.palette.success.main, 0.12),
      color: theme.palette.success.main,
      border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
    };
  }
  if (status === 'failed') {
    return {
      bgcolor: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.main,
      border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
    };
  }
  // pending
  return {
    bgcolor: isDark ? alpha(theme.palette.text.disabled, 0.05) : alpha(theme.palette.text.disabled, 0.1),
    color: theme.palette.text.secondary,
    border: `1px solid ${alpha(theme.palette.text.disabled, 0.2)}`,
  };
};

/**
 * Convierte milisegundos a una string legible adaptada a la magnitud:
 *   < 1 000 ms   → "850 ms"
 *   < 60 000 ms  → "12.3 s"
 *   < 3 600 000  → "2m 34s"
 *   ≥ 3 600 000  → "1h 05m 12s"
 */
const formatDuration = (ms: number): string => {
    if (!ms || ms <= 0) return '—';
    if (ms < 1_000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
    const totalSec = Math.floor(ms / 1_000);
    const h = Math.floor(totalSec / 3_600);
    const m = Math.floor((totalSec % 3_600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${m}m ${String(s).padStart(2, '0')}s`;
};

const ReportMatrixView: React.FC<ReportMatrixViewProps> = ({ data }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [gherkinData, setGherkinData] = useState<any[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<any | null>(null);
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (id: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => {
        // Fetch Allure detailed data (gherkin-results)
        fetch('/api/reports/gherkin-results')
            .then(res => res.json())
            .then(json => {
                if (json && json.features) {
                    const allScenarios = json.features.flatMap((f: any) => f.scenarios || []);
                    setGherkinData(allScenarios);
                }
            })
            .catch(err => console.error("Error fetching gherkin results:", err));
    }, []);

    const rows = useMemo(() => {
        const result: any[] = [];
        if (!data || !data.test_cycles) return result;

        // ── Build candidate pool ──────────────────────────────────────────────
        // Group gherkin results by scenario name. The API returns them sorted
        // by start_ms (ascending), so the pool order matches execution order.
        // Each entry gets a mutable `_consumed` flag so we can mark it as "used"
        // and prevent the same Allure result from being assigned to two plan rows.
        //
        // We intentionally do a fuzzy name key (normalised lowercase) so that
        // minor differences in whitespace/punctuation don't prevent matching.
        const pool = new Map<string, Array<any & { _consumed: boolean }>>();
        for (const g of gherkinData) {
            const key = (g.name ?? '').toLowerCase().trim();
            if (!pool.has(key)) pool.set(key, []);
            pool.get(key)!.push({ ...g, _consumed: false });
        }

        // Helper: find the best (closest in time) non-consumed candidate for a
        // given scenario name and optional gif-timestamp.
        const findBestMatch = (scenarioName: string, gifStartSec: number | null, resultStatus: string): any | null => {
            const nameKey = scenarioName.toLowerCase().trim();

            // Try exact name match first, then partial-match fallback.
            let candidates = pool.get(nameKey) ?? null;
            if (!candidates) {
                // Partial match: find any pool key that contains / is contained by scenarioName
                for (const [k, v] of pool) {
                    if (k.includes(nameKey) || nameKey.includes(k)) {
                        candidates = v;
                        break;
                    }
                }
            }
            if (!candidates || candidates.length === 0) return null;

            const available = candidates.filter(c => !c._consumed);
            
            // If none are available (all consumed), just return the first one as a fallback 
            // so we can at least show the steps in the UI, but we can't consume it.
            if (available.length === 0) {
                return candidates[0];
            }

            // If the orchestrator skipped this scenario (e.g. fail-fast, disabled),
            // it didn't actually run behave for it. We return null so we don't
            // show steps for a skipped scenario.
            if (resultStatus === 'skip') {
                return null;
            }

            // --- For executed scenarios (pass/fail), we must find and consume the best match ---
            
            // Filter by expected status roughly (pass -> passed, fail -> failed/broken)
            const allureStatus = resultStatus === 'pass' ? 'passed' :
                                 resultStatus === 'fail' ? ['failed', 'broken'] : null;
            
            let poolToSearch = available;
            if (allureStatus) {
                const statusMatched = available.filter(c => {
                    if (Array.isArray(allureStatus)) return allureStatus.includes(c.status);
                    return c.status === allureStatus;
                });
                if (statusMatched.length > 0) poolToSearch = statusMatched;
            }

            if (gifStartSec === null) {
                // No timestamp info → take the first available in order
                poolToSearch[0]._consumed = true;
                return poolToSearch[0];
            }

            // Find the CLOSEST match by timestamp distance (no fixed window).
            // This correctly disambiguates when runs are only a few seconds apart.
            const gifStartMs = gifStartSec * 1000;
            let best = poolToSearch[0];
            let bestDist = Math.abs((poolToSearch[0].start_ms ?? 0) - gifStartMs);

            for (let i = 1; i < poolToSearch.length; i++) {
                const dist = Math.abs((poolToSearch[i].start_ms ?? 0) - gifStartMs);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = poolToSearch[i];
                }
            }

            best._consumed = true;
            return best;
        };

        // ── Build rows ────────────────────────────────────────────────────────
        data.test_cycles.forEach((cycle: any) => {
            cycle.test_flows?.forEach((flow: any) => {
                flow.scenarios?.forEach((sc: any, idx: number) => {
                    // Extract gifExecutionId and its seconds-timestamp from logs, and parse task statuses
                    let gifExecutionId: string | null = null;
                    let gifStartSec: number | null = null;
                    const taskStatuses = new Map<string, 'pending' | 'running' | 'passed' | 'failed'>();

                    if (sc.logs) {
                        for (const line of sc.logs.split('\n')) {
                            try {
                                let cleanLine = line.trim();
                                if (cleanLine.startsWith('│')) {
                                    cleanLine = cleanLine.substring(1).trim();
                                }
                                const ev = JSON.parse(cleanLine);
                                if (ev.type === 'scenario_status' && ev.gifExecutionId) {
                                    gifExecutionId = String(ev.gifExecutionId);
                                    const tsSec = parseInt(gifExecutionId.split('_')[0], 10);
                                    if (!isNaN(tsSec)) gifStartSec = tsSec;
                                } else if (ev.type === 'task_status' && ev.task?.id) {
                                    taskStatuses.set(ev.task.id, ev.task.status);
                                }
                            } catch { /* not JSON */ }
                        }
                    }

                    const resolvedTasks = (sc.tasks || []).map((t: any) => {
                        const status = taskStatuses.get(t.id) || 'pending';
                        return {
                            ...t,
                            status
                        };
                    });

                    const gherkinMatch = findBestMatch(sc.scenario_name, gifStartSec, sc.result_status || 'skip');
                    const isFlow = sc.source_type === 'flow';
                    const hasDetail = sc.set_detail && sc.set_detail !== '—';
                    const matrixMatch = flow.flow_name?.match(/\(((?:Matriz|Caso|Case) \d+)\)/);
                    
                    let matrixSuffix = '';
                    let groupTitle = flow.flow_name;
                    
                    if (matrixMatch) {
                        const matchText = matrixMatch[1];
                        const numberPart = matchText.split(' ').pop();
                        const translatedCase = t('common.case') || 'case';
                        const capitalizedCase = translatedCase.charAt(0).toUpperCase() + translatedCase.slice(1);
                        const translatedText = `${capitalizedCase} ${numberPart}`;
                        matrixSuffix = ` (${translatedText})`;
                        groupTitle = translatedText;
                    }
                    
                    let translatedFlowName = flow.flow_name;
                    if (translatedFlowName) {
                        translatedFlowName = translatedFlowName.replace(/\(((?:Matriz|Caso|Case) \d+)\)/g, (match: string, p1: string) => {
                            const numberPart = p1.split(' ').pop();
                            const translatedCase = t('common.case') || 'case';
                            const capitalizedCase = translatedCase.charAt(0).toUpperCase() + translatedCase.slice(1);
                            return `(${capitalizedCase} ${numberPart})`;
                        });
                    }

                    let finalFlowName = translatedFlowName;
                    if (isFlow) {
                        finalFlowName = hasDetail ? sc.set_detail : translatedFlowName;
                    } else if (sc.source_type === 'feature') {
                        finalFlowName = `${sc.set_detail}${matrixSuffix}`;
                    }

                    const groupTitleVal = (sc.set_name && sc.set_name !== '—' && matrixMatch) 
                        ? groupTitle 
                        : translatedFlowName;

                    result.push({
                        id: sc.id || `${cycle.cycle_id}-${sc.scenario_name}-${idx}`,
                        cycleName: cycle.cycle_name || cycle.cycle_id,
                        setName: sc.set_name || '—',
                        flowName: finalFlowName,
                        scenarioName: sc.scenario_name,
                        tags: sc.tags || [],
                        duration: sc.duration_ms || 0,
                        status: sc.result_status || 'skip',
                        steps: gherkinMatch?.steps || [],
                        gifExecutionId,
                        tasks: resolvedTasks,
                        
                        parentGroupId: sc.set_name && sc.set_name !== '—' ? `set-${cycle.cycle_id}-${sc.set_name}` : undefined,
                        parentGroupName: sc.set_name && sc.set_name !== '—' ? sc.set_name : undefined,
                        groupId: `flow-${cycle.cycle_id}-${sc.set_name}-${flow.flow_name}`,
                        groupName: groupTitleVal,
                        sourceName: (sc.set_detail && sc.set_detail !== '—') ? sc.set_detail : translatedFlowName,
                    });
                });
            });
        });

        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, gherkinData, t]);

    const handleEvidenceChange = (event: any, executionId: string) => {
        const url = event.target.value;
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <Box sx={{ pl: 1, pr: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', mb: '5px' }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <CycleIcon size={14} color={theme.palette.text.secondary} />
                                    Test Cycle
                                </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <LibraryBooksRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    Test Set
                                </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <FlowIcon size={14} color={theme.palette.text.secondary} />
                                    Test Flow
                                </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <ScenarioIcon size={14} color={theme.palette.text.secondary} />
                                    Scenario
                                </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tags</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Duración</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Resultado</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Evidencias</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(() => {
                            let currentSetId: string | null = null;
                            let currentGroupId: string | null = null;
                            const renderedRows: React.ReactNode[] = [];
                            
                            const customStyles = (theme.palette as any).custom || {};
                            const tableRowGroupBg = customStyles.tableRowGroupBg || alpha(theme.palette.primary.main, 0.04);
                            const borderStyle = `${customStyles.borderWidth || '1px'} solid ${customStyles.border || theme.palette.divider}`;
                            
                            rows.forEach((row, idx) => {
                                const isFirstOfSet = row.parentGroupId && row.parentGroupId !== currentSetId;
                                if (isFirstOfSet) {
                                    currentSetId = row.parentGroupId;
                                } else if (!row.parentGroupId && currentSetId !== null) {
                                    currentSetId = null;
                                }

                                const isSetCollapsed = row.parentGroupId ? collapsedGroups.has(row.parentGroupId) : false;
                                
                                if (isSetCollapsed && !isFirstOfSet) {
                                    currentGroupId = row.groupId;
                                    return;
                                }

                                if (row.groupId !== currentGroupId) {
                                    currentGroupId = row.groupId;
                                    const isCollapsed = collapsedGroups.has(row.groupId);
                                    
                                    const groupScenarios = (isSetCollapsed && row.parentGroupId)
                                        ? rows.filter(r => r.parentGroupId === row.parentGroupId)
                                        : rows.filter(r => r.groupId === row.groupId);
                                    
                                    const groupStatuses = groupScenarios.map(r => r.status);
                                    let groupStatus = 'skip';
                                    if (groupStatuses.some(s => s === 'fail')) groupStatus = 'fail';
                                    else if (groupStatuses.every(s => s === 'pass' || s === 'skip') && groupStatuses.some(s => s === 'pass')) groupStatus = 'pass';
                                    else if (groupStatuses.every(s => s === 'skip')) groupStatus = 'skip';
                                    
                                    const totalDuration = groupScenarios.reduce((acc, r) => acc + r.duration, 0);
                                    const statusColor = getStatusColor(groupStatus, theme);
                                    
                                    renderedRows.push(
                                        <TableRow key={`group-${row.groupId}`} sx={{ bgcolor: tableRowGroupBg }}>
                                            <TableCell sx={{ py: 1.5, fontWeight: 800, color: 'text.primary', fontSize: '0.8rem', borderBottom: borderStyle }}>
                                                {row.parentGroupId ? (isFirstOfSet ? row.cycleName : '') : row.cycleName}
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, fontWeight: 800, color: 'text.primary', fontSize: '0.8rem', borderBottom: borderStyle }}>
                                                {isFirstOfSet ? (
                                                    <Box 
                                                        onClick={() => toggleGroup(row.parentGroupId!)} 
                                                        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', gap: 0.5 }}
                                                    >
                                                        {isSetCollapsed ? <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />}
                                                        <LibraryBooksRoundedIcon sx={{ fontSize: 14, color: 'text.primary' }} />
                                                        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem' }}>
                                                            {row.parentGroupName}
                                                        </Typography>
                                                    </Box>
                                                ) : (row.parentGroupId ? '' : '—')}
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}>
                                                {!isSetCollapsed && (
                                                    <Box 
                                                        onClick={() => toggleGroup(row.groupId)} 
                                                        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', gap: 0.5 }}
                                                    >
                                                        {isCollapsed ? <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'text.primary' }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'text.primary' }} />}
                                                        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'text.primary' }}>
                                                            {row.groupName}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}>
                                                <Chip label={`${groupScenarios.length} scenarios`} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(theme.palette.text.secondary, 0.1), fontWeight: 800 }} />
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}></TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}>
                                                {totalDuration > 0 && <Chip label={formatDuration(totalDuration)} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(theme.palette.text.secondary, 0.1), fontWeight: 800 }} />}
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}>
                                                <Chip label={groupStatus.toUpperCase()} size="small" sx={{ height: 16, fontSize: '0.6rem', color: statusColor, bgcolor: alpha(statusColor, 0.1), border: `1px solid ${alpha(statusColor, 0.3)}`, fontWeight: 800 }} />
                                            </TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}></TableCell>
                                            <TableCell sx={{ py: 1.5, borderBottom: borderStyle }}></TableCell>
                                        </TableRow>
                                    );
                                }
                                
                                if (collapsedGroups.has(row.groupId) || isSetCollapsed) {
                                    return;
                                }

                                const color = getStatusColor(row.status, theme);
                                renderedRows.push(
                                    <TableRow 
                                        key={`row-${row.id}-${idx}`}
                                        sx={{
                                            '&:last-child td': { borderBottom: 0 },
                                            backgroundColor: row.status === 'fail' ? alpha('#EF4444', 0.05) : 'inherit',
                                            '&:hover': { backgroundColor: alpha(color, 0.08) }
                                        }}
                                    >
                                        <TableCell sx={{ borderLeft: `2px solid ${row.status === 'fail' ? theme.palette.error.main : 'transparent'}` }}></TableCell>
                                        <TableCell></TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                            {row.sourceName}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem' }}>
                                            <Box sx={{ fontWeight: row.status === 'fail' ? 600 : 400 }}>
                                                {row.scenarioName}
                                            </Box>
                                            {row.tasks && row.tasks.length > 0 && (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                                    {row.tasks.map((task: any) => (
                                                        <Tooltip
                                                            key={task.id}
                                                            title={
                                                                <Box sx={{ p: 0.5 }}>
                                                                    <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                                                                        Tarea: @{task.name}
                                                                    </Typography>
                                                                    <Typography variant="caption" display="block">
                                                                        Momento: {task.hook.toUpperCase()}
                                                                    </Typography>
                                                                    <Typography variant="caption" display="block">
                                                                        Alcance: {task.scope.toUpperCase()}
                                                                    </Typography>
                                                                    {task.args && Object.keys(task.args).length > 0 && (
                                                                        <Typography variant="caption" display="block">
                                                                            Parámetros: {JSON.stringify(task.args)}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            }
                                                            arrow
                                                            placement="top"
                                                        >
                                                            <Chip
                                                                size="small"
                                                                icon={<SettingsIcon sx={{ fontSize: '10px !important' }} />}
                                                                label={`@${task.name}`}
                                                                sx={{
                                                                    height: 18,
                                                                    fontSize: '0.62rem',
                                                                    fontWeight: 600,
                                                                    borderRadius: '4px',
                                                                    cursor: 'help',
                                                                    ...getTaskChipStyles(task.status, theme)
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    ))}
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {row.tags.map((t: string) => (
                                                    <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                            <Box
                                                title={row.duration > 0 ? `${row.duration.toLocaleString()} ms` : ''}
                                                component="span"
                                                sx={{ cursor: row.duration > 0 ? 'help' : 'default' }}
                                            >
                                                {formatDuration(row.duration)}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={row.status.toUpperCase()} 
                                                size="small" 
                                                sx={{ 
                                                    fontSize: '0.65rem', 
                                                    height: 20, 
                                                    fontWeight: 700,
                                                    backgroundColor: alpha(color, 0.15),
                                                    color: color
                                                }} 
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                                <Select
                                                    value=""
                                                    displayEmpty
                                                    onChange={(e) => handleEvidenceChange(e, row.gifExecutionId)}
                                                    disabled={!row.gifExecutionId}
                                                    sx={{ fontSize: '0.75rem', height: 28 }}
                                                    renderValue={() => "Seleccionar..."}
                                                >
                                                    {row.gifExecutionId && [
                                                        <MenuItem key="gif" value={`/api/execution/${row.gifExecutionId}/gif`} sx={{ fontSize: '0.75rem' }}>
                                                            Ver GIF Interactivo
                                                        </MenuItem>,
                                                        <MenuItem key="video" value={`/api/execution/${row.gifExecutionId}/video`} sx={{ fontSize: '0.75rem' }}>
                                                            Ver Video MP4
                                                        </MenuItem>
                                                    ]}
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                        <TableCell>
                                            <Button 
                                                variant="outlined" 
                                                size="small" 
                                                startIcon={<ListAltRoundedIcon />}
                                                disabled={row.status === 'skip' || !row.steps || row.steps.length === 0}
                                                onClick={() => {
                                                    setSelectedScenario(row);
                                                    setIsInspectorOpen(true);
                                                }}
                                                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                                            >
                                                Ver Steps
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            });
                            return renderedRows;
                        })()}
                    </TableBody>
                </Table>
            </TableContainer>

            <StepInspectorDrawer 
                scenario={selectedScenario} 
                isOpen={isInspectorOpen} 
                onClose={() => setIsInspectorOpen(false)} 
            />
        </Box>
    );
};

export default ReportMatrixView;
