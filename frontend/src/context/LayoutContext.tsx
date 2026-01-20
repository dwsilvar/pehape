import React, { createContext, useContext, useState, ReactNode } from 'react';

type ViewMode = 'editor' | 'orchestrator';

interface LayoutContextProps {
    activeView: ViewMode;
    setActiveView: (view: ViewMode) => void;
    isConsoleOpen: boolean;
    toggleConsole: () => void;
}

const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState<ViewMode>('editor');
    const [isConsoleOpen, setIsConsoleOpen] = useState(true);

    const toggleConsole = () => setIsConsoleOpen(prev => !prev);

    return (
        <LayoutContext.Provider value={{ activeView, setActiveView, isConsoleOpen, toggleConsole }}>
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
