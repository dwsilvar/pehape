import React from 'react';
import MainLayout from '../components/MainLayout';

interface HomePageProps {
    selectedFile: string | null;
    draggedItemPath: string | null;
    activeDragId: string | null;
}

const HomePage: React.FC<HomePageProps> = (props) => {
    // HomePage is just a route wrapper for MainLayout
    return (
        <MainLayout {...props} />
    );
};

export default HomePage;
