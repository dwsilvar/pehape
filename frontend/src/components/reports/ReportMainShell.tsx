import React, { useState, useEffect } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, alpha, useTheme, Button, Menu, MenuItem } from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ScienceIcon from '@mui/icons-material/Science';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';

import ReportTimelineView from './ReportTimelineView';
import ReportExecutiveView from './ReportExecutiveView';
import ReportMatrixView from './ReportMatrixView';

const ReportMainShell: React.FC = () => {
    const theme = useTheme();
    const [view, setView] = useState<'V_DASH' | 'V_TIME' | 'V_MATR'>('V_TIME');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const fetchData = () => {
        setLoading(true);
        fetch('/api/reports/orchestrator-summary')
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleExportClose = () => {
        setAnchorEl(null);
    };

    const exportToCSV = () => {
        handleExportClose();
        if (!data) return;
        const rows = [["Ciclo", "Flujo", "Escenario", "Tags", "Duracion (ms)", "Resultado"]];
        data.test_cycles?.forEach((cycle: any) => {
            cycle.test_flows?.forEach((flow: any) => {
                flow.scenarios?.forEach((sc: any) => {
                    rows.push([
                        cycle.cycle_name || cycle.cycle_id,
                        flow.flow_name ? flow.flow_name.replace(' — Default', '').replace(' - Default', '') : 'Sin Grupo',
                        sc.scenario_name,
                        (sc.tags || []).join(' '),
                        sc.duration_ms || 0,
                        sc.result_status || 'skip'
                    ]);
                });
            });
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(item => `"${item}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_pehape_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToXLSX = () => {
        handleExportClose();
        if (!data) return;
        let xml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Reporte"><Table>';
        
        const rows = [["Ciclo", "Flujo", "Escenario", "Tags", "Duracion (ms)", "Resultado"]];
        data.test_cycles?.forEach((cycle: any) => {
            cycle.test_flows?.forEach((flow: any) => {
                flow.scenarios?.forEach((sc: any) => {
                    rows.push([
                        cycle.cycle_name || cycle.cycle_id,
                        flow.flow_name ? flow.flow_name.replace(' — Default', '').replace(' - Default', '') : 'Sin Grupo',
                        sc.scenario_name,
                        (sc.tags || []).join(' '),
                        sc.duration_ms || 0,
                        (sc.result_status || 'skip').toUpperCase()
                    ]);
                });
            });
        });

        rows.forEach(row => {
            xml += '<Row>';
            row.forEach(cell => {
                xml += `<Cell><Data ss:Type="String">${(cell+'').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
            });
            xml += '</Row>';
        });

        xml += '</Table></Worksheet></Workbook>';

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `reporte_pehape_${new Date().getTime()}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        handleExportClose();
        window.print();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress />
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>Cargando resultados de ejecución...</Typography>
            </Box>
        );
    }

    if (!data || !data.test_cycles || data.test_cycles.length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ScienceIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No hay resultados de ejecución aún.
                </Typography>
                <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={fetchData} sx={{ mt: 2 }}>
                    Refrescar
                </Button>
            </Box>
        );
    }

    const formatTime = (isoString?: string) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleString();
    };

    const calculateDuration = () => {
        if (!data?.execution_start_time || !data?.execution_end_time) return '';
        const start = new Date(data.execution_start_time).getTime();
        const end = new Date(data.execution_end_time).getTime();
        const diff = Math.max(0, end - start);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return ` • Duración Total: ${mins}m ${secs}s`;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* Header / View Selector */}
            <Box className="no-print" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Centro de Resultados</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Plan: {data.name || data.plan_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Inicio: {formatTime(data.execution_start_time)} • Fin: {formatTime(data.execution_end_time)}
                        {calculateDuration()}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button 
                        variant="contained" 
                        size="small" 
                        onClick={handleExportClick}
                        endIcon={<KeyboardArrowDownIcon />}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Exportar Reporte
                    </Button>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleExportClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <MenuItem onClick={exportToPDF} sx={{ fontSize: '0.85rem' }}>
                            <PictureAsPdfRoundedIcon sx={{ fontSize: 18, mr: 1, color: theme.palette.error.main }} /> PDF (Documento)
                        </MenuItem>
                        <MenuItem onClick={exportToCSV} sx={{ fontSize: '0.85rem' }}>
                            <DescriptionRoundedIcon sx={{ fontSize: 18, mr: 1, color: theme.palette.info.main }} /> CSV (Comas)
                        </MenuItem>
                        <MenuItem onClick={exportToXLSX} sx={{ fontSize: '0.85rem' }}>
                            <TableChartRoundedIcon sx={{ fontSize: 18, mr: 1, color: theme.palette.success.main }} /> Excel (Tablas)
                        </MenuItem>
                    </Menu>

                    <Button variant="outlined" size="small" startIcon={<RefreshRoundedIcon />} onClick={fetchData}>
                        Refrescar
                    </Button>
                    <ToggleButtonGroup
                        value={view}
                        exclusive
                        onChange={(_, v) => v && setView(v)}
                        size="small"
                        sx={{
                            backgroundColor: theme.palette.mode === 'dark' ? alpha('#fff', 0.05) : alpha('#000', 0.02),
                        }}
                    >
                        <ToggleButton value="V_TIME" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>
                            <TimelineRoundedIcon sx={{ mr: 1, fontSize: 18 }} /> Timeline
                        </ToggleButton>
                        <ToggleButton value="V_DASH" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>
                            <DashboardRoundedIcon sx={{ mr: 1, fontSize: 18 }} /> Ejecutivo
                        </ToggleButton>
                        <ToggleButton value="V_MATR" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>
                            <TableViewRoundedIcon sx={{ mr: 1, fontSize: 18 }} /> Matriz
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            {/* View Container */}
            <Box className="print-container" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {view === 'V_DASH' && <Box sx={{ flex: 1, overflow: 'auto' }}><ReportExecutiveView data={data} /></Box>}
                {view === 'V_TIME' && <Box sx={{ flex: 1, overflow: 'auto' }}><ReportTimelineView data={data} /></Box>}
                {view === 'V_MATR' && <ReportMatrixView data={data} />}
            </Box>
        </Box>
    );
};

export default ReportMainShell;
