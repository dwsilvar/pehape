import React from 'react';
import { Box, Typography, Paper, Tooltip, IconButton, CircularProgress, alpha, useTheme } from '@mui/material';
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
    const theme = useTheme();
    const Icon = status === 'passed' ? CheckCircleIcon : (status === 'failed' ? ErrorIcon : undefined);

    // Determine timing badge
    const timingColor = task.hook === 'before' ? theme.palette.primary.main : task.hook === 'after' ? theme.palette.success.main : theme.palette.text.secondary;
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
                    width: '200px',
                    position: 'relative',
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderLeft: `4px solid ${timingColor}`,
                    pl: 1,
                    pr: 3,
                    py: 0.5,
                    backgroundColor: status === 'running' ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
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
                            backgroundColor: alpha(theme.palette.action.hover, 0.5),
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
