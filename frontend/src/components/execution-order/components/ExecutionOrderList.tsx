import React from 'react';
import { Box, Typography, Tooltip, IconButton, Chip, alpha } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Active } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Module, FeatureItem } from '../../../types';
import SortableModule from './SortableModule';
import ExecutionItem from '../ExecutionItem';

const MemoizedSortableModule = React.memo(SortableModule);

interface ExecutionOrderListProps {
    displayedModules: Module[];
    active: Active | null;
    collapsedSections: Set<string>;
    onToggleModuleCollapse: (moduleName: string) => void;
    onModuleColorChange: (moduleName: string, color: string) => void;
    onDeleteModule: (moduleName: string) => void;
    onOpenHookDialog: (moduleName: string, type: 'setup' | 'teardown', event?: React.MouseEvent) => void;
    onNavigateToModule: (moduleName: string) => void;
    onDeleteHook: (moduleName: string, type: 'setup' | 'teardown', index: number) => void;
    onFeatureSelect: (path: string) => void;
    onToggleFeatureActivity: (moduleName: string, feature: FeatureItem) => void;
    onDeleteFeature: (moduleName: string, feature: FeatureItem) => void;
    onMoveFeature: (moduleName: string, feature: FeatureItem, direction: 'up' | 'down') => void;
    onTagToggle: (moduleName: string, featureId: string, tag: string) => void;
    runningFeatureId: string | null;
    onAddTask: (moduleName: string, item: FeatureItem, scenarioName?: string, event?: React.MouseEvent) => void;
    onDeleteTask: (moduleName: string, item: FeatureItem, index: number) => void;
    onEditTask: (moduleName: string, item: FeatureItem, task: any, index: number, event?: React.MouseEvent) => void;
    missingFiles: {
        missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
        missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
    };
    fontSize: number;

    // Selection for side panel
    selectedScenario?: { moduleName: string; featureId?: string; scenarioName?: string } | null;
    onSelectScenario?: (moduleName: string, featureId: string, scenarioName?: string) => void;
    onSelectModule?: (moduleName: string) => void;
}

const DEFAULT_MODULE_COLOR = '#7e57c2';

