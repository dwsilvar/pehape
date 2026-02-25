import React, { useEffect, useState } from 'react';
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
        scope: 'feature' | 'scenario';
        hook: 'before' | 'after';
        scenario_name?: string;
        args: Record<string, any>;
    };
    setNewTaskConfig: React.Dispatch<React.SetStateAction<{
        name: string;
        scope: 'feature' | 'scenario';
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
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [open]);

    if (!open && !isVisible) return null;

    const selectedTask = availableTasks.find(t => t.name === newTaskConfig.name);
    const isScenarioLocked = !!newTaskConfig.scenario_name && !isEditing;

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal - More COMPACT */}
            <div className={`relative w-full max-w-[340px] bg-white rounded-[2rem] shadow-2xl transform transition-transform duration-300 ${open ? 'scale-100' : 'scale-95'} overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]`}>

                {/* Header - Compact */}
                <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                        {isEditing
                            ? `${t('orchestrator.tasks.edit_task')}: ${taskName}`
                            : t('orchestrator.tasks.add_task_to', { file: featureItem?.feature_file || t('orchestrator.tasks.feature') })
                        }
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content - Compact spacing space-y-4 */}
                <div className="px-6 pb-4 overflow-y-auto space-y-4">

                    {/* Select Task */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 block ml-0.5">
                            {t('orchestrator.tasks.select_task')}
                        </label>
                        <div className="relative group">
                            <select
                                value={newTaskConfig.name}
                                onChange={(e) => onTaskChange(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-700 font-sans appearance-none text-sm cursor-pointer shadow-sm"
                            >
                                <option value="">{t('orchestrator.tasks.choose_task_placeholder')}</option>
                                {availableTasks.map(task => (
                                    <option key={task.name} value={task.name}>{task.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Scope & Hook Row */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Scope Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 block ml-0.5">
                                {t('orchestrator.tasks.scope')}
                            </label>
                            <div className="relative group">
                                <select
                                    value={newTaskConfig.scope}
                                    onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scope: e.target.value as 'feature' | 'scenario' })}
                                    disabled={isScenarioLocked}
                                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-800 font-medium font-sans appearance-none text-sm shadow-sm ${isScenarioLocked ? 'opacity-70 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                                >
                                    <option value="feature">{t('orchestrator.tasks.feature')}</option>
                                    <option value="scenario">{t('orchestrator.tasks.scenario')}</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Hook Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 block ml-0.5">
                                {t('orchestrator.tasks.hook')}
                            </label>
                            <div className="relative group">
                                <select
                                    value={newTaskConfig.hook}
                                    onChange={(e) => setNewTaskConfig({ ...newTaskConfig, hook: e.target.value as 'before' | 'after' })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-800 font-medium font-sans appearance-none text-sm cursor-pointer shadow-sm"
                                >
                                    <option value="before">{t('orchestrator.tasks.before')}</option>
                                    <option value="after">{t('orchestrator.tasks.after')}</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scenario Select (Conditional) */}
                    {newTaskConfig.scope === 'scenario' && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="text-xs font-semibold text-slate-500 block ml-0.5">
                                {t('orchestrator.tasks.select_scenario')}
                            </label>
                            <div className="relative group">
                                <select
                                    value={newTaskConfig.scenario_name || ''}
                                    onChange={(e) => setNewTaskConfig({ ...newTaskConfig, scenario_name: e.target.value })}
                                    disabled={isScenarioLocked}
                                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 transition-all outline-none text-slate-700 font-sans appearance-none text-sm shadow-sm ${isScenarioLocked ? 'opacity-70 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                                >
                                    <option value="">{t('orchestrator.tasks.choose_scenario_placeholder')}</option>
                                    {featureItem?.scenarios?.map((scenario: any) => {
                                        const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                                        return (
                                            <option key={scenarioName} value={scenarioName}>{scenarioName}</option>
                                        );
                                    })}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dynamic arguments schema */}
                    {newTaskConfig.name && selectedTask?.args_schema?.length > 0 && (
                        <div className="pt-1 animate-in fade-in duration-300">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                    {t('orchestrator.tasks.configuration')}
                                </span>
                                <div className="space-y-3">
                                    {selectedTask.args_schema.map((arg: any) => (
                                        <div key={arg.name} className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600 ml-0.5">
                                                {arg.label || arg.name}
                                            </label>
                                            {arg.type === 'textarea' ? (
                                                <textarea
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-700 font-sans text-xs min-h-[70px] shadow-sm"
                                                    value={newTaskConfig.args[arg.name] ?? arg.default ?? ''}
                                                    onChange={(e) => setNewTaskConfig({
                                                        ...newTaskConfig,
                                                        args: { ...newTaskConfig.args, [arg.name]: e.target.value }
                                                    })}
                                                    placeholder={t('orchestrator.tasks.enter_text_placeholder')}
                                                />
                                            ) : (
                                                <input
                                                    type={arg.type === 'number' ? 'number' : 'text'}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-700 font-sans text-xs shadow-sm"
                                                    value={newTaskConfig.args[arg.name] ?? arg.default ?? ''}
                                                    onChange={(e) => setNewTaskConfig({
                                                        ...newTaskConfig,
                                                        args: { ...newTaskConfig.args, [arg.name]: e.target.value }
                                                    })}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions - More Compact */}
                <div className="px-6 py-4 flex justify-end gap-2.5 bg-white border-t border-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs text-slate-600 font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!newTaskConfig.name || (newTaskConfig.scope === 'scenario' && !newTaskConfig.scenario_name)}
                        className="px-4 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg shadow-md shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                    >
                        {isEditing ? t('common.save') : t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(AddTaskDialog);
