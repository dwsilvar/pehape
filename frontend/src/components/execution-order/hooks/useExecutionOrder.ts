import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Module, FeatureItem, HookInfo } from '../../../types';
import { useTaskManagement } from './useTaskManagement';
import { arrayMove } from '@dnd-kit/sortable';

interface UseExecutionOrderProps {
    modules: Module[];
    setModules: React.Dispatch<React.SetStateAction<Module[]>>;
    onSaveModules: (modulesToSave?: Module[]) => void;
    onScheduleTests: (date: Date) => void;
    onToggleSectionCollapse: (sectionId: string) => void;
    validationTexts?: string[];
}

export const useExecutionOrder = ({
    modules,
    setModules,
    onSaveModules,
    onScheduleTests,
    onToggleSectionCollapse,
    validationTexts = [],
}: UseExecutionOrderProps) => {
    const { t } = useTranslation();

    const handleRefreshFeatures = React.useCallback(async () => {
        try {
            const response = await fetch('/api/execution-order/refresh', {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to refresh features');
            }

            const updatedModules = await response.json();
            setModules(updatedModules);
        } catch (error) {
            console.error('Error al refrescar los features:', error);
        }
    }, [setModules]);

    // --- State y Handlers para el diálogo de "Agregar Módulo" ---
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [availableModules, setAvailableModules] = React.useState<Module[]>([]);
    const [selectedModules, setSelectedModules] = React.useState<Set<string>>(new Set());

    // --- State y Handlers para el diálogo de "Agregar Hook" ---
    const [hookDialogOpen, setHookDialogOpen] = React.useState(false);
    const [hookDialogData, setHookDialogData] = React.useState<{ targetModuleName: string; hookType: 'setup' | 'teardown' } | null>(null);
    const [availableHookModules, setAvailableHookModules] = React.useState<Module[]>([]);
    const [selectedHookModule, setSelectedHookModule] = React.useState<string>('');
    const [expandedHookModule, setExpandedHookModule] = React.useState<string | null>(null);
    const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());

    // --- Task Management Hook ---
    const taskManagement = useTaskManagement({ setModules, validationTexts });

    // --- File Validation State ---
    const [missingFiles, setMissingFiles] = React.useState<{
        missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
        missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
    }>({ missing_features: [], missing_tasks: [] });

    // Fetch validation results on mount and when modules change
    React.useEffect(() => {
        const fetchValidation = async () => {
            try {
                const response = await fetch('/api/validate-files');
                if (response.ok) {
                    const data = await response.json();
                    setMissingFiles(data);
                }
            } catch (error) {
                console.error('Error validating files:', error);
            }
        };
        fetchValidation();
    }, [modules]);

    // Check if there are any warnings
    const hasWarnings = missingFiles.missing_features.length > 0 || missingFiles.missing_tasks.length > 0;
    const warningMessage = hasWarnings ? t('orchestrator.warnings.missing_files', { defaultValue: 'There are missing files. Please resolve warnings before executing.' }) : '';

    // --- State para el diálogo de agendar ejecución ---
    const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false);
    const [scheduledTime, setScheduledTime] = React.useState('');

    // --- Detail Preview State ---
    const [selectedScenario, setSelectedScenario] = React.useState<{
        moduleName: string;
        featureId?: string;
        scenarioName?: string;
    } | null>(null);

    const handleSelectScenario = React.useCallback((moduleName: string, featureId?: string, scenarioName?: string) => {
        setSelectedScenario(prev => {
            // Toggle selection if same scenario/feature/module is clicked
            if (prev?.moduleName === moduleName && prev?.featureId === featureId && prev?.scenarioName === scenarioName) {
                return null;
            }
            return { moduleName, featureId, scenarioName };
        });
    }, []);

    const handleOpenScheduleDialog = React.useCallback((event?: React.MouseEvent) => {
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
        setScheduleDialogOpen(true);
        // Set default time to 5 minutes from now for convenience
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60 * 1000;
        const localISOTime = (new Date(now.getTime() - offsetMs + 5 * 60 * 1000)).toISOString().slice(0, 16);
        setScheduledTime(localISOTime);
    }, []);

    const handleCloseScheduleDialog = React.useCallback(() => {
        setScheduleDialogOpen(false);
    }, []);

    const handleConfirmSchedule = React.useCallback(() => {
        if (scheduledTime) {
            onScheduleTests(new Date(scheduledTime));
            handleCloseScheduleDialog();
        }
    }, [scheduledTime, onScheduleTests, handleCloseScheduleDialog]);

    const handleOpenDialog = React.useCallback((event?: React.MouseEvent) => {
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
        // Filtra los módulos que no están activos para mostrarlos en el diálogo
        const inactiveModules = modules.filter(m => !m.active);
        setAvailableModules(inactiveModules);
        setSelectedModules(new Set()); // Limpia la selección anterior
        setDialogOpen(true);
    }, [modules, setAvailableModules, setSelectedModules, setDialogOpen]);

    const handleCloseDialog = React.useCallback(() => {
        setDialogOpen(false);
    }, [setDialogOpen]);

    const handleOpenHookDialog = React.useCallback((targetModuleName: string, hookType: 'setup' | 'teardown', event?: React.MouseEvent) => {
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
        const targetModule = modules.find(m => m.module_name === targetModuleName);
        if (!targetModule) return;

        // Obtiene los nombres de todos los módulos que ya están siendo usados como hooks (setup o teardown) para este módulo padre.
        const existingHookNames = new Set([
            ...(targetModule.setup || []).map(h => typeof h === 'string' ? h : (h as Module | HookInfo).module_name), // Updated to handle HookInfo
            ...(targetModule.teardown || []).map(h => typeof h === 'string' ? h : (h as Module | HookInfo).module_name)
        ]);

        // Obtiene los módulos completos que pueden ser añadidos como hooks.
        const availableModuleNames = modules
            .filter(m =>
                m.module_name !== targetModuleName &&
                !existingHookNames.has(m.module_name) &&
                m.is_hook === true
            )
            .map(m => m.module_name);

        const availableFullModules = modules.filter(m =>
            availableModuleNames.includes(m.module_name)
        );

        setAvailableHookModules(availableFullModules);
        setHookDialogData({ targetModuleName, hookType });
        setSelectedHookModule(''); // Limpia selección anterior
        setHookDialogOpen(true);
    }, [modules, setAvailableHookModules, setHookDialogData, setSelectedHookModule, setHookDialogOpen]);

    const handleCloseHookDialog = React.useCallback(() => {
        setHookDialogOpen(false);
        setHookDialogData(null);
        setSelectedHookModule('');
        setSelectedTags(new Set()); // Limpia los tags seleccionados
        setExpandedHookModule(null); // Limpia el módulo expandido
    }, [setHookDialogOpen, setHookDialogData, setSelectedHookModule, setSelectedTags, setExpandedHookModule]);

    const handleToggleModuleActivity = React.useCallback(async (moduleName: string, currentActivity: boolean) => {
        try {
            const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/activity`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active: !currentActivity }), // Envía el estado opuesto
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to toggle module activity');
            }

            const updatedModules = await response.json();

            // Fixed in previous step: directly return and setModules if not in batch mode
            if (!dialogOpen) {
                setModules(updatedModules);
            }
            return updatedModules;
        } catch (error) {
            console.error('Error al cambiar el estado del módulo:', error);
        }
    }, [dialogOpen, setModules]);

    const handleConfirmAddModule = React.useCallback(async () => {
        const activationPromises = Array.from(selectedModules).map(moduleName =>
            handleToggleModuleActivity(moduleName, false)
        );

        const results = await Promise.all(activationPromises);

        if (results && results.length > 0) {
            const finalUpdatedModules = results[results.length - 1];
            if (finalUpdatedModules) setModules(finalUpdatedModules);
        }

        handleCloseDialog();
    }, [selectedModules, handleToggleModuleActivity, setModules, handleCloseDialog]);

    const handleToggleSelection = React.useCallback((moduleName: string) => {
        setSelectedModules(prev => {
            const newSet = new Set(prev);
            if (newSet.has(moduleName)) {
                newSet.delete(moduleName);
            } else {
                newSet.add(moduleName);
            }
            return newSet;
        });
    }, [setSelectedModules]);

    const handleConfirmAddHook = React.useCallback(async () => {
        if (!selectedHookModule || !hookDialogData) return;

        const { targetModuleName, hookType } = hookDialogData;

        // Actualiza el estado localmente
        const updatedModules = modules.map(m => {
            if (m.module_name === targetModuleName) {
                const hookToAdd: HookInfo | string = selectedTags.size > 0
                    ? { module_name: selectedHookModule, tags: Array.from(selectedTags) }
                    : selectedHookModule;

                const newHooks = [...(m[hookType] || []), hookToAdd];
                return { ...m, [hookType]: newHooks };
            }
            return m;
        });

        setModules(updatedModules);

        // Cierra el diálogo
        onSaveModules(updatedModules);
        handleCloseHookDialog();
    }, [selectedHookModule, hookDialogData, modules, selectedTags, onSaveModules, handleCloseHookDialog, setModules]);

    const handleDeleteHook = React.useCallback((targetModuleName: string, hookType: 'setup' | 'teardown', hookIndex: number) => {
        const updatedModules = modules.map(m => {
            if (m.module_name === targetModuleName) {
                const currentHooks = m[hookType] || [];
                // Filtra el hook por su índice para eliminarlo
                const newHooks = currentHooks.filter((_, index) => index !== hookIndex);
                return { ...m, [hookType]: newHooks };
            }
            return m;
        });

        setModules(updatedModules);
        onSaveModules(updatedModules);
    }, [modules, setModules, onSaveModules]);

    const handleTagFilterToggle = React.useCallback((tagToToggle: string) => {
        setSelectedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tagToToggle)) {
                newSet.delete(tagToToggle);
            } else {
                newSet.add(tagToToggle);
            }
            return newSet;
        });
    }, [setSelectedTags]);

    const handleDeleteModule = React.useCallback(async (moduleName: string) => {
        await handleToggleModuleActivity(moduleName, true);
    }, [handleToggleModuleActivity]);

    const handleDeleteFeature = React.useCallback(async (moduleName: string, featureToDelete: FeatureItem) => {
        // Actualización optimista
        const originalModules = modules;
        setModules(prev => prev.map(m =>
            m.module_name === moduleName
                ? { ...m, features: m.features.filter(f => f.id !== featureToDelete.id) }
                : m
        ));

        try {
            const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/delete`, {
                method: 'POST', // Usamos POST para poder enviar un body
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature_file: featureToDelete.feature_file,
                    feature_dir: featureToDelete.feature_dir,
                }),
            });
            if (!response.ok) setModules(originalModules);
        } catch (error) {
            console.error('Error al eliminar el feature:', error);
            setModules(originalModules);
        }
    }, [setModules]);

    const handleToggleFeatureActivity = React.useCallback(async (moduleName: string, featureId: string) => {
        let featureToToggle: FeatureItem | undefined;

        setModules(prev => {
            const module = prev.find(m => m.module_name === moduleName);
            featureToToggle = module?.features.find(f => f.id === featureId);
            if (!module || !featureToToggle) return prev;

            return prev.map(m =>
                m.module_name === moduleName
                    ? {
                        ...m,
                        features: m.features.map(f =>
                            f.id === featureId ? { ...f, active: !f.active } : f
                        ),
                    }
                    : m
            );
        });

        if (!featureToToggle) return;

        try {
            const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/activity`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature_file: featureToToggle.feature_file,
                    feature_dir: featureToToggle.feature_dir,
                    active: !featureToToggle.active,
                }),
            });

            if (!response.ok) {
                // If failed, we should ideally revert or refresh
                // For now, at least we don't crash or use stale 'modules'
            }
        } catch (error) {
            console.error('Error al cambiar la actividad del feature:', error);
        }
    }, [setModules]);

    const handleMoveFeature = React.useCallback(async (moduleName: string, featureToMove: FeatureItem, direction: 'up' | 'down') => {
        let updatedFeaturesWithOrder: FeatureItem[] = [];

        setModules(prev => {
            const module = prev.find(m => m.module_name === moduleName);
            if (!module) return prev;

            const oldIndex = module.features.findIndex(f => f.id === featureToMove.id);
            if (oldIndex === -1) return prev;

            const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1;
            if (newIndex < 0 || newIndex >= module.features.length) return prev;

            const reorderedFeatures = arrayMove(module.features, oldIndex, newIndex);
            updatedFeaturesWithOrder = reorderedFeatures.map((feature, index) => ({
                ...feature,
                order: index + 1,
            }));

            return prev.map(m =>
                m.module_name === moduleName ? { ...m, features: updatedFeaturesWithOrder } : m
            );
        });

        if (updatedFeaturesWithOrder.length === 0) return;

        try {
            const featuresToSave = updatedFeaturesWithOrder.map(({ display_tags, scenarios, color, ...rest }) => rest);

            const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featuresToSave),
            });

            if (!response.ok) {
                // Refreshing might be safer on error
                await handleRefreshFeatures();
            }
        } catch (error) {
            console.error('Error al reordenar el feature:', error);
            await handleRefreshFeatures();
        }
    }, [setModules, handleRefreshFeatures]);

    const handleTagToggle = React.useCallback(async (moduleName: string, featureId: string, tagName: string) => {
        let featureToUpdate: FeatureItem | undefined;
        let newTags: string[] | null = null;

        setModules(prev => {
            const module = prev.find(m => m.module_name === moduleName);
            featureToUpdate = module?.features.find(f => f.id === featureId);
            if (!module || !featureToUpdate) return prev;

            const currentTags = featureToUpdate.tags || [];
            newTags = currentTags.includes(tagName)
                ? currentTags.filter(t => t !== tagName)
                : [...currentTags, tagName];

            if (newTags.length === 0) newTags = null;

            return prev.map(m =>
                m.module_name === moduleName
                    ? {
                        ...m,
                        features: m.features.map(f =>
                            f.id === featureId ? { ...f, tags: newTags } : f
                        ),
                    }
                    : m
            );
        });

        if (!featureToUpdate) return;

        try {
            await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature_file: featureToUpdate.feature_file,
                    feature_dir: featureToUpdate.feature_dir,
                    tags: newTags
                }),
            });
        } catch (error) {
            console.error('Error al actualizar los tags del módulo:', error);
        }
    }, [setModules]);

    const handleModuleColorChange = React.useCallback(async (moduleName: string, newColor: string) => {
        setModules(prev =>
            prev.map(m => (m.module_name === moduleName ? { ...m, color: newColor } : m))
        );

        try {
            await fetch(`/api/modules/${encodeURIComponent(moduleName)}/color`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ color: newColor }),
            });
        } catch (error) {
            console.error('Error al actualizar el color del módulo:', error);
        }
    }, [setModules]);


    const handleToggleModuleCollapse = React.useCallback((moduleName: string) => {
        const sections: ('setup' | 'features' | 'teardown')[] = ['setup', 'features', 'teardown'];
        sections.forEach(section => {
            const sectionId = `${moduleName}::${section}`;
            onToggleSectionCollapse(sectionId);
        });
    }, [onToggleSectionCollapse]);

    return {
        // Dialog State
        dialogOpen,
        availableModules,
        selectedModules,
        hookDialogOpen,
        hookDialogData,
        availableHookModules,
        selectedHookModule,
        expandedHookModule,
        selectedTags,
        scheduleDialogOpen,
        scheduledTime,

        // Task Management
        ...taskManagement,

        // Validation
        missingFiles,
        hasWarnings,
        warningMessage,

        // Handlers
        handleOpenDialog,
        handleCloseDialog,
        handleConfirmAddModule,
        handleToggleSelection,
        handleOpenHookDialog,
        handleCloseHookDialog,
        handleConfirmAddHook,
        handleDeleteHook,
        onToggleExpandHook: React.useCallback((moduleName: string) => setExpandedHookModule(prev => prev === moduleName ? null : moduleName), [setExpandedHookModule]),
        onSelectHookModule: setSelectedHookModule,
        handleTagFilterToggle,
        setScheduledTime,
        handleOpenScheduleDialog,
        handleCloseScheduleDialog,
        handleConfirmSchedule,
        handleDeleteModule,
        handleToggleModuleActivity,
        handleDeleteFeature,
        handleToggleFeatureActivity,
        handleMoveFeature,
        handleTagToggle,
        handleModuleColorChange,
        handleRefreshFeatures,
        handleToggleModuleCollapse,
        selectedScenario,
        handleSelectScenario,
        setSelectedScenario
    };
};
