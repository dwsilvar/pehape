import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip, Divider, CircularProgress, Tabs, Tab, TextField, Button, Paper, Alert } from '@mui/material';
import { Assignment as AssignmentIcon, Build as BuildIcon, Search as SearchIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';

interface TaskDef {
    name: string;
    class_name: string;
    module: string;
    scope: string;
    doc: string;
    args_schema?: Array<{
        name: string;
        label: string;
        type: string;
        default?: any;
    }>;
}

interface LiteralCheckResult {
    found: boolean;
    count: number;
    matches: { line: number; content: string }[];
}

const TasksPage: React.FC = () => {
    const [tasks, setTasks] = useState<TaskDef[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);

    // --- State for Check Literal Tool ---
    const [literalPath, setLiteralPath] = useState('');
    const [literalText, setLiteralText] = useState('');
    const [literalResult, setLiteralResult] = useState<LiteralCheckResult | null>(null);
    const [literalLoading, setLiteralLoading] = useState(false);
    const [literalError, setLiteralError] = useState<string | null>(null);

    // Helper to color-code scopes
    const getScopeColor = (scope: string) => {
        const s = scope.toLowerCase();
        if (s.includes('scenario')) return 'secondary';
        if (s.includes('step')) return 'warning';
        return 'default';
    };

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                // Add timestamp to prevent caching
                const response = await fetch(`/api/tasks?t=${Date.now()}`);
                if (!response.ok) {
                    throw new Error(`Error fetching tasks: ${response.statusText}`);
                }
                const data = await response.json();
                setTasks(data.tasks || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleCheckLiteral = async () => {
        if (!literalPath || !literalText) return;

        setLiteralLoading(true);
        setLiteralError(null);
        setLiteralResult(null);

        try {
            const response = await fetch('/api/tools/check-literal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: literalPath, literal: literalText }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error executing task');
            }

            const data = await response.json();
            setLiteralResult(data);
        } catch (err: any) {
            setLiteralError(err.message);
        } finally {
            setLiteralLoading(false);
        }
    };

    // Group tasks by module
    const tasksByModule = tasks.reduce((acc, task) => {
        if (!acc[task.module]) {
            acc[task.module] = [];
        }
        acc[task.module].push(task);
        return acc;
    }, {} as Record<string, TaskDef[]>);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Typography color="error">Error: {error}</Typography></Box>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title="Tareas y Herramientas" icon={<AssignmentIcon sx={{ fontSize: 32 }} />} showControls={false} />
            <Box sx={{ p: 4, flex: 1, overflowY: 'auto' }}>
                <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}>
                    <Tab icon={<BuildIcon />} iconPosition="start" label="Ejecutar Tareas" />
                    <Tab icon={<AssignmentIcon />} iconPosition="start" label="Documentación de Hooks" />
                </Tabs>

                {/* TAB 0: EXECUTE TASKS */}
                {tabValue === 0 && (
                    <Box>
                        <Typography variant="h6" gutterBottom color="primary">
                            Comprobar Literal en Archivo
                        </Typography>
                        <Paper elevation={2} sx={{ p: 3, maxWidth: 800 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Ruta del Archivo (ej: requirements.txt)"
                                        variant="outlined"
                                        value={literalPath}
                                        onChange={(e) => setLiteralPath(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Literal a buscar"
                                        variant="outlined"
                                        value={literalText}
                                        onChange={(e) => setLiteralText(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 2 }}>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        startIcon={literalLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                        onClick={handleCheckLiteral}
                                        disabled={literalLoading || !literalPath || !literalText}
                                    >
                                        Buscar
                                    </Button>
                                </Grid>
                            </Grid>

                            {literalError && (
                                <Alert severity="error" sx={{ mt: 2 }}>{literalError}</Alert>
                            )}

                            {literalResult && (
                                <Box sx={{ mt: 3 }}>
                                    <Alert severity={literalResult.found ? "success" : "warning"}>
                                        {literalResult.found
                                            ? `Se encontraron ${literalResult.count} coincidencias.`
                                            : "No se encontraron coincidencias."}
                                    </Alert>

                                    {literalResult.matches.length > 0 && (
                                        <Paper variant="outlined" sx={{ mt: 2, maxHeight: 300, overflow: 'auto', bgcolor: '#f5f5f5' }}>
                                            {literalResult.matches.map((match, idx) => (
                                                <Box key={idx} sx={{ p: 1, borderBottom: '1px solid #eee', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                                    <Typography component="span" color="primary" sx={{ mr: 2, fontWeight: 'bold' }}>
                                                        Línea {match.line}:
                                                    </Typography>
                                                    {match.content}
                                                </Box>
                                            ))}
                                        </Paper>
                                    )}
                                </Box>
                            )}
                        </Paper>
                    </Box>
                )}

                {/* TAB 1: HOOKS DOCS */}
                {tabValue === 1 && (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                            Referencia de tareas hooks disponibles. Agrúpalas por módulo.
                        </Typography>

                        {Object.entries(tasksByModule).map(([moduleName, moduleTasks]) => (
                            <Box key={moduleName} sx={{ mb: 6 }}>
                                <Typography variant="h5" sx={{ mb: 2, borderBottom: '1px solid #eee', pb: 1, color: 'secondary.main' }}>
                                    Módulo: {moduleName}
                                </Typography>
                                <Grid container spacing={3}>
                                    {moduleTasks.map((task) => (
                                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={task.name}>
                                            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                        <Chip
                                                            label={`@task_${task.name}`}
                                                            color="primary"
                                                            variant="filled"
                                                            sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                                                        />
                                                        {task.scope && (
                                                            <Chip
                                                                label={task.scope}
                                                                size="small"
                                                                variant="outlined"
                                                                color={getScopeColor(task.scope) as any}
                                                            />
                                                        )}
                                                    </Box>
                                                    <Typography variant="h6" component="h2" gutterBottom>
                                                        {task.class_name}
                                                    </Typography>
                                                    <Divider sx={{ my: 1.5 }} />
                                                    <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                                                        {task.doc}
                                                    </Typography>

                                                    {task.args_schema && task.args_schema.length > 0 && (
                                                        <Box sx={{ mt: 2 }}>
                                                            <Divider sx={{ mb: 1.5 }} />
                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                                Parámetros Configurables:
                                                            </Typography>
                                                            {task.args_schema.map((arg, idx) => (
                                                                <Box key={idx} sx={{ mb: 1, pl: 2, borderLeft: '3px solid', borderColor: 'primary.light' }}>
                                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>
                                                                        {arg.name}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        {arg.label} ({arg.type})
                                                                    </Typography>
                                                                    {arg.default !== undefined && (
                                                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}>
                                                                            Por defecto: {String(arg.default)}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default TasksPage;
