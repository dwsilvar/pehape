import React from 'react';
import { Box } from '@mui/material';
import { useDroppable, useDndContext } from '@dnd-kit/core';

import { Module, FeatureItem } from '../../types';
import { useExecutionOrder } from './hooks/useExecutionOrder';

// Dialogs
import AddTaskDialog from './dialogs/AddTaskDialog';
import ScheduleDialog from './dialogs/ScheduleDialog';
import AddModuleDialog from './dialogs/AddModuleDialog';
import HookDialog from './dialogs/HookDialog';
import DeleteTaskConfirmationDialog from './dialogs/DeleteTaskConfirmationDialog';

// Components
import ExecutionOrderHeader from './components/ExecutionOrderHeader';
import ExecutionOrderList from './components/ExecutionOrderList';

interface ExecutionOrderProps {
    fontSize: number;
    onFeatureSelect: (path: string) => void;
    modules: Module[];
    setModules: React.Dispatch<React.SetStateAction<Module[]>>;
    isExecuting: boolean;
    runningFeatureId: string | null;
    onRunTests: () => void;
    onSaveModules: (modulesToSave?: Module[]) => void;
    collapsedSections: Set<string>;
    onToggleSectionCollapse: (sectionId: string) => void;
    navigateToModule: (moduleName: string) => void;
    onStopTests: () => void;
    onScheduleTests: (date: Date) => void;
    scheduledExecutionTime: Date | null;
    onCancelSchedule: () => void;
    validationTexts?: string[];
}

const ExecutionOrder: React.FC<ExecutionOrderProps> = (props) => {
    const {
        // State
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
        handleDeleteTask, // This one now triggers confirmation
        deleteConfirmationOpen,
        taskToDelete,
        handleConfirmDeleteTask,
        handleCancelDeleteTask,

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
        onToggleExpandHook,
        onSelectHookModule,
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
        handleToggleModuleCollapse
    } = useExecutionOrder(props);

    const { active } = useDndContext();
    const { setNodeRef: setGlobalDroppableRef } = useDroppable({
        id: 'execution-order-droppable-area',
    });

    const displayedModules = (props.modules || []).filter(m => m.active);

    return (
        <Box ref={setGlobalDroppableRef} sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1 }}>
            <ExecutionOrderHeader
                fontSize={props.fontSize}
                onOpenAddModuleDialog={handleOpenDialog}
                onRefresh={handleRefreshFeatures}
                hasWarnings={hasWarnings}
                warningMessage={warningMessage}
                isExecuting={props.isExecuting}
                onRunTests={props.onRunTests}
                onStopTests={props.onStopTests}
                modules={props.modules}
                scheduledExecutionTime={props.scheduledExecutionTime}
                onOpenScheduleDialog={handleOpenScheduleDialog}
                onCancelSchedule={props.onCancelSchedule}
            />

            <ExecutionOrderList
                displayedModules={displayedModules}
                active={active}
                collapsedSections={props.collapsedSections}
                onToggleModuleCollapse={handleToggleModuleCollapse}
                onModuleColorChange={handleModuleColorChange}
                onDeleteModule={handleDeleteModule}
                onToggleSectionCollapse={(moduleName, section) => props.onToggleSectionCollapse(`${moduleName}::${section}`)}

                onOpenHookDialog={handleOpenHookDialog}
                onNavigateToModule={props.navigateToModule}
                onDeleteHook={handleDeleteHook}
                onFeatureSelect={props.onFeatureSelect}
                onToggleFeatureActivity={(moduleName, feature) => handleToggleFeatureActivity(moduleName, feature.id)}
                onDeleteFeature={handleDeleteFeature}
                onMoveFeature={handleMoveFeature}
                onTagToggle={handleTagToggle}
                runningFeatureId={props.runningFeatureId}
                onAddTask={handleOpenTaskDialog}
                onDeleteTask={handleDeleteTask}
                onEditTask={handleOpenEditTaskDialog}
                // `useTaskManagement` exports `handleOpenEditTaskDialog`.
                // `useExecutionOrder` didn't export `handleOpenEditTaskDialog` explicitly in return?
                // Let's check `useExecutionOrder.ts`.
                // It spreads `...taskManagement`. So it should export it.
                // But in destructured variables above I didn't list it because I used handleOpenTaskDialog?
                // Actually `handleOpenEditTaskDialog` signature: (moduleName, featureItem, task, index, event)
                // ExecutionOrderList expects onEditTask with same signature.
                // I need to make sure I import/destructure it.

                missingFiles={missingFiles}
                fontSize={props.fontSize}
            />

            <ScheduleDialog
                open={scheduleDialogOpen}
                onClose={handleCloseScheduleDialog}
                scheduledTime={scheduledTime}
                setScheduledTime={setScheduledTime}
                onConfirm={handleConfirmSchedule}
            />

            <AddModuleDialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                availableModules={availableModules}
                selectedModules={selectedModules}
                onToggleSelection={handleToggleSelection}
                onConfirm={handleConfirmAddModule}
            />

            <HookDialog
                open={hookDialogOpen}
                onClose={handleCloseHookDialog}
                titleData={hookDialogData}
                availableHookModules={availableHookModules}
                selectedHookModule={selectedHookModule}
                onSelectHookModule={onSelectHookModule}
                expandedHookModule={expandedHookModule}
                onToggleExpandHook={onToggleExpandHook}
                selectedTags={selectedTags}
                onTagFilterToggle={handleTagFilterToggle}
                onConfirm={handleConfirmAddHook}
            />

            <AddTaskDialog
                open={taskDialogOpen}
                onClose={handleCloseTaskDialog}
                onConfirm={handleConfirmAddTask}
                isEditing={editingTaskIndex !== null}
                taskName={newTaskConfig.name}
                featureItem={selectedFeatureForTask?.item || null}
                newTaskConfig={newTaskConfig}
                setNewTaskConfig={setNewTaskConfig}
                availableTasks={availableTasks}
                onTaskChange={handleTaskChange}
            />

            <DeleteTaskConfirmationDialog
                open={deleteConfirmationOpen}
                onClose={handleCancelDeleteTask}
                onConfirm={handleConfirmDeleteTask}
                taskName={taskToDelete ? taskToDelete.item.ui_tasks?.[taskToDelete.taskIndex]?.name : undefined}
            />
        </Box >
    );
};

export default ExecutionOrder;
