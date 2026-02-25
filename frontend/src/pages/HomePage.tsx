import React from 'react';
import MainLayout from '../components/MainLayout';
import { useExecutionOrder } from '../hooks/useExecutionOrder';

interface HomePageProps {
    selectedFile: string | null;
    draggedItemPath: string | null;
    activeDragId: string | null;
    setModules: any;
    modules: any;
    onSaveModules: any;
}

const HomePage: React.FC<HomePageProps> = (props) => {
    // HomePage is now just a route wrapper for the unified MainLayout
    // The state and logic have been moved to MainLayout + Context
    return (
        <MainLayout {...props} />
    );
};

export default HomePage;
