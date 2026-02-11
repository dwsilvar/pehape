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
    alpha,
    Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import VideocamIcon from '@mui/icons-material/Videocam';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
    onAddTask: (moduleName: string, item: FeatureItem, scenarioName?: string, event?: React.MouseEvent) => void;
    onDeleteTask: (moduleName: string, item: FeatureItem, taskIndex: number) => void;
    onEditTask?: (moduleName: string, item: FeatureItem, task: any, index: number, event?: React.MouseEvent) => void;

    // Selection for side panel
    selectedScenario?: { moduleName: string; featureId?: string; scenarioName?: string } | null;
    onSelectScenario?: (moduleName: string, featureId: string, scenarioName?: string) => void;
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
    selectedScenario,
    onSelectScenario,
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
        data: { type: 'feature' },
        disabled: !item.active,
    });

    const [contextMenu, setContextMenu] = React.useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);

    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const isSelected = selectedScenario?.featureId === item.id;
    const featureTasks = (item.ui_tasks || []).filter((t: any) =>
        t.scope?.toLowerCase() === 'feature' || t.scope === 'Before Feature' || t.scope === 'After Feature'
    );

    const totalScenarioTasks = (item.ui_tasks || []).filter((t: any) =>
        t.scenario_name && (t.scope === 'scenario' || t.scope === 'Scenario')
    ).length;

    const totalTasks = featureTasks.length + totalScenarioTasks;

    const scenarioTagsPool = new Set(item.scenarios?.flatMap(s => s.tags || []) || []);
    const featureOnlyTags = (item.display_tags || []).filter(tag => !scenarioTagsPool.has(tag));

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!item.active) return;
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
        onDoubleClick(item);
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

    const toggleCollapse = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCollapsed(!isCollapsed);
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
                elevation={isDragging ? 6 : 4}
                onDoubleClick={(e) => { e.stopPropagation(); item.active && onDoubleClick(item); }}
                onClick={(e) => { e.stopPropagation(); item.active && onSelectScenario?.(moduleName, item.id); }}
                onContextMenu={handleContextMenu}
                sx={{
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: isDragging ? 0.5 : (item.active ? 1 : 0.6),
                    backgroundColor: isSelected && !selectedScenario?.scenarioName ? '#F8FAFC' : (item.active ? 'background.default' : 'action.disabledBackground'),
                    position: 'relative',
                    border: isRunning ? '2px solid' : (isSelected && !selectedScenario?.scenarioName ? '2px solid' : 'none'),
                    borderColor: isRunning ? 'primary.main' : (isSelected && !selectedScenario?.scenarioName ? '#3b82f6' : 'transparent'),
                    pl: '30px',
                    py: 1,
                    pr: 1,
                    cursor: item.active ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        backgroundColor: item.active ? (isSelected && !selectedScenario?.scenarioName ? '#F0F9FF' : '#F8FAFC') : undefined,
                        borderColor: isRunning ? 'primary.main' : (isSelected && !selectedScenario?.scenarioName ? '#2563eb' : '#CBD5E1'),
                    }
                }}
            >
                {/* Handle */}
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

                {/* Content */}
                <Box sx={{ flexGrow: 1, ml: 1, cursor: item.active ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: isCollapsed ? 0.5 : 1 }}>
                    {/* Header Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton onClick={toggleCollapse} size="small" sx={{ mr: -0.5 }}>
                                {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                            </IconButton>
                            <Typography sx={{
                                fontSize: `${fontSize}px`,
                                fontWeight: 'bold',
                                textDecoration: item.active ? 'none' : 'line-through',
                                color: item.active ? 'text.primary' : 'text.disabled'
                            }}>
                                {`${item.order}. ${item.feature_file}`}
                            </Typography>
                            {(isCollapsed || featureTasks.length > 0) && (
                                <Tooltip title={`${totalTasks} tareas totales (Globales: ${featureTasks.length})`}>
                                    <Chip
                                        icon={<AssignmentIcon sx={{ fontSize: '12px !important' }} />}
                                        label={`Tareas: ${totalTasks}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{
                                            height: '20px',
                                            fontSize: '0.65rem',
                                            borderColor: alpha(item.color || DEFAULT_FEATURE_COLOR, 0.3),
                                            backgroundColor: alpha(item.color || DEFAULT_FEATURE_COLOR, 0.05),
                                            '& .MuiChip-label': { px: 0.8 }
                                        }}
                                    />
                                </Tooltip>
                            )}
                            {isCollapsed && item.scenarios && item.scenarios.length > 0 && (
                                <Chip
                                    label={`Scenarios: ${item.scenarios.length}`}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                    sx={{
                                        height: '20px',
                                        fontSize: '0.65rem',
                                        borderColor: alpha('#A855F7', 0.3),
                                        backgroundColor: alpha('#A855F7', 0.05),
                                        color: '#6B21A8',
                                        '& .MuiChip-label': { px: 0.8 }
                                    }}
                                />
                            )}
                            {missingFiles.missing_features.some(mf => mf.id === item.id) && (
                                <Tooltip title={`File not found: ${missingFiles.missing_features.find(mf => mf.id === item.id)?.path}`} arrow>
                                    <WarningIcon fontSize="small" sx={{ color: 'error.main' }} />
                                </Tooltip>
                            )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title="Subir">
                                <span>
                                    <IconButton edge="end" onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} size="small" disabled={isFirst || !item.active}>
                                        <ArrowUpwardIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Bajar">
                                <span>
                                    <IconButton edge="end" onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} size="small" disabled={isLast || !item.active}>
                                        <ArrowDownwardIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title={item.active ? "Desactivar feature" : "Activar feature"}>
                                <IconButton onClick={(e) => { e.stopPropagation(); onToggleActivity(item); }} size="small" sx={{ ml: 0.5 }}>
                                    {item.active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" color="disabled" />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('editor.feature_editor')}>
                                <IconButton onClick={(e) => { e.stopPropagation(); onDoubleClick(item); }} size="small" sx={{ ml: 0.5 }}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <IconButton onClick={handleOpenMenu} size="small" sx={{ ml: 0.5 }}>
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Tags (Feature Level Only) */}
                    {!isCollapsed && featureOnlyTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {featureOnlyTags.map((tag: string) => (
                                <Chip
                                    clickable={item.active}
                                    key={tag}
                                    label={tag}
                                    icon={<LocalOfferIcon sx={{ fontSize: '10px !important' }} />}
                                    size="small"
                                    color={item.tags?.includes(tag) ? 'primary' : 'default'}
                                    variant={item.tags?.includes(tag) && item.active ? 'filled' : 'outlined'}
                                    onClick={(e) => { e.stopPropagation(); item.active && onTagClick(item.id, tag); }}
                                    sx={{ fontSize: '0.65rem', height: '18px', borderRadius: '4px' }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Scenarios and Tasks */}
                    {!isCollapsed && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                            {(() => {
                                return (
                                    <>

                                        {/* Scenarios List */}
                                        {item.scenarios && item.scenarios.length > 0 && (
                                            <Paper variant="outlined" sx={{ backgroundColor: '#F3E8FF', borderRadius: 2, p: 1.5, borderColor: '#A855F7', mt: 0.5, mb: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
                                                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>📋</Typography>
                                                    <Typography variant="caption" sx={{ color: '#6B21A8', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Scenarios
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {item.scenarios.map((scenarioObj: any) => {
                                                        const scenarioName = typeof scenarioObj === 'string' ? scenarioObj : scenarioObj.name;
                                                        const scenarioTags = typeof scenarioObj === 'object' && scenarioObj.tags ? scenarioObj.tags : [];
                                                        const uniqueScenarioId = `${item.id}::${scenarioName}`;
                                                        const status = scenarioStatuses[uniqueScenarioId] || 'untested';

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

                                                        const isSelected = selectedScenario?.moduleName === moduleName &&
                                                            selectedScenario?.featureId === item.id &&
                                                            selectedScenario?.scenarioName === scenarioName;

                                                        const scenarioTasks = (item.ui_tasks || []).filter((t: any) =>
                                                            t.scenario_name === scenarioName && (t.scope === 'scenario' || t.scope === 'Scenario')
                                                        );
                                                        const hasTasks = scenarioTasks.length > 0;

                                                        return (
                                                            <Paper
                                                                key={uniqueScenarioId}
                                                                variant="outlined"
                                                                onClick={(e) => { e.stopPropagation(); onSelectScenario?.(moduleName, item.id, scenarioName); }}
                                                                sx={{
                                                                    p: 1.5,
                                                                    borderRadius: 1, // Harmonized with tag shape (4px)
                                                                    borderColor: isSelected ? '#3b82f6' : (status !== 'untested' ? statusColor : '#e2e8f0'),
                                                                    borderWidth: isSelected || status !== 'untested' ? '2px' : '1px',
                                                                    borderLeft: status !== 'untested' ? `6px solid ${statusColor}` : isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                                    backgroundImage: status === 'running'
                                                                        ? `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.2) 50%, transparent 100%)`
                                                                        : 'none',
                                                                    backgroundColor: isSelected ? '#eff6ff' : '#FFFFFF',
                                                                    backgroundSize: '200% 100%',
                                                                    animation: status === 'running' ? 'progress-animation 2s linear infinite' : 'none',
                                                                    '@keyframes progress-animation': {
                                                                        '0%': { backgroundPosition: '200% 0%' },
                                                                        '100%': { backgroundPosition: '-200% 0%' },
                                                                    },
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: 1,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    '&:hover': {
                                                                        borderColor: isSelected ? '#2563eb' : (status !== 'untested' ? statusColor : '#cbd5e1'),
                                                                        backgroundColor: isSelected ? '#dbeafe' : '#f8fafc',
                                                                    }
                                                                }}
                                                            >
                                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 0.5 }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', px: 0.5 }}>
                                                                            {`${t('orchestrator.tasks.scenario')}: ${scenarioName}`}
                                                                        </Typography>
                                                                        {hasTasks && (
                                                                            <Tooltip title={`${scenarioTasks.length} tareas asociadas`}>
                                                                                <Chip
                                                                                    icon={<AssignmentIcon sx={{ fontSize: '12px !important' }} />}
                                                                                    label={scenarioTasks.length}
                                                                                    size="small"
                                                                                    color="primary"
                                                                                    variant="outlined"
                                                                                    sx={{
                                                                                        height: '20px',
                                                                                        fontSize: '0.65rem',
                                                                                        borderColor: alpha('#3b82f6', 0.3),
                                                                                        backgroundColor: alpha('#3b82f6', 0.05),
                                                                                        '& .MuiChip-label': { px: 0.8 }
                                                                                    }}
                                                                                />
                                                                            </Tooltip>
                                                                        )}
                                                                        {StatusIcon && (
                                                                            status === 'running' ?
                                                                                <CircularProgress size={16} sx={{ color: statusColor }} /> :
                                                                                <StatusIcon sx={{ fontSize: '1.1rem', color: statusColor }} />
                                                                        )}
                                                                    </Box>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                        {(() => {
                                                                            const gifId = scenarioGifs[`${item.id}::${scenarioName}`];
                                                                            if (!gifId) return null;
                                                                            return (
                                                                                <>
                                                                                    <Tooltip title="Descargar GIF">
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            onClick={(e) => { e.stopPropagation(); window.open(`/api/execution/${gifId}/gif`, '_blank'); }}
                                                                                            sx={{ color: statusColor, p: 0.5 }}
                                                                                        >
                                                                                            <DownloadIcon sx={{ fontSize: '1.1rem' }} />
                                                                                        </IconButton>
                                                                                    </Tooltip>
                                                                                    <Tooltip title="Descargar Video">
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            onClick={(e) => { e.stopPropagation(); window.open(`/api/execution/${gifId}/video`, '_blank'); }}
                                                                                            sx={{ color: statusColor, p: 0.5 }}
                                                                                        >
                                                                                            <VideocamIcon sx={{ fontSize: '1.2rem' }} />
                                                                                        </IconButton>
                                                                                    </Tooltip>
                                                                                </>
                                                                            );
                                                                        })()}
                                                                        <Tooltip title={t('orchestrator.tasks.add_task')}>
                                                                            <Button
                                                                                variant="outlined"
                                                                                size="small"
                                                                                startIcon={<AddIcon />}
                                                                                onClick={(e) => { e.stopPropagation(); onAddTask(moduleName, item, scenarioName, e); }}
                                                                                sx={{
                                                                                    fontSize: '0.65rem',
                                                                                    py: 0.2,
                                                                                    px: 1,
                                                                                    minWidth: 'auto',
                                                                                    textTransform: 'none',
                                                                                    fontWeight: 'bold',
                                                                                    borderColor: alpha(statusColor, 0.4),
                                                                                    color: statusColor,
                                                                                    backgroundColor: alpha(statusColor, 0.02),
                                                                                    '&:hover': {
                                                                                        borderColor: statusColor,
                                                                                        backgroundColor: alpha(statusColor, 0.08),
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {t('orchestrator.tasks.add_task').toLowerCase()}
                                                                            </Button>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </Box>

                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, px: 0.5 }}>
                                                                    {scenarioTags.map((tag: string) => (
                                                                        <Chip
                                                                            key={tag}
                                                                            label={tag}
                                                                            icon={<LocalOfferIcon sx={{ fontSize: '10px !important' }} />}
                                                                            size="small"
                                                                            clickable
                                                                            color={item.tags?.includes(tag) ? 'primary' : 'default'}
                                                                            variant={item.tags?.includes(tag) ? 'filled' : 'outlined'}
                                                                            onClick={(e) => { e.stopPropagation(); onTagClick(item.id, tag); }}
                                                                            sx={{ fontSize: '0.65rem', height: '18px', borderRadius: '4px' }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Paper>
                                                        );
                                                    })}
                                                </Box >
                                            </Paper>
                                        )}

                                    </>
                                );
                            })()}
                        </Box>
                    )}
                </Box >
            </Paper >

            <Menu
                open={contextMenu !== null}
                onClose={handleClose}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
            >
                <MenuItem onClick={handleOpenInEditor}>{t('editor.feature_editor')}</MenuItem>
                <MenuItem onClick={handleToggle}>{item.active ? t('common.inactive') : t('common.active')}</MenuItem>
                <MenuItem onClick={handleAddTask}>{t('orchestrator.tasks.add_task')}</MenuItem>
                <Divider />
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>{t('common.delete')}</MenuItem>

                {/* Opciones de descarga de GIF si existen */}
                {item.scenarios && item.scenarios.some((scenario: any) => {
                    const name = typeof scenario === 'string' ? scenario : scenario.name;
                    return scenarioGifs && scenarioGifs[`${item.id}::${name}`];
                }) && [
                        <Divider key="gif-divider" />,
                        ...item.scenarios.map((scenario: any, idx: number) => {
                            const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                            const gifId = scenarioGifs ? scenarioGifs[`${item.id}::${scenarioName}`] : null;
                            if (!gifId) return null;
                            return (
                                <MenuItem
                                    key={`${gifId}-${idx}`}
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
                        ...item.scenarios.map((scenario: any, idx: number) => {
                            const scenarioName = typeof scenario === 'string' ? scenario : scenario.name;
                            const gifId = scenarioGifs ? scenarioGifs[`${item.id}::${scenarioName}`] : null;
                            if (!gifId) return null;
                            return (
                                <MenuItem
                                    key={`${gifId}-video-${idx}`}
                                    onClick={() => {
                                        window.open(`/api/execution/${gifId}/video`, '_blank');
                                        handleClose();
                                    }}
                                >
                                    <ListItemIcon>
                                        <VideocamIcon fontSize="small" />
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