const ExecutionOrderList: React.FC<ExecutionOrderListProps> = ({
    displayedModules,
    active,
    collapsedSections,
    onToggleModuleCollapse,
    onModuleColorChange,
    onDeleteModule,
    onOpenHookDialog,
    onNavigateToModule,
    onDeleteHook,
    onFeatureSelect,
    onToggleFeatureActivity,
    onDeleteFeature,
    onMoveFeature,
    onTagToggle,
    runningFeatureId,
    onAddTask,
    onDeleteTask,
    onEditTask,
    missingFiles,
    fontSize,
    selectedScenario,
    onSelectScenario,
    onSelectModule,
}) => {
    const { t } = useTranslation();

    return (
        <Box sx={{ flex: 1, px: 2 }}>
            {Array.isArray(displayedModules) && displayedModules.length > 0 ? (
                <SortableContext
                    items={displayedModules.map(m => m.module_name)}
                    strategy={verticalListSortingStrategy}
                    disabled={active != null && active.data.current?.type !== 'module'}
                >
                    {displayedModules.map((module) => {
                        const isModuleCollapsed = collapsedSections.has(`${module.module_name}::features`);
                        const totalModuleScenarios = module.features.reduce((acc, f) => acc + (f.scenarios?.length || 0), 0);
                        const totalModuleTasks = module.features.reduce((acc, f) => {
                            const featureTasks = (f.ui_tasks || []).filter((t: any) =>
                                t.scope?.toLowerCase() === 'feature' || t.scope === 'Before Feature' || t.scope === 'After Feature'
                            ).length;
                            const scenarioTasks = (f.ui_tasks || []).filter((t: any) =>
                                t.scenario_name && (t.scope === 'scenario' || t.scope === 'Scenario')
                            ).length;
                            return acc + featureTasks + scenarioTasks;
                        }, 0);

                        return (
                            <MemoizedSortableModule
                                key={module.module_name}
                                module={module}
                                headerPrefix={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Tooltip title={isModuleCollapsed ? "Mostrar contenido" : "Ocultar contenido"}>
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleModuleCollapse(module.module_name);
                                                }}
                                                size="small"
                                            >
                                                {isModuleCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                }
                                headerSuffix={
                                    isModuleCollapsed && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                            <Tooltip title={`${totalModuleTasks} tareas totales en el módulo`}>
                                                <Chip
                                                    icon={<AssignmentIcon sx={{ fontSize: '12px !important' }} />}
                                                    label={`Tareas: ${totalModuleTasks}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                    sx={{
                                                        height: '20px',
                                                        fontSize: '0.65rem',
                                                        borderColor: alpha(module.color || DEFAULT_MODULE_COLOR, 0.3),
                                                        backgroundColor: alpha(module.color || DEFAULT_MODULE_COLOR, 0.05),
                                                        '& .MuiChip-label': { px: 0.8 }
                                                    }}
                                                />
                                            </Tooltip>
                                            <Tooltip title={`${totalModuleScenarios} escenarios totales en el módulo`}>
                                                <Chip
                                                    label={`Scenarios: ${totalModuleScenarios}`}
                                                    size="small"
                                                    color="secondary"
                                                    variant="outlined"
                                                    sx={{
                                                        height: '20px',
                                                        fontSize: '0.65rem',
                                                        borderColor: alpha('#A855F7', 0.3),
                                                        backgroundColor: alpha('#A855F7', 0.05),
                                                        color: '#6B21A8',
                                                        '& .MuiChip-label': { px: 0.8 }
                                                    }}
                                                />
                                            </Tooltip>
                                        </Box>
                                    )
                                }
                                controls={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Tooltip title="Cambiar color del módulo">
                                            <IconButton size="small" component="label" sx={{ mr: 1 }}>
                                                <div
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                        borderRadius: '50%',
                                                        backgroundColor: module.color || DEFAULT_MODULE_COLOR,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                />
                                                <input
                                                    type="color"
                                                    hidden
                                                    id={`module-color-${module.module_name}`}
                                                    name={`module-color-${module.module_name}`}
                                                    value={module.color || DEFAULT_MODULE_COLOR}
                                                    onChange={(e) => onModuleColorChange(module.module_name, e.target.value)}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                        <IconButton onClick={() => onDeleteModule(module.module_name)} size="small">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                }
                                onSelect={() => onSelectModule?.(module.module_name)}
                                isSelected={selectedScenario?.moduleName === module.module_name && !selectedScenario?.featureId}
                            >
                                {!isModuleCollapsed && (
                                    <Box sx={{ mt: 1 }}>
                                        <SortableContext
                                            id={module.module_name}
                                            items={module.features.map((f: FeatureItem) => f.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {[...(module.features || [])].sort((a, b) => a.order - b.order)
                                                .map((feature: FeatureItem, index: number) => (
                                                    <ExecutionItem
                                                        key={feature.id} item={feature} fontSize={fontSize}
                                                        onDoubleClick={(item) => {
                                                            const fullPath = [item.feature_dir, item.feature_file].filter(Boolean).join('/');
                                                            onFeatureSelect(fullPath);
                                                        }}
                                                        onToggleActivity={(item) => { onToggleFeatureActivity(module.module_name, item); }}
                                                        onDelete={(item) => { onDeleteFeature(module.module_name, item); }}
                                                        onMoveUp={() => onMoveFeature(module.module_name, feature, 'up')}
                                                        onMoveDown={() => onMoveFeature(module.module_name, feature, 'down')}
                                                        onTagClick={(featureId, tag) => onTagToggle(module.module_name, featureId, tag)}
                                                        isRunning={feature.id === runningFeatureId}
                                                        isFirst={index === 0}
                                                        isLast={index === module.features.length - 1}
                                                        onAddTask={(moduleName, item, scenarioName, e) => { onAddTask(moduleName, item, scenarioName, e); }}
                                                        onDeleteTask={onDeleteTask}
                                                        onEditTask={(moduleName, item, task, index, e) => { onEditTask(moduleName, item, task, index, e); }}
                                                        moduleName={module.module_name}
                                                        missingFiles={missingFiles}
                                                        selectedScenario={selectedScenario}
                                                        onSelectScenario={onSelectScenario}
                                                    />
                                                ))}
                                        </SortableContext>
                                    </Box>
                                )}
                            </MemoizedSortableModule>
                        );
                    })}
                </SortableContext>
            ) : (
                <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                    {t('orchestrator.no_modules_message', { defaultValue: 'No hay módulos en el plan de ejecución. Comience agregando un módulo o arrastrando un feature a esta área.' })}
                </Typography>
            )
            }
        </Box>
    );
};

export default ExecutionOrderList;
