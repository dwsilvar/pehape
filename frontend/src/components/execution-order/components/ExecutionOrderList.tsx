import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Active } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Module, FeatureItem } from '../../../types';
import SortableModule from './SortableModule';
import CollapsibleSection from './CollapsibleSection';
import HookItem from './HookItem';
import ExecutionItem from '../ExecutionItem';

const MemoizedSortableModule = React.memo(SortableModule);

interface ExecutionOrderListProps {
    displayedModules: Module[];
    active: Active | null;
    collapsedSections: Set<string>;
    onToggleModuleCollapse: (moduleName: string) => void;
    onModuleColorChange: (moduleName: string, color: string) => void;
    onDeleteModule: (moduleName: string) => void;
    onToggleSectionCollapse: (moduleName: string, section: 'setup' | 'features' | 'teardown') => void;
    onOpenHookDialog: (moduleName: string, type: 'setup' | 'teardown', event?: React.MouseEvent) => void;
    onNavigateToModule: (moduleName: string) => void;
    onDeleteHook: (moduleName: string, type: 'setup' | 'teardown', index: number) => void;
    onFeatureSelect: (path: string) => void;
    onToggleFeatureActivity: (moduleName: string, feature: FeatureItem) => void;
    onDeleteFeature: (moduleName: string, feature: FeatureItem) => void;
    onMoveFeature: (moduleName: string, feature: FeatureItem, direction: 'up' | 'down') => void;
    onTagToggle: (moduleName: string, featureId: string, tag: string) => void;
    runningFeatureId: string | null;
    onAddTask: (moduleName: string, item: FeatureItem, event?: React.MouseEvent) => void;
    onDeleteTask: (moduleName: string, item: FeatureItem, index: number) => void;
    onEditTask: (moduleName: string, item: FeatureItem, task: any, index: number, event?: React.MouseEvent) => void;
    missingFiles: {
        missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
        missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
    };
    fontSize: number;
}

const DEFAULT_MODULE_COLOR = '#7e57c2';

const ExecutionOrderList: React.FC<ExecutionOrderListProps> = ({
    displayedModules,
    active,
    collapsedSections,
    onToggleModuleCollapse,
    onModuleColorChange,
    onDeleteModule,
    onToggleSectionCollapse,
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
}) => {
    const { t } = useTranslation();

    return (
        <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
            {Array.isArray(displayedModules) && displayedModules.length > 0 ? (
                <SortableContext
                    items={displayedModules.map(m => m.module_name)}
                    strategy={verticalListSortingStrategy}
                    disabled={active != null && active.data.current?.type !== 'module'}
                >
                    {displayedModules.map((module) => (
                        <MemoizedSortableModule
                            key={module.module_name}
                            module={module}
                            controls={
                                <>
                                    <Tooltip title={collapsedSections.has(`${module.module_name}::features`) ? "Mostrar contenido" : "Ocultar contenido"}>
                                        <IconButton onClick={() => onToggleModuleCollapse(module.module_name)} size="small">
                                            {collapsedSections.has(`${module.module_name}::features`) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                        </IconButton>
                                    </Tooltip>
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
                                </>
                            }
                        >
                            {module.active && (
                                <>
                                    <CollapsibleSection
                                        title={t('orchestrator.sections.setup')}
                                        count={(module.setup || []).length}
                                        isOpen={!collapsedSections.has(`${module.module_name}::setup`)}
                                        onToggle={() => onToggleSectionCollapse(module.module_name, 'setup')}
                                        onAddModule={(e) => { onOpenHookDialog(module.module_name, 'setup', e); }}
                                    >
                                        {(module.setup || []).map((hook, index) => (
                                            <HookItem
                                                key={
                                                    (typeof hook === 'object' && hook !== null && 'module_name' in hook ? hook.module_name : hook as string) + index
                                                }
                                                hook={hook}
                                                onNavigate={onNavigateToModule}
                                                onDelete={() => onDeleteHook(module.module_name, 'setup', index)} />
                                        ))}
                                    </CollapsibleSection>
                                </>
                            )}
                            <CollapsibleSection title={t('orchestrator.sections.execution')} count={module.features.length} isOpen={!collapsedSections.has(`${module.module_name}::features`)} onToggle={() => onToggleSectionCollapse(module.module_name, 'features')}>
                                {!collapsedSections.has(`${module.module_name}::features`) && (
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
                                                    onAddTask={(moduleName, item, e) => { onAddTask(moduleName, item, e); }}
                                                    onDeleteTask={onDeleteTask}
                                                    onEditTask={(moduleName, item, task, index, e) => { onEditTask(moduleName, item, task, index, e); }}
                                                    moduleName={module.module_name}
                                                    missingFiles={missingFiles}
                                                />
                                            ))}
                                    </SortableContext>
                                )}
                            </CollapsibleSection>

                            {module.active && (
                                <>
                                    <CollapsibleSection
                                        title={t('orchestrator.sections.teardown')}
                                        count={(module.teardown || []).length}
                                        isOpen={!collapsedSections.has(`${module.module_name}::teardown`)}
                                        onToggle={() => onToggleSectionCollapse(module.module_name, 'teardown')}
                                        onAddModule={(e) => { onOpenHookDialog(module.module_name, 'teardown', e); }}
                                    >
                                        {(module.teardown || []).map((hook, index) => (
                                            <HookItem
                                                key={
                                                    (typeof hook === 'object' && hook !== null && 'module_name' in hook ? hook.module_name : hook as string) + index
                                                }
                                                hook={hook}
                                                onNavigate={onNavigateToModule}
                                                onDelete={() => onDeleteHook(module.module_name, 'teardown', index)} />
                                        ))}
                                    </CollapsibleSection>
                                </>
                            )}
                        </MemoizedSortableModule>
                    ))}
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
