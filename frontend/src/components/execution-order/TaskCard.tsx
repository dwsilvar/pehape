import React from 'react';
import { Box, Typography, Paper, Tooltip, IconButton, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import { FeatureItem } from '../../types';

interface TaskCardProps {
    task: any; // Ideally this should be typed properly
    index: number;
    item: FeatureItem;
    moduleName: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    error?: string;
    onDelete: (moduleName: string, item: FeatureItem, taskIndex: number) => void;
    onEdit?: (moduleName: string, item: FeatureItem, task: any, index: number, event: React.MouseEvent) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    index,
    item,
    moduleName,
    status = 'pending',
    error,
    onDelete,
    onEdit
}) => {
    const Icon = status === 'passed' ? CheckCircleIcon : (status === 'failed' ? ErrorIcon : undefined);

    // Determine timing badge
    const timingColor = task.hook === 'before' ? '#1976d2' : task.hook === 'after' ? '#388e3c' : '#757575';
    const timingLabel = task.hook === 'before' ? '⏮️ BEFORE' : task.hook === 'after' ? '⏭️ AFTER' : task.hook?.toUpperCase() || 'N/A';

    // Determine scope with icon
    let scopeIcon = '📋';
    let scopeText = task.scope || 'Unknown';

    if (task.scope === 'feature' || task.scope === 'Before Feature' || task.scope === 'After Feature') {
        scopeIcon = '🎬';
        scopeText = 'Feature';
    } else if (task.scope === 'scenario' || task.scope === 'Before Scenario' || task.scope === 'After Scenario') {
        scopeIcon = '📋';
        scopeText = task.scenario_name ? `Scenario: ${task.scenario_name}` : 'Scenario';
    } else if (task.scope === 'step' || task.scope === 'Before Step' || task.scope === 'After Step') {
        scopeIcon = '📝';
        scopeText = 'Step';
    }

    return (
        <Tooltip
            title={
                <Box>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{task.name}</Typography>
                    <Typography variant="caption" display="block">Timing: {timingLabel}</Typography>
                    <Typography variant="caption" display="block">Scope: {scopeText}</Typography>
                    {error && <Typography variant="caption" display="block" color="error">Error: {error}</Typography>}
                </Box>
            }
            arrow
        >
            <Paper
                elevation={status === 'pending' ? 1 : 2}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3,
                    },
                    minWidth: '150px',
                    maxWidth: '250px',
                    position: 'relative',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: `4px solid ${timingColor}`,
                    pl: 1,
                    pr: 3, // Space for delete button
                    py: 0.5,
                    backgroundColor: status === 'running' ? '#e3f2fd' : 'background.paper',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) {
                        onEdit(moduleName, item, task, index, e);
                    }
                }}
            >
                {/* Status Icon */}
                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    {Icon ? (
                        <Icon sx={{ fontSize: '14px', color: status === 'passed' ? 'success.main' : 'error.main' }} />
                    ) : status === 'running' ? (
                        <CircularProgress size={12} />
                    ) : (
                        <span style={{ fontSize: '12px' }}>{scopeIcon}</span>
                    )}
                </Box>

                {/* Task Name */}
                <Typography
                    variant="body2"
                    noWrap
                    sx={{
                        fontSize: '0.75rem',
                        fontWeight: status === 'running' ? 'bold' : 'normal',
                        color: 'text.primary',
                    }}
                >
                    {task.name}
                </Typography>

                {/* Delete Button */}
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(moduleName, item, index);
                    }}
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        right: 2,
                        transform: 'translateY(-50%)',
                        padding: '2px',
                        opacity: 0.6,
                        '&:hover': {
                            opacity: 1,
                            backgroundColor: 'rgba(0,0,0,0.05)',
                        },
                    }}
                >
                    <DeleteIcon sx={{ fontSize: '14px' }} />
                </IconButton>
            </Paper>
        </Tooltip>
    );
};

export default React.memo(TaskCard);
