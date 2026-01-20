import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip, Divider, CircularProgress } from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';

interface TaskDef {
    name: string;
    class_name: string;
    module: string;
    scope: string;
    doc: string;
}

const TasksPage: React.FC = () => {
    const [tasks, setTasks] = useState<TaskDef[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

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
                setTasks(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

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
        <Box sx={{ p: 4, height: '100%', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <AssignmentIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                <Typography variant="h4" component="h1">
                    Documentación de Tareas
                </Typography>
            </Box>

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
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            ))}
        </Box>
    );
};

export default TasksPage;
