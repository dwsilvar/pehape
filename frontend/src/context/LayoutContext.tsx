import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ScenarioStatusMap } from '../types';

type ViewMode = 'editor' | 'orchestrator';

interface LayoutContextProps {
    activeView: ViewMode;
    setActiveView: (view: ViewMode) => void;
    isConsoleOpen: boolean;
    toggleConsole: () => void;

    // Execution State
    logs: string[];
    setLogs: React.Dispatch<React.SetStateAction<string[]>>;
    scenarioStatuses: ScenarioStatusMap;
    setScenarioStatuses: React.Dispatch<React.SetStateAction<ScenarioStatusMap>>;
    isExecuting: boolean;
    setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
    runningFeatureId: string | null;
    setRunningFeatureId: React.Dispatch<React.SetStateAction<string | null>>;
    scheduledExecutionTime: Date | null;
    setScheduledExecutionTime: React.Dispatch<React.SetStateAction<Date | null>>;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState<ViewMode>('editor');
    const [isConsoleOpen, setIsConsoleOpen] = useState(true);

    // Execution State
    const [logs, setLogs] = useState<string[]>([]);
    const [scenarioStatuses, setScenarioStatuses] = useState<ScenarioStatusMap>({});
    const [isExecuting, setIsExecuting] = useState(false);
    const [runningFeatureId, setRunningFeatureId] = useState<string | null>(null);
    const [scheduledExecutionTime, setScheduledExecutionTime] = useState<Date | null>(null);

    const toggleConsole = () => setIsConsoleOpen(prev => !prev);

    return (
        <LayoutContext.Provider value={{
            activeView, setActiveView, isConsoleOpen, toggleConsole,
            logs, setLogs,
            scenarioStatuses, setScenarioStatuses,
            isExecuting, setIsExecuting,
            runningFeatureId, setRunningFeatureId,
            scheduledExecutionTime, setScheduledExecutionTime
        }}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};
