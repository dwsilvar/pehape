import { useState, useCallback } from 'react';
import { FeatureItem, Module } from '../../../types';

interface UseTaskManagementProps {
    setModules: React.Dispatch<React.SetStateAction<Module[]>>;
    validationTexts: string[];
}

export const useTaskManagement = ({ setModules, validationTexts }: UseTaskManagementProps) => {
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [availableTasks, setAvailableTasks] = useState<any[]>([]);
    const [selectedFeatureForTask, setSelectedFeatureForTask] = useState<{ moduleName: string, item: FeatureItem } | null>(null);
    const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
    const [newTaskConfig, setNewTaskConfig] = useState<{
        name: string;
        scope: 'feature' | 'scenario';
        hook: 'before' | 'after';
        scenario_name?: string;
        args: Record<string, any>;
    }>({ name: '', scope: 'feature', hook: 'before', args: {} });

    const fetchTasks = useCallback(async () => {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const data = await response.json();
                setAvailableTasks(data.tasks || []);
                return data.tasks || [];
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
        return [];
    }, []);

    const handleTaskChange = useCallback((taskName: string) => {
        const task = availableTasks.find(t => t.name === taskName);
        const initialArgs: Record<string, any> = {};
        if (task && task.args_schema) {
            task.args_schema.forEach((arg: any) => {
                if (arg.default !== undefined) {
                    initialArgs[arg.name] = arg.default;
                } else {
                    initialArgs[arg.name] = arg.type === 'number' ? 0 : '';
                }
            });
        }

        // Pre-load validation texts if task is 'verificar_texto_archivo'
        if (taskName === 'verificar_texto_archivo' && validationTexts.length > 0) {
            initialArgs['expected_texts'] = validationTexts.join('\n');
        }

        setNewTaskConfig(prev => ({ ...prev, name: taskName, args: initialArgs }));
    }, [availableTasks, validationTexts]);

    const handleOpenTaskDialog = useCallback(async (moduleName: string, item: FeatureItem, scenarioName?: string, event?: React.MouseEvent, hook?: 'before' | 'after') => {
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
        setSelectedFeatureForTask({ moduleName, item });
        setTaskDialogOpen(true);

        if (hook) {
            setNewTaskConfig(prev => ({
                ...prev,
                hook: hook
            }));
        }

        if (scenarioName) {
            setNewTaskConfig(prev => ({
                ...prev,
                scope: 'scenario',
                scenario_name: scenarioName
            }));
        }

        if (availableTasks.length === 0) {
            await fetchTasks();
        }
    }, [availableTasks.length, fetchTasks]);

    const handleOpenEditTaskDialog = useCallback(async (moduleName: string, item: FeatureItem, task: any, index: number, event?: React.MouseEvent) => {
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
        setSelectedFeatureForTask({ moduleName, item });
        setEditingTaskIndex(index);
        setTaskDialogOpen(true);

        let tasksList = availableTasks;
        if (availableTasks.length === 0) {
            tasksList = await fetchTasks();
        }

        // Populate config
        const taskDef = tasksList.find(t => t.name === task.name);
        const initialArgs = { ...task.args };

        if (taskDef && taskDef.args_schema) {
            taskDef.args_schema.forEach((arg: any) => {
                if (initialArgs[arg.name] === undefined) {
                    if (arg.default !== undefined) initialArgs[arg.name] = arg.default;
                    else initialArgs[arg.name] = arg.type === 'number' ? 0 : '';
                }
            });
        }

        setNewTaskConfig({
            name: task.name,
            scope: task.scope,
            hook: task.hook,
            scenario_name: task.scenario_name,
            args: initialArgs
        });
    }, [availableTasks, fetchTasks]);

    const handleCloseTaskDialog = useCallback(() => {
        setTaskDialogOpen(false);
        setSelectedFeatureForTask(null);
        setEditingTaskIndex(null);
        setNewTaskConfig({ name: '', scope: 'feature', hook: 'before', args: {} });
    }, []);

    const handleConfirmAddTask = useCallback(async () => {
        if (!selectedFeatureForTask || !newTaskConfig.name) return;

        try {
            const method = editingTaskIndex !== null ? 'PUT' : 'POST';
            const body: any = {
                feature_file: selectedFeatureForTask.item.feature_file,
                feature_dir: selectedFeatureForTask.item.feature_dir,
                task_config: newTaskConfig
            };
            if (editingTaskIndex !== null) {
                body.task_index = editingTaskIndex;
            }

            const response = await fetch(`/api/modules/${encodeURIComponent(selectedFeatureForTask.moduleName)}/features/tasks`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const updatedModules = await response.json();
                setModules(updatedModules);
                handleCloseTaskDialog();
            } else {
                const error = await response.json();
                alert(`Error al añadir tarea: ${error.error}`);
            }
        } catch (error) {
            console.error("Error adding task:", error);
        }
    }, [selectedFeatureForTask, newTaskConfig, editingTaskIndex, handleCloseTaskDialog, setModules]);


    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<{ moduleName: string, item: FeatureItem, taskIndex: number } | null>(null);

    const handleDeleteTask = useCallback((moduleName: string, item: FeatureItem, taskIndex: number) => {
        setTaskToDelete({ moduleName, item, taskIndex });
        setDeleteConfirmationOpen(true);
    }, []);

    const handleCancelDeleteTask = useCallback(() => {
        setDeleteConfirmationOpen(false);
        setTaskToDelete(null);
    }, []);

    const handleConfirmDeleteTask = useCallback(async () => {
        if (!taskToDelete) return;

        const { moduleName, item, taskIndex } = taskToDelete;

        try {
            const response = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/features/tasks`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature_file: item.feature_file,
                    feature_dir: item.feature_dir,
                    task_index: taskIndex
                })
            });

            if (response.ok) {
                const updatedModules = await response.json();
                setModules(updatedModules);
                handleCancelDeleteTask(); // Close dialog on success
            } else {
                const error = await response.json();
                alert(`Error al eliminar tarea: ${error.error}`);
            }
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    }, [taskToDelete, setModules, handleCancelDeleteTask]);

    return {
        taskDialogOpen,
        availableTasks,
        selectedFeatureForTask,
        editingTaskIndex,
        newTaskConfig,
        setNewTaskConfig,
        handleTaskChange,
        handleOpenTaskDialog,
        handleOpenEditTaskDialog,
        handleCloseTaskDialog,
        handleConfirmAddTask,
        handleDeleteTask,
        // Delete Confirmation exports
        deleteConfirmationOpen,
        taskToDelete,
        handleConfirmDeleteTask,
        handleCancelDeleteTask
    };
};
