import React from 'react';
import { Box, Button, Collapse } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

interface CollapsibleSectionProps {
    title: string;
    count: number;
    children: React.ReactNode;
    onAddModule?: (event?: React.MouseEvent) => void;
    isOpen: boolean;
    onToggle: () => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, count, children, onAddModule, isOpen, onToggle }) => {
    const { t } = useTranslation();
    return (
        <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Button
                    onClick={onToggle}
                    startIcon={isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: 'none', color: 'text.primary' }}
                >
                    {title} ({count})
                </Button>
                {isOpen && onAddModule && (
                    <Button onClick={onAddModule} size="small" variant="outlined" sx={{ ml: 1 }}>
                        {t('orchestrator.hooks.add_hook')}
                    </Button>
                )}
            </Box>
            <Collapse in={isOpen}>
                {count > 0 && (
                    <Box sx={{ pl: 2, pt: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
                        {children}
                    </Box>
                )}
            </Collapse>
        </Box>
    );
};

export default CollapsibleSection;
