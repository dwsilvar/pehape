import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    IconButton,
    Paper,
    Tooltip,
    Chip,
    CircularProgress,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FeatureItem } from '../../types';
import TaskCard from './TaskCard';
import { useLayout } from '../../context/LayoutContext';

const DEFAULT_FEATURE_COLOR = '#4db6ac';

interface ExecutionItemProps {
    item: FeatureItem;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    fontSize: number;
    onDoubleClick: (item: FeatureItem) => void;
    onToggleActivity: (item: FeatureItem) => void;
    onDelete: (item: FeatureItem) => void;
    onTagClick: (featureId: string, tag: string) => void;
    isRunning: boolean;
    isFirst: boolean;
    isLast: boolean;
    onAddTask: (moduleName: string, item: FeatureItem, event?: React.MouseEvent) => void;
    onDeleteTask: (moduleName: string, item: FeatureItem, taskIndex: number) => void;
    onEditTask?: (moduleName: string, item: FeatureItem, task: any, index: number, event?: React.MouseEvent) => void;
    moduleName: string;
    missingFiles: {
        missing_features: Array<{ id: string, path: string, module: string, feature_file: string, feature_dir: string }>;
        missing_tasks: Array<{ name: string, feature_id: string, hook: string }>;
    };
}

const ExecutionItem: React.FC<ExecutionItemProps> = ({
    item,
    onMoveUp,
    onMoveDown,
    fontSize,
    onDoubleClick,
    onToggleActivity,
    onDelete,
    onTagClick,
    isRunning,
    isFirst,
    isLast,
    onAddTask,
    onDeleteTask,
    onEditTask,
    moduleName,
    missingFiles,
}) => {
    const { t } = useTranslation();
    const { scenarioStatuses, taskStatuses, scenarioGifs } = useLayout();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
        data: { type: 'feature' }, // Identificamos este elemento como una 'feature'
        disabled: !item.active, // Deshabilita el arrastre si el feature está inactivo
    });

    const [contextMenu, setContextMenu] = React.useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!item.active) return; // No mostrar menú contextual si está inactivo
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                    mouseX: event.clientX + 2,
                    mouseY: event.clientY - 6,
                }
                : null,
        );
    };

    const handleOpenMenu = (event: React.MouseEvent) => {
        event.stopPropagation();
        setContextMenu({
            mouseX: event.clientX,
            mouseY: event.clientY,
        });
    };

    const handleClose = () => {
        setContextMenu(null);
    };

    const handleOpenInEditor = () => {
        onDoubleClick(item); // Reutiliza la lógica existente para abrir el editor
        handleClose();
    };

    const handleToggle = () => {
        onToggleActivity(item);
        handleClose();
    };

    const handleDelete = () => {
        onDelete(item);
        handleClose();
    };

    const handleAddTask = () => {
        onAddTask(moduleName, item);
        handleClose();
    };
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };


    return (
        <>
            <Paper
                ref={setNodeRef}
                style={style}
                elevation={isDragging ? 6 : 4} // Sombra para destacar que es un elemento individual
                onDoubleClick={() => item.active && onDoubleClick(item)}
                onContextMenu={handleContextMenu}
                sx={{
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: isDragging ? 0.5 : (item.active ? 1 : 0.6),
                    backgroundColor: item.active ? 'background.default' : 'action.disabledBackground',
                    position: 'relative',
                    // Estilo condicional para resaltar el feature en ejecución
                    border: isRunning ? '2px solid' : 'none',
                    borderColor: isRunning ? 'primary.main' : 'transparent',
                    pl: '30px', // Padding izquierdo para dejar espacio al handle
                    py: 1, // Padding vertical
                    pr: 1, // Padding derecho
                }}
            >
                {/* Handle de arrastre a la izquierda, similar al de los módulos */}
                <Box
                    {...attributes}
                    {...listeners}
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '30px',
                        cursor: item.active ? 'grab' : 'not-allowed',
                        backgroundColor: item.color || DEFAULT_FEATURE_COLOR,
                        borderTopLeftRadius: (theme) => theme.shape.borderRadius,
                        borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                    }}
                >
                    <DragIndicatorIcon fontSize="small" />
                </Box>
                {/* Contenido del feature */}
                <Box sx={{ flexGrow: 1, ml: 1, cursor: item.active ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 1 }}>

                    {/* SECCIÓN 1: CABECERA Y CONTROLES */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{
                                fontSize: `${fontSize}px`,
                                fontWeight: 'bold',
                                textDecoration: item.active ? 'none' : 'line-through',
                                color: item.active ? 'text.primary' : 'text.disabled'
                            }}>
                                {`${item.order}. ${item.feature_file}`}
                            </Typography>
                            {/* Warning icon if feature file is missing */}
                            {missingFiles.missing_features.some(mf => mf.id === item.id) && (
                                <Tooltip title={`File not found: ${missingFiles.missing_features.find(mf => mf.id === item.id)?.path}`} arrow>
                                    <WarningIcon fontSize="small" sx={{ color: 'error.main' }} />
                                </Tooltip>
                            )}
                            {/* Warning icon if any task is missing */}
                            {item.ui_tasks && item.ui_tasks.some((task: any) =>
                                missingFiles.missing_tasks.some(mt => mt.name === task.name && mt.feature_id === item.id)
                            ) && (
                                    <Tooltip title="One or more tasks not found" arrow>
                                        <WarningIcon fontSize="small" sx={{ color: 'warning.main' }} />
                                    </Tooltip>
                                )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title="Subir">
                                <span>
                                    <IconButton edge="end" onClick={onMoveUp} size="small" disabled={isFirst || !item.active}>
                                        <ArrowUpwardIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Bajar">
                                <span>
                                    <IconButton edge="end" onClick={onMoveDown} size="small" disabled={isLast || !item.active}>
                                        <ArrowDownwardIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title={item.active ? "Desactivar feature" : "Activar feature"}>
                                <IconButton onClick={() => onToggleActivity(item)} size="small" sx={{ ml: 0.5 }}>
                                    {item.active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" color="disabled" />}
                                </IconButton>
                            </Tooltip>
                            <IconButton onClick={handleOpenMenu} size="small" sx={{ ml: 0.5 }}>
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* SECCIÓN 2: TAGS */}
                    {item.display_tags && item.display_tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {item.display_tags.map((tag: string) => (
                                <Chip
                                    clickable={item.active}
                                    key={tag}
                                    label={tag}
                                    icon={<LocalOfferIcon sx={{ fontSize: '10px !important' }} />}
                                    size="small"
                                    color={item.tags?.includes(tag) ? 'primary' : 'default'}
                                    variant={item.tags?.includes(tag) && item.active ? 'filled' : 'outlined'}
                                    onClick={() => item.active && onTagClick(item.id, tag)}
                                    sx={{ fontSize: '0.65rem', height: '18px', borderRadius: '4px' }}
                                />
                            ))}
                        </Box>
                    )}


                    {/* SECCIÓN 3: SCENARIOS AND TASKS IN EXECUTION ORDER */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {(() => {
                            // Group tasks by scope and timing
                            const featureBeforeTasks = (item.ui_tasks || []).filter((t: any) =>
                                (t.scope === 'feature' || t.scope === 'Before Feature') && t.hook === 'before'
                            );

                            const featureAfterTasks = (item.ui_tasks || []).filter((t: any) =>
                                (t.scope === 'feature' || t.scope === 'After Feature') && t.hook === 'after'
                            );

                            return (
                                <>
                                    {/* BEFORE FEATURE TASKS */}
                                    {featureBeforeTasks.length > 0 && (
                                        <Box sx={{
                                            backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                            borderRadius: 1,
                                            p: 1,
                                            borderLeft: '3px solid #1976d2'
                                        }}>
                                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
                                                ⏮️ Before Feature
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {featureBeforeTasks.map((task: any, taskIndex: number) => {
                                                    const actualIndex = (item.ui_tasks || []).indexOf(task);
                                                    const taskState = taskStatuses[item.id]?.[actualIndex];
                                                    return (
                                                        <TaskCard
                                                            key={`${task.name}-${actualIndex}`}
                                                            task={task}
                                                            index={actualIndex}
                                                            item={item}
                                                            moduleName={moduleName}
                                                            status={(taskState?.status || 'pending') as any}
                                                            error={taskState?.error}
                                                            onDelete={onDeleteTask}
                                                            onEdit={onEditTask}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* SCENARIOS GROUP */}
                                    {item.scenarios && item.scenarios.length > 0 && (
                                        <Box sx={{
                                            backgroundColor: 'rgba(156, 39, 176, 0.05)', // Light purple background for scenarios group
                                            borderRadius: 1,
                                            p: 0.5,
                                            pl: 1,
                                            borderLeft: '3px solid #9c27b0', // Purple border
                                            mt: 0.5,
                                            mb: 0.5
                                        }}>
                                            <Typography variant="caption" sx={{ color: '#9c27b0', fontWeight: 'bold', fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
                                                📋 Scenarios
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                {item.scenarios.map((scenarioObj: any) => {
                                                    const scenarioName = typeof scenarioObj === 'string' ? scenarioObj : scenarioObj.name;
                                                    const scenarioTags = typeof scenarioObj === 'object' && scenarioObj.tags ? scenarioObj.tags : [];

                                                    const uniqueScenarioId = `${item.id}::${scenarioName}`;
                                                    const status = scenarioStatuses[uniqueScenarioId] || 'untested';

                                                    // Get tasks for this scenario
                                                    const scenarioBeforeTasks = (item.ui_tasks || []).filter((t: any) =>
                                                        (t.scope === 'scenario' || t.scope === 'Before Scenario') &&
                                                        t.hook === 'before' &&
                                                        t.scenario_name === scenarioName
                                                    );
                                                    const scenarioAfterTasks = (item.ui_tasks || []).filter((t: any) =>
                                                        (t.scope === 'scenario' || t.scope === 'After Scenario') &&
                                                        t.hook === 'after' &&
                                                        t.scenario_name === scenarioName
                                                    );

                                                    const colorMap = {
                                                        passed: '#4caf50',
                                                        failed: '#f44336',
                                                        skipped: '#ff9800',
                                                        untested: '#9e9e9e',
                                                        running: '#2196f3',
                                                    } as const;

                                                    const statusColor = colorMap[status as keyof typeof colorMap] || colorMap.untested;
                                                    const StatusIcon = status === 'passed' ? CheckCircleIcon :
                                                        status === 'failed' ? ErrorIcon :
                                                            status === 'running' ? CircularProgress : null;

                                                    return (
                                                        <Box key={uniqueScenarioId} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                                                            {/* Before Scenario Tasks - WRAPPED */}
                                                            {scenarioBeforeTasks.length > 0 && (
                                                                <Box sx={{
                                                                    backgroundColor: 'rgba(255, 152, 0, 0.08)', // Light orange for before scenario
                                                                    borderRadius: 1,
                                                                    p: 0.5,
                                                                    pl: 1,
                                                                    borderLeft: '3px solid #ff9800', // Orange border
                                                                    width: '100%', // Ensure it takes full width of the flex row
                                                                    mb: 0.5
                                                                }}>
                                                                    <Typography variant="caption" sx={{ color: '#ef6c00', fontWeight: 'bold', fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
                                                                        ⏮️ Before Scenario
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                        {scenarioBeforeTasks.map((task: any) => {
                                                                            const actualIndex = (item.ui_tasks || []).indexOf(task);
                                                                            const taskState = taskStatuses[item.id]?.[actualIndex];
                                                                            return (
                                                                                <TaskCard
                                                                                    key={`${task.name}-${actualIndex}`}
                                                                                    task={task}
                                                                                    index={actualIndex}
                                                                                    item={item}
                                                                                    moduleName={moduleName}
                                                                                    status={(taskState?.status || 'pending') as any}
                                                                                    error={taskState?.error}
                                                                                    onDelete={onDeleteTask}
                                                                                    onEdit={onEditTask}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </Box>
                                                                </Box>
                                                            )}

                                                            {/* Scenario Card (Styled like Task) */}
                                                            <Tooltip title={
                                                                <Box>
                                                                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{scenarioName}</Typography>
                                                                    {scenarioTags.length > 0 && (
                                                                        <Box sx={{ mt: 0.5 }}>
                                                                            <Typography variant="caption" display="block">Tags:</Typography>
                                                                            {scenarioTags.map((t: string) => <Typography key={t} variant="caption" display="block">- {t}</Typography>)}
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            } arrow >
                                                                <Paper
                                                                    elevation={status === 'untested' ? 1 : 2}
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
                                                                        maxWidth: '300px',
                                                                        position: 'relative',
                                                                        border: '1px solid',
                                                                        borderColor: 'divider',
                                                                        borderLeft: `4px solid ${statusColor}`,
                                                                        pl: 1,
                                                                        pr: 1,
                                                                        py: 0.5,
                                                                        backgroundColor: status === 'running' ? '#e3f2fd' : 'background.paper',
                                                                    }}
                                                                >
                                                                    {/* Status Icon */}
                                                                    <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                                                        {StatusIcon ? (
                                                                            status === 'running' ?
                                                                                <CircularProgress size={12} /> :
                                                                                <StatusIcon sx={{ fontSize: '14px', color: statusColor }} />
                                                                        ) : (
                                                                            <span style={{ fontSize: '12px' }}>📋</span>
                                                                        )}
                                                                    </Box>

                                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <Typography
                                                                            variant="body2"
                                                                            noWrap
                                                                            sx={{
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: status === 'running' ? 'bold' : 'bold',
                                                                                color: 'text.primary',
                                                                            }}
                                                                        >
                                                                            {scenarioName}
                                                                        </Typography>

                                                                        {/* Tags Inline */}
                                                                        {scenarioTags.length > 0 && (
                                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                                                {scenarioTags.map((tag: string) => (
                                                                                    <Chip
                                                                                        key={tag}
                                                                                        label={tag}
                                                                                        size="small"
                                                                                        clickable
                                                                                        color={item.tags?.includes(tag) ? 'primary' : 'default'}
                                                                                        variant={item.tags?.includes(tag) ? 'filled' : 'outlined'}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onTagClick(item.id, tag);
                                                                                        }}
                                                                                        sx={{
                                                                                            fontSize: '0.65rem',
                                                                                            height: '20px',
                                                                                            cursor: 'pointer',
                                                                                            '&:hover': {
                                                                                                backgroundColor: item.tags?.includes(tag) ? 'primary.dark' : 'rgba(0, 0, 0, 0.08)'
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                ))}
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                </Paper>
                                                            </Tooltip>

                                                            {/* After Scenario Tasks - WRAPPED */}
                                                            {scenarioAfterTasks.length > 0 && (
                                                                <Box sx={{
                                                                    backgroundColor: 'rgba(76, 175, 80, 0.08)', // Light green for after scenario
                                                                    borderRadius: 1,
                                                                    p: 0.5,
                                                                    pl: 1,
                                                                    borderLeft: '3px solid #4caf50', // Green border
                                                                    width: '100%', // Ensure it takes full width
                                                                    mt: 0.5
                                                                }}>
                                                                    <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
                                                                        ⏭️ After Scenario
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                        {scenarioAfterTasks.map((task: any) => {
                                                                            const actualIndex = (item.ui_tasks || []).indexOf(task);
                                                                            const taskState = taskStatuses[item.id]?.[actualIndex];
                                                                            return (
                                                                                <TaskCard
                                                                                    key={`${task.name}-${actualIndex}`}
                                                                                    task={task}
                                                                                    index={actualIndex}
                                                                                    item={item}
                                                                                    moduleName={moduleName}
                                                                                    status={(taskState?.status || 'pending') as any}
                                                                                    error={taskState?.error}
                                                                                    onDelete={onDeleteTask}
                                                                                    onEdit={onEditTask}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </Box>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    );
                                                })}
                                            </Box >
                                        </Box>
                                    )}

                                    {/* AFTER FEATURE TASKS */}
                                    {featureAfterTasks.length > 0 && (
                                        <Box sx={{
                                            backgroundColor: 'rgba(56, 142, 60, 0.08)',
                                            borderRadius: 1,
                                            p: 1,
                                            borderLeft: '3px solid #388e3c'
                                        }}>
                                            <Typography variant="caption" sx={{ color: '#388e3c', fontWeight: 'bold', fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
                                                ⏭️ After Feature
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {featureAfterTasks.map((task: any) => {
                                                    const actualIndex = (item.ui_tasks || []).indexOf(task);
                                                    const taskState = taskStatuses[item.id]?.[actualIndex];
                                                    return (
                                                        <TaskCard
                                                            key={`${task.name}-${actualIndex}`}
                                                            task={task}
                                                            index={actualIndex}
                                                            item={item}
                                                            moduleName={moduleName}
                                                            status={(taskState?.status || 'pending') as any}
                                                            error={taskState?.error}
                                                            onDelete={onDeleteTask}
                                                            onEdit={onEditTask}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    )}
                                </>
                            );
                        })()}
                    </Box>

                    {/* FOOTER: EVIDENCIAS (GIFS) - MOVIDO AL MENÚ POR SOLICITUD DEL USUARIO */}
                </Box >
            </Paper >
            <Menu
                open={contextMenu !== null}
                onClose={handleClose}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={handleOpenInEditor}>{t('editor.feature_editor')}</MenuItem>
                <MenuItem onClick={handleToggle}>{item.active ? t('common.inactive') : t('common.active')}</MenuItem>
                <MenuItem onClick={handleAddTask}>{t('orchestrator.tasks.add_task')}</MenuItem>
                {missingFiles.missing_features.some(mf => mf.id === item.id) && (
                    <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                        {t('common.delete')} ({t('common.file_missing', { defaultValue: 'file missing' })})
                    </MenuItem>
                )}
                {!missingFiles.missing_features.some(mf => mf.id === item.id) && (
                    <MenuItem onClick={handleDelete}>{t('common.delete')}</MenuItem>
                )}

                {/* Opciones de descarga de GIF si existen */}
                {item.scenarios && item.scenarios.some((scenario: any) => {
                    const name = typeof scenario === 'string' ? scenario : scenario.name;
                    return scenarioGifs && scenarioGifs[`${item.id}::${name}`];
                }) && [
                        <Divider key="gif-divider" />,
                        ...item.scenarios.map((scenario: any) => {
                            const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                            const gifId = scenarioGifs ? scenarioGifs[`${item.id}::${scenarioName}`] : null;
                            if (!gifId) return null;
                            return (
                                <MenuItem
                                    key={gifId}
                                    onClick={() => {
                                        window.open(`/api/execution/${gifId}/gif`, '_blank');
                                        handleClose();
                                    }}
                                >
                                    <ListItemIcon>
                                        <DownloadIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Descargar GIF: ${scenarioName}`}
                                        primaryTypographyProps={{ sx: { fontSize: '0.75rem' } }}
                                    />
                                </MenuItem>
                            );
                        }).filter(Boolean),
                        ...item.scenarios.map((scenario: any) => {
                            const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                            const gifId = scenarioGifs ? scenarioGifs[`${item.id}::${scenarioName}`] : null;
                            if (!gifId) return null;
                            return (
                                <MenuItem
                                    key={`${gifId}-video`}
                                    onClick={() => {
                                        window.open(`/api/execution/${gifId}/video`, '_blank');
                                        handleClose();
                                    }}
                                >
                                    <ListItemIcon>
                                        <DownloadIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Descargar Video: ${scenarioName}`}
                                        primaryTypographyProps={{ sx: { fontSize: '0.75rem' } }}
                                    />
                                </MenuItem>
                            );
                        }).filter(Boolean)
                    ]}
            </Menu>
        </>
    );
};

export default React.memo(ExecutionItem);
