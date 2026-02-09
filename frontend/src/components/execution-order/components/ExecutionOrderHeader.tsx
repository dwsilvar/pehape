import React from 'react';
import { Box, Typography, Button, Tooltip, Chip } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Module } from '../../../types';

interface ExecutionOrderHeaderProps {
    fontSize: number;
    onOpenAddModuleDialog: (event: React.MouseEvent) => void;
    onRefresh: () => void;
    hasWarnings: boolean;
    warningMessage: string;
    isExecuting: boolean;
    onRunTests: () => void;
    onStopTests: () => void;
    modules: Module[];
    scheduledExecutionTime: Date | null;
    onOpenScheduleDialog: (event: React.MouseEvent) => void;
    onCancelSchedule: () => void;
}

const ExecutionOrderHeader: React.FC<ExecutionOrderHeaderProps> = ({
    fontSize,
    onOpenAddModuleDialog,
    onRefresh,
    hasWarnings,
    warningMessage,
    isExecuting,
    onRunTests,
    onStopTests,
    modules,
    scheduledExecutionTime,
    onOpenScheduleDialog,
    onCancelSchedule,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="subtitle1" flex={1} sx={{ fontSize: `${fontSize}px` }}>
                {t('orchestrator.title')}
            </Typography>
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={onOpenAddModuleDialog}>
                {t('modules.add_module')}
            </Button>
            <Tooltip title={t('modules.refresh')}>
                <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={onRefresh}>
                    <SyncIcon />
                </Button>
            </Tooltip>
            <Tooltip title={hasWarnings ? warningMessage : (isExecuting ? t('orchestrator.stop_tests') : t('orchestrator.run_tests'))}>
                <span>
                    <Button
                        variant="contained"
                        color={isExecuting ? "error" : "primary"}
                        size="small" sx={{ mr: 1 }}
                        onClick={isExecuting ? onStopTests : onRunTests}
                        disabled={hasWarnings || (isExecuting && (modules?.length || 0) === 0) || !!scheduledExecutionTime}
                    >
                        {isExecuting ? <StopIcon /> : <PlayArrowIcon />}
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title={hasWarnings ? warningMessage : (scheduledExecutionTime ? t('orchestrator.schedule') : t('orchestrator.schedule'))}>
                <span>
                    <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={onOpenScheduleDialog}
                        disabled={hasWarnings || isExecuting || (modules?.length || 0) === 0 || !!scheduledExecutionTime}
                    >
                        <AccessTimeIcon />
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title="Ver Último Reporte">
                <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    sx={{ mr: 1 }}
                    onClick={() => navigate('/reports')}
                >
                    <AssessmentIcon />
                </Button>
            </Tooltip>

            {scheduledExecutionTime && (
                <Chip
                    icon={<AccessTimeIcon />}
                    label={`Programado: ${scheduledExecutionTime.toLocaleString()}`}
                    onDelete={onCancelSchedule}
                    color="warning"
                    variant="outlined"
                    sx={{ ml: 1 }}
                />
            )}
        </Box>
    );
};

export default ExecutionOrderHeader;
