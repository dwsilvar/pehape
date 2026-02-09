import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FeatureItem } from '../../../types';

interface AddTaskDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isEditing: boolean;
    taskName: string;
    featureItem: FeatureItem | null;
    newTaskConfig: {
        name: string;
        scope: 'feature' | 'scenario' | 'step';
        hook: 'before' | 'after';
        scenario_name?: string;
        args: Record<string, any>;
    };
    setNewTaskConfig: React.Dispatch<React.SetStateAction<{
        name: string;
        scope: 'feature' | 'scenario' | 'step';
        hook: 'before' | 'after';
        scenario_name?: string;
        args: Record<string, any>;
    }>>;
    availableTasks: any[];
    onTaskChange: (taskName: string) => void;
}

const AddTaskDialog: React.FC<AddTaskDialogProps> = ({
    open,
    onClose,
    onConfirm,
    isEditing,
    taskName,
    featureItem,
    newTaskConfig,
    setNewTaskConfig,
    availableTasks,
    onTaskChange
}) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {isEditing
                    ? `${t('orchestrator.tasks.edit_task')}: ${taskName}`
                    : `${t('orchestrator.tasks.add_task')} ${featureItem?.feature_file}`
                }
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel id="task-select-label">Seleccionar Tarea</InputLabel>
                        <Select
                            labelId="task-select-label"
                            value={newTaskConfig.name}
                            label="Seleccionar Tarea"
                            onChange={(e) => onTaskChange(e.target.value)}
                        >
                            {availableTasks.map(task => (
                                <MenuItem key={task.name} value={task.name}>{task.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Dynamic arguments schema rendering */}
                    {newTaskConfig.name && availableTasks.find(t => t.name === newTaskConfig.name)?.args_schema?.length > 0 && (
                        <Box sx={{ border: '1px solid #eee', p: 2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.02)' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Configuración de la Tarea</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {availableTasks.find(t => t.name === newTaskConfig.name).args_schema.map((arg: any) => (
                                    <TextField
                                        key={arg.name}
                                        id={`task-arg-${arg.name}`}
                                        name={`task-arg-${arg.name}`}
                                        label={arg.label || arg.name}
                                        fullWidth
                                        size="small"
                                        multiline={arg.type === 'textarea'}
                                        rows={arg.type === 'textarea' ? 4 : 1}
                                        value={newTaskConfig.args[arg.name] ?? arg.default ?? ''}
                                        onChange={(e) => setNewTaskConfig({
                                            ...newTaskConfig,
                                            args: { ...newTaskConfig.args, [arg.name]: e.target.value }
                                        })}
                                        type={arg.type === 'number' ? 'number' : 'text'}
                                        placeholder={arg.type === 'textarea' ? 'Ingrese cada texto en una línea nueva' : ''}
                                        helperText={arg.type === 'textarea' ? 'Un texto por línea' : ''}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}

                    <FormControl fullWidth>
                        <InputLabel id="scope-select-label">Alcance (Scope)</InputLabel>
                        <Select
                            labelId="scope-select-label"
                            value={newTaskConfig.scope}
                            label="Alcance (Scope)"
                            onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scope: e.target.value as any })}
                        >
                            <MenuItem value="feature">Feature (Toda la prueba)</MenuItem>
                            <MenuItem value="scenario">Scenario (Solo un escenario)</MenuItem>
                            <MenuItem value="step">Step (Todos los pasos)</MenuItem>
                        </Select>
                    </FormControl>

                    {newTaskConfig.scope === 'scenario' && (
                        <FormControl fullWidth>
                            <InputLabel id="scenario-select-label">Seleccionar Escenario</InputLabel>
                            <Select
                                labelId="scenario-select-label"
                                value={newTaskConfig.scenario_name || ''}
                                label="Seleccionar Escenario"
                                onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scenario_name: e.target.value })}
                            >
                                {featureItem?.scenarios?.map((scenario: any) => {
                                    const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                                    return (
                                        <MenuItem key={scenarioName} value={scenarioName}>{scenarioName}</MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl fullWidth>
                        <InputLabel id="hook-select-label">Gancho (Hook)</InputLabel>
                        <Select
                            labelId="hook-select-label"
                            value={newTaskConfig.hook}
                            label="Gancho (Hook)"
                            onChange={(e) => setNewTaskConfig({ ...newTaskConfig, hook: e.target.value as any })}
                        >
                            <MenuItem value="before">Antes (Before)</MenuItem>
                            <MenuItem value="after">Después (After)</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color="primary"
                    disabled={!newTaskConfig.name || (newTaskConfig.scope === 'scenario' && !newTaskConfig.scenario_name)}
                >
                    {isEditing ? t('common.save') : t('common.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(AddTaskDialog);
