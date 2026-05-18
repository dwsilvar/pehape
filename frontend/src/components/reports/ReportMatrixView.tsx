import React, { useMemo, useState, useEffect } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, useTheme, alpha, Button, Select, MenuItem, FormControl } from '@mui/material';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import StepInspectorDrawer from './StepInspectorDrawer';

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
    const theme = useTheme();
    const [gherkinData, setGherkinData] = useState<any[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<any | null>(null);
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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
        const findBestMatch = (scenarioName: string, gifStartSec: number | null): any | null => {
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
            if (available.length === 0) return null;

            if (gifStartSec === null) {
                // No timestamp info → take the first available in order
                available[0]._consumed = true;
                return available[0];
            }

            // Find the CLOSEST match by timestamp distance (no fixed window).
            // This correctly disambiguates when runs are only a few seconds apart.
            const gifStartMs = gifStartSec * 1000;
            let best = available[0];
            let bestDist = Math.abs((available[0].start_ms ?? 0) - gifStartMs);

            for (let i = 1; i < available.length; i++) {
                const dist = Math.abs((available[i].start_ms ?? 0) - gifStartMs);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = available[i];
                }
            }

            best._consumed = true;
            return best;
        };

        // ── Build rows ────────────────────────────────────────────────────────
        data.test_cycles.forEach((cycle: any) => {
            cycle.test_flows?.forEach((flow: any) => {
                flow.scenarios?.forEach((sc: any) => {
                    // Extract gifExecutionId and its seconds-timestamp from logs
                    let gifExecutionId: string | null = null;
                    let gifStartSec: number | null = null;

                    if (sc.logs) {
                        for (const line of sc.logs.split('\n')) {
                            try {
                                const ev = JSON.parse(line);
                                if (ev.type === 'scenario_status' && ev.gifExecutionId) {
                                    gifExecutionId = ev.gifExecutionId;
                                    const tsSec = parseInt(gifExecutionId.split('_')[0], 10);
                                    if (!isNaN(tsSec)) gifStartSec = tsSec;
                                    break;
                                }
                            } catch { /* not JSON */ }
                        }
                    }

                    const gherkinMatch = findBestMatch(sc.scenario_name, gifStartSec);

                    result.push({
                        id: sc.id,
                        cycleName: cycle.cycle_name || cycle.cycle_id,
                        flowName: flow.flow_name
                            ? flow.flow_name.replace(' — Default', '').replace(' - Default', '')
                            : 'Sin Grupo',
                        scenarioName: sc.scenario_name,
                        tags: sc.tags || [],
                        duration: sc.duration_ms || 0,
                        status: sc.result_status || 'skip',
                        steps: gherkinMatch?.steps || [],
                        gifExecutionId,   // from logs — always instance-specific
                    });
                });
            });
        });

        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, gherkinData]);

    const handleEvidenceChange = (event: any, executionId: string) => {
        const url = event.target.value;
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <Box sx={{ pl: 1, pr: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', maxHeight: '100%' }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Ciclo</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Flujo</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Escenario</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tags</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Duración</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Resultado</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Evidencias</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Acciones</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, idx) => {
                            const color = getStatusColor(row.status, theme);
                            return (
                                <TableRow 
                                    key={idx}
                                    sx={{
                                        '&:last-child td': { borderBottom: 0 },
                                        backgroundColor: row.status === 'fail' ? alpha('#EF4444', 0.05) : 'inherit',
                                        '&:hover': { backgroundColor: alpha(color, 0.08) }
                                    }}
                                >
                                    <TableCell sx={{ fontSize: '0.8rem' }}>{row.cycleName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem' }}>{row.flowName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', fontWeight: row.status === 'fail' ? 600 : 400 }}>{row.scenarioName}</TableCell>
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
                        })}
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
