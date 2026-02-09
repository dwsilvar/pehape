import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Module, HookInfo } from '../../../types';

interface HookItemProps {
    hook: Module | string | HookInfo;
    onDelete: () => void;
    onNavigate: (moduleName: string) => void;
}

const HookItem: React.FC<HookItemProps> = ({ hook, onDelete, onNavigate }) => {
    const isObject = typeof hook === 'object' && hook !== null && 'module_name' in hook;
    const moduleName = isObject ? (hook as HookInfo).module_name : hook as string;
    // Helper to safely access color if it exists (for Module type)
    const moduleColor = isObject && 'color' in hook ? (hook as Module).color : null;
    // Helper to check for tags (for HookInfo type)
    const tags = isObject && 'tags' in hook ? (hook as HookInfo).tags : [];

    return (
        <Box sx={{
            mb: 1,
            mr: 1,
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: moduleColor || 'action.selected',
            borderRadius: '4px',
            overflow: 'hidden',
        }}>
            <Box
                onClick={() => onNavigate(moduleName)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.5,
                    px: 1,
                    cursor: 'pointer',
                    '&:hover': {
                        textDecoration: 'underline',
                    },
                }}>
                <Typography
                    variant="body2"
                    sx={{ color: moduleColor ? 'white' : 'text.primary' }}
                >
                    {moduleName}
                </Typography>
                {tags && tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                        {tags.map(tag => (
                            <Chip
                                key={tag} label={tag} size="small"
                                sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.3)' }}
                            />
                        ))}
                    </Box>
                )}
            </Box>
            <IconButton onClick={onDelete} size="small" edge="end">
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    );
};

export default HookItem;
