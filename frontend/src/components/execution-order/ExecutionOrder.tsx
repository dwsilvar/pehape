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
import ExecutionDetailPreview from './components/ExecutionDetailPreview';

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
    stopOnFailure: boolean;
    onStopOnFailureChange: (checked: boolean) => void;
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
        handleToggleModuleCollapse,
        selectedScenario,
        handleSelectScenario,
        setSelectedScenario
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
                stopOnFailure={props.stopOnFailure}
                onStopOnFailureChange={props.onStopOnFailureChange}
            />

            {/* Split Layout Container */}
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 1, position: 'relative', minHeight: 0 }}>

                {/* Master List (Occupies full space, scrolls internally) */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    minHeight: 0,
                    // Add buffer on the right if detail is open, to avoid covering scrollbar or content if desired
                    // but usually floating means it covers. Let's add a slight padding.
                    pr: selectedScenario ? '420px' : 0,
                    transition: 'padding-right 0.3s ease'
                }}>
                    <ExecutionOrderList
                        displayedModules={displayedModules}
                        active={active}
                        collapsedSections={props.collapsedSections}
                        onToggleModuleCollapse={handleToggleModuleCollapse}
                        onModuleColorChange={handleModuleColorChange}
                        onDeleteModule={handleDeleteModule}

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

                        missingFiles={missingFiles}
                        fontSize={props.fontSize}

                        selectedScenario={selectedScenario}
                        onSelectScenario={handleSelectScenario}
                        onSelectModule={handleSelectScenario}
                    />
                </Box>

                {/* Floating Detail Panel */}
                {selectedScenario && (
                    <Box sx={{
                        position: 'absolute',
                        right: 16,
                        top: 16,
                        bottom: 16,
                        width: 400,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: 3,
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        zIndex: 1000,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <ExecutionDetailPreview
                            selectedScenario={selectedScenario}
                            modules={props.modules}
                            missingFiles={missingFiles}
                            onAddTask={handleOpenTaskDialog}
                            onDeleteTask={handleDeleteTask}
                            onEditTask={handleOpenEditTaskDialog}
                            onTagClick={handleTagToggle}
                            onEditFeature={props.onFeatureSelect}
                            onAddHook={handleOpenHookDialog}
                            onDeleteHook={handleDeleteHook}
                            onClose={() => setSelectedScenario(null)}
                        />
                    </Box>
                )}
            </Box>

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
