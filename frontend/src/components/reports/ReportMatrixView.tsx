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

        data.test_cycles.forEach((cycle: any) => {
            cycle.test_flows?.forEach((flow: any) => {
                flow.scenarios?.forEach((sc: any) => {
                    // Try to merge with gherkin data
                    const gherkinMatch = gherkinData.find(g => g.name === sc.scenario_name);
                    
                    result.push({
                        cycleName: cycle.cycle_name || cycle.cycle_id,
                        flowName: flow.flow_name ? flow.flow_name.replace(' — Default', '').replace(' - Default', '') : 'Sin Grupo',
                        scenarioName: sc.scenario_name,
                        tags: sc.tags || [],
                        duration: sc.duration_ms || 0,
                        status: sc.result_status || 'skip',
                        steps: gherkinMatch?.steps || [],
                        gifExecutionId: gherkinMatch?.gifExecutionId || null
                    });
                });
            });
        });

        return result;
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
                            <TableCell sx={{ fontWeight: 600 }}>Duración (ms)</TableCell>
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
                                    <TableCell sx={{ fontSize: '0.8rem' }}>{row.duration}</TableCell>
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
