import { Box, Typography, Paper, Chip, IconButton, Tooltip, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import TaskCard from '../TaskCard';
import { FeatureItem, Module } from '../../../types';
import WarningIcon from '@mui/icons-material/Warning';
import { useLayout } from '../../../context/LayoutContext';

interface ExecutionDetailPreviewProps {
    selectedScenario: {
        moduleName: string;
        featureId?: string;
        scenarioName?: string;
    } | null;
    modules: Module[];
    missingFiles: {
        missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
        missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
    };
    onAddTask: (moduleName: string, item: FeatureItem, scenarioName?: string, event?: React.MouseEvent, hook?: 'before' | 'after') => void;
    onDeleteTask: (moduleName: string, item: FeatureItem, taskIndex: number) => void;
    onEditTask: (moduleName: string, item: FeatureItem, task: any, index: number, event: React.MouseEvent) => void;
    onTagClick: (moduleName: string, id: string, tag: string) => void;
    onEditFeature: (path: string) => void;
    onAddHook: (moduleName: string, type: 'setup' | 'teardown', event?: React.MouseEvent) => void;
    onDeleteHook: (moduleName: string, type: 'setup' | 'teardown', index: number) => void;
    onClose: () => void;
}

const ExecutionDetailPreview: React.FC<ExecutionDetailPreviewProps> = ({
    selectedScenario,
    modules,
    missingFiles,
    onAddTask,
    onDeleteTask,
    onEditTask,
    onTagClick,
    onEditFeature,
    onAddHook,
    onDeleteHook,
    onClose
}) => {
    const { t } = useTranslation();
    const { taskStatuses } = useLayout();

    if (!selectedScenario) {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F8FAFC',
                borderRadius: 2,
                border: '1px dashed #CBD5E1',
                m: 1
            }}>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                    {t('orchestrator.details_preview.empty_state', { defaultValue: 'Select a scenario to view details' })}
                </Typography>
            </Box>
        );
    }

    const module = modules.find(m => m.module_name === selectedScenario.moduleName);
    const feature = module?.features.find(f => f.id === selectedScenario.featureId);

    // If no feature is selected, it's a module detail view
    if (!selectedScenario.featureId && module) {
        return (
            <Box sx={{
                height: '100%',
                overflowY: 'auto',
                p: 2,
                backgroundColor: '#F8FAFC',
                borderRadius: 2,
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                m: 1
            }}>
                {/* Module Header */}
                <Box sx={{ borderBottom: '1px solid #E2E8F0', pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1E293B' }}>
                            {`${t('orchestrator.tasks.module', { defaultValue: 'Module' })}: ${module.module_name}`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.2, fontSize: '0.75rem' }}>
                            {t('orchestrator.details_preview.module_info', { defaultValue: 'Global configuration for all features' })}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ color: '#64748B' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Setup Hooks */}
                <Paper variant="outlined" sx={{ backgroundColor: '#F8FAFC', borderRadius: 1, p: 1.2, borderColor: '#7e57c2', borderLeftWidth: '4px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>🏗️</Typography>
                            <Typography variant="caption" sx={{ color: '#5e35b1', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('orchestrator.sections.setup')}
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={(e) => onAddHook(module.module_name, 'setup', e)}
                            sx={{
                                fontSize: '0.65rem',
                                py: 0,
                                px: 1,
                                height: '24px',
                                textTransform: 'none',
                                color: '#7e57c2',
                            }}
                        >
                            {t('orchestrator.tasks.add_hook', { defaultValue: 'add hook' })}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {(module.setup || []).length > 0 ? (
                            (module.setup || []).map((hook, index) => {
                                const hookName = typeof hook === 'object' && hook !== null && 'module_name' in hook
                                    ? (hook as any).module_name
                                    : hook as string;
                                return (
                                    <Paper
                                        key={`setup-${index}`}
                                        variant="outlined"
                                        sx={{
                                            p: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderColor: '#E2E8F0',
                                            '&:hover': { backgroundColor: '#F1F5F9' }
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{hookName}</Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onDeleteHook(module.module_name, 'setup', index); }}
                                            sx={{ color: '#64748B' }}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Paper>
                                );
                            })
                        ) : (
                            <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic' }}>
                                {t('orchestrator.details_preview.no_setup', { defaultValue: 'No setup hooks configured' })}
                            </Typography>
                        )}
                    </Box>
                </Paper>

                {/* Teardown Hooks */}
                <Paper variant="outlined" sx={{ backgroundColor: '#F8FAFC', borderRadius: 1, p: 1.2, borderColor: '#7e57c2', borderLeftWidth: '4px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>🧹</Typography>
                            <Typography variant="caption" sx={{ color: '#5e35b1', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('orchestrator.sections.teardown')}
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={(e) => onAddHook(module.module_name, 'teardown', e)}
                            sx={{
                                fontSize: '0.65rem',
                                py: 0,
                                px: 1,
                                height: '24px',
                                textTransform: 'none',
                                color: '#7e57c2',
                            }}
                        >
                            {t('orchestrator.tasks.add_hook', { defaultValue: 'add hook' })}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {(module.teardown || []).length > 0 ? (
                            (module.teardown || []).map((hook, index) => {
                                const hookName = typeof hook === 'object' && hook !== null && 'module_name' in hook
                                    ? (hook as any).module_name
                                    : hook as string;
                                return (
                                    <Paper
                                        key={`teardown-${index}`}
                                        variant="outlined"
                                        sx={{
                                            p: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderColor: '#E2E8F0',
                                            '&:hover': { backgroundColor: '#F1F5F9' }
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{hookName}</Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); onDeleteHook(module.module_name, 'teardown', index); }}
                                            sx={{ color: '#64748B' }}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Paper>
                                );
                            })
                        ) : (
                            <Typography variant="caption" sx={{ color: '#94A3B8', fontStyle: 'italic' }}>
                                {t('orchestrator.details_preview.no_teardown', { defaultValue: 'No teardown hooks configured' })}
                            </Typography>
                        )}
                    </Box>
                </Paper>
            </Box>
        );
    }

    if (!feature) return null;

    // Filter tasks for this scenario
    const uiTasks = feature.ui_tasks || [];
    const scenarioBeforeTasks = selectedScenario.scenarioName
        ? uiTasks.filter((t: any) =>
            (t.scope === 'Scenario' || t.scope === 'scenario' || t.scope === 'Before Scenario') &&
            t.hook === 'before' &&
            t.scenario_name === selectedScenario.scenarioName
        )
        : [];
    const scenarioAfterTasks = selectedScenario.scenarioName
        ? uiTasks.filter((t: any) =>
            (t.scope === 'Scenario' || t.scope === 'scenario' || t.scope === 'After Scenario') &&
            t.hook === 'after' &&
            t.scenario_name === selectedScenario.scenarioName
        )
        : [];

    const featureBeforeTasks = uiTasks.filter((t: any) =>
        (t.scope?.toLowerCase() === 'feature' || t.scope === 'Before Feature') && t.hook === 'before'
    );
    const featureAfterTasks = uiTasks.filter((t: any) =>
        (t.scope?.toLowerCase() === 'feature' || t.scope === 'After Feature') && t.hook === 'after'
    );

    const scenarioTags = selectedScenario.scenarioName
        ? (feature.scenarios?.find(s => s.name === selectedScenario.scenarioName)?.tags || [])
        : [];

    return (
        <Box sx={{
            height: '100%',
            overflowY: 'auto',
            p: 2,
            backgroundColor: '#F8FAFC',
            borderRadius: 2,
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            m: 1
        }}>
            {/* Header */}
            <Box sx={{ borderBottom: '1px solid #E2E8F0', pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1E293B' }}>
                        {selectedScenario.scenarioName
                            ? `${t('orchestrator.tasks.scenario')}: ${selectedScenario.scenarioName}`
                            : `${t('orchestrator.tasks.feature')}: ${feature.feature_file}`
                        }
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.2, fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {[feature.feature_dir, feature.feature_file].filter(Boolean).join('/')}
                    </Typography>
                    {scenarioTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                            {scenarioTags.map((tag: string) => (
                                <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    clickable
                                    color={feature.tags?.includes(tag) ? 'primary' : 'default'}
                                    onClick={() => onTagClick(selectedScenario.moduleName, feature.id, tag)}
                                    sx={{ fontSize: '0.7rem' }}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Tooltip title={t('editor.feature_editor')}>
                        <IconButton
                            onClick={() => {
                                const fullPath = [feature.feature_dir, feature.feature_file].filter(Boolean).join('/');
                                onEditFeature(fullPath);
                            }}
                            size="small"
                            sx={{ color: '#64748B' }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={onClose} size="small" sx={{ color: '#64748B' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Before Feature */}
            {!selectedScenario.scenarioName && (
                featureBeforeTasks.length > 0 ? (
                    <Paper variant="outlined" sx={{ backgroundColor: '#F8FAFC', borderRadius: 1, p: 1.2, borderColor: '#3b82f6', borderLeftWidth: '4px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>⏮️</Typography>
                                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Before Feature
                                </Typography>
                            </Box>
                            {featureBeforeTasks.length === 0 && (
                                <Button
                                    size="small"
                                    startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                                    onClick={(e) => onAddTask(selectedScenario.moduleName, feature, undefined, e, 'before')}
                                    sx={{
                                        fontSize: '0.65rem',
                                        py: 0,
                                        px: 1,
                                        height: '24px',
                                        textTransform: 'none',
                                        color: '#3b82f6',
                                    }}
                                >
                                    {t('orchestrator.tasks.add_task').toLowerCase()}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {featureBeforeTasks.map((task: any) => {
                                const actualIndex = uiTasks.indexOf(task);
                                const taskState = taskStatuses[feature.id]?.[actualIndex];
                                const isMissing = missingFiles.missing_tasks.some(mt =>
                                    mt.name === task.name && mt.feature_id === feature.id && mt.hook === 'before'
                                );

                                return (
                                    <Box key={`bf-container-${actualIndex}`}>
                                        <TaskCard
                                            task={task}
                                            index={actualIndex}
                                            item={feature}
                                            moduleName={selectedScenario.moduleName}
                                            status={(taskState?.status || 'pending') as any}
                                            error={taskState?.error}
                                            onDelete={onDeleteTask}
                                            onEdit={onEditTask}
                                        />
                                        {isMissing && (
                                            <Typography variant="caption" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontWeight: 'bold' }}>
                                                <WarningIcon sx={{ fontSize: '14px' }} />
                                                {t('orchestrator.warnings.task_not_registered', { defaultValue: 'Task not registered in backend' })}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={(e) => onAddTask(selectedScenario.moduleName, feature, undefined, e, 'before')}
                            sx={{
                                fontSize: '0.7rem',
                                borderColor: 'rgba(59, 130, 246, 0.2)',
                                color: '#3b82f6',
                                '&:hover': { borderColor: '#3b82f6' }
                            }}
                        >
                            {t('orchestrator.tasks.add_before_feature_task', { defaultValue: 'Add Before Feature Task' })}
                        </Button>
                    </Box>
                )
            )}

            {/* Before Scenario */}
            {selectedScenario.scenarioName && (
                scenarioBeforeTasks.length > 0 ? (
                    <Paper variant="outlined" sx={{ backgroundColor: '#FFF7ED', borderRadius: 1, p: 1.2, borderColor: '#fb923c', borderLeftWidth: '4px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>📋</Typography>
                                <Typography variant="caption" sx={{ color: '#9a3412', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Before Scenario
                                </Typography>
                            </Box>
                            {scenarioBeforeTasks.length === 0 && (
                                <Button
                                    size="small"
                                    startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                                    onClick={(e) => onAddTask(selectedScenario.moduleName, feature, selectedScenario.scenarioName, e, 'before')}
                                    sx={{
                                        fontSize: '0.65rem',
                                        py: 0,
                                        px: 1,
                                        height: '24px',
                                        textTransform: 'none',
                                        color: '#f97316',
                                    }}
                                >
                                    {t('orchestrator.tasks.add_task').toLowerCase()}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {scenarioBeforeTasks.map((task: any) => {
                                const actualIndex = uiTasks.indexOf(task);
                                const taskState = taskStatuses[feature.id]?.[actualIndex];
                                const isMissing = missingFiles.missing_tasks.some(mt =>
                                    mt.name === task.name && mt.feature_id === feature.id && mt.hook === 'before'
                                );

                                return (
                                    <Box key={`bs-container-${actualIndex}`}>
                                        <TaskCard
                                            task={task}
                                            index={actualIndex}
                                            item={feature}
                                            moduleName={selectedScenario.moduleName}
                                            status={(taskState?.status || 'pending') as any}
                                            error={taskState?.error}
                                            onDelete={onDeleteTask}
                                            onEdit={onEditTask}
                                        />
                                        {isMissing && (
                                            <Typography variant="caption" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontWeight: 'bold' }}>
                                                <WarningIcon sx={{ fontSize: '14px' }} />
                                                {t('orchestrator.warnings.task_not_registered', { defaultValue: 'Task not registered in backend' })}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={(e) => onAddTask(selectedScenario.moduleName, feature, selectedScenario.scenarioName, e, 'before')}
                            sx={{
                                fontSize: '0.7rem',
                                borderColor: 'rgba(249, 115, 22, 0.2)',
                                color: '#f97316',
                                '&:hover': { borderColor: '#f97316' }
                            }}
                        >
                            {t('orchestrator.tasks.add_before_scenario_task', { defaultValue: 'Add Before Scenario Task' })}
                        </Button>
                    </Box>
                )
            )}

            {/* After Scenario */}
            {selectedScenario.scenarioName && (
                scenarioAfterTasks.length > 0 ? (
                    <Paper variant="outlined" sx={{ backgroundColor: '#F0FDF4', borderRadius: 1, p: 1.2, borderColor: '#22c55e', borderLeftWidth: '4px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>📋</Typography>
                                <Typography variant="caption" sx={{ color: '#166534', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    After Scenario
                                </Typography>
                            </Box>
                            {scenarioAfterTasks.length === 0 && (
                                <Button
                                    size="small"
                                    startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                                    onClick={(e) => onAddTask(selectedScenario.moduleName, feature, selectedScenario.scenarioName, e, 'after')}
                                    sx={{
                                        fontSize: '0.65rem',
                                        py: 0,
                                        px: 1,
                                        height: '24px',
                                        textTransform: 'none',
                                        color: '#22c55e',
                                    }}
                                >
                                    {t('orchestrator.tasks.add_task').toLowerCase()}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {scenarioAfterTasks.map((task: any) => {
                                const actualIndex = uiTasks.indexOf(task);
                                const taskState = taskStatuses[feature.id]?.[actualIndex];
                                const isMissing = missingFiles.missing_tasks.some(mt =>
                                    mt.name === task.name && mt.feature_id === feature.id && mt.hook === 'after'
                                );

                                return (
                                    <Box key={`as-container-${actualIndex}`}>
                                        <TaskCard
                                            task={task}
                                            index={actualIndex}
                                            item={feature}
                                            moduleName={selectedScenario.moduleName}
                                            status={(taskState?.status || 'pending') as any}
                                            error={taskState?.error}
                                            onDelete={onDeleteTask}
                                            onEdit={onEditTask}
                                        />
                                        {isMissing && (
                                            <Typography variant="caption" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontWeight: 'bold' }}>
                                                <WarningIcon sx={{ fontSize: '14px' }} />
                                                {t('orchestrator.warnings.task_not_registered', { defaultValue: 'Task not registered in backend' })}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={(e) => onAddTask(selectedScenario.moduleName, feature, selectedScenario.scenarioName, e, 'after')}
                            sx={{
                                fontSize: '0.7rem',
                                borderColor: 'rgba(34, 197, 94, 0.2)',
                                color: '#22c55e',
                                '&:hover': { borderColor: '#22c55e' }
                            }}
                        >
                            {t('orchestrator.tasks.add_after_scenario_task', { defaultValue: 'Add After Scenario Task' })}
                        </Button>
                    </Box>
                )
            )}

            {/* After Feature */}
            {!selectedScenario.scenarioName && (
                featureAfterTasks.length > 0 ? (
                    <Paper variant="outlined" sx={{ backgroundColor: '#F0FDFA', borderRadius: 1, p: 1.2, borderColor: '#14b8a6', borderLeftWidth: '4px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>⏭️</Typography>
                                <Typography variant="caption" sx={{ color: '#134e48', fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    After Feature
                                </Typography>
                            </Box>
                            {featureAfterTasks.length === 0 && (
                                <Button
                                    size="small"
                                    startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                                    onClick={(e) => onAddTask(selectedScenario.moduleName, feature, undefined, e, 'after')}
                                    sx={{
                                        fontSize: '0.65rem',
                                        py: 0,
                                        px: 1,
                                        height: '24px',
                                        textTransform: 'none',
                                        color: '#14b8a6',
                                    }}
                                >
                                    {t('orchestrator.tasks.add_task').toLowerCase()}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {featureAfterTasks.map((task: any) => {
                                const actualIndex = uiTasks.indexOf(task);
                                const taskState = taskStatuses[feature.id]?.[actualIndex];
                                const isMissing = missingFiles.missing_tasks.some(mt =>
                                    mt.name === task.name && mt.feature_id === feature.id && mt.hook === 'after'
                                );

                                return (
                                    <Box key={`af-container-${actualIndex}`}>
                                        <TaskCard
                                            task={task}
                                            index={actualIndex}
                                            item={feature}
                                            moduleName={selectedScenario.moduleName}
                                            status={(taskState?.status || 'pending') as any}
                                            error={taskState?.error}
                                            onDelete={onDeleteTask}
                                            onEdit={onEditTask}
                                        />
                                        {isMissing && (
                                            <Typography variant="caption" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontWeight: 'bold' }}>
                                                <WarningIcon sx={{ fontSize: '14px' }} />
                                                {t('orchestrator.warnings.task_not_registered', { defaultValue: 'Task not registered in backend' })}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={(e) => onAddTask(selectedScenario.moduleName, feature, undefined, e, 'after')}
                            sx={{
                                fontSize: '0.7rem',
                                borderColor: 'rgba(20, 184, 166, 0.2)',
                                color: '#14b8a6',
                                '&:hover': { borderColor: '#14b8a6' }
                            }}
                        >
                            {t('orchestrator.tasks.add_after_feature_task', { defaultValue: 'Add After Feature Task' })}
                        </Button>
                    </Box>
                )
            )}
        </Box>
    );
};

export default ExecutionDetailPreview;
