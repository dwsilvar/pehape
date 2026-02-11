import React from 'react';
import { Box, Paper, Typography, Chip, Tooltip, alpha, useTheme } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Module } from '../../../types';

const DEFAULT_MODULE_COLOR = '#7e57c2';

interface SortableModuleProps {
    module: Module;
    controls: React.ReactNode;
    headerPrefix?: React.ReactNode;
    headerSuffix?: React.ReactNode;
    children: React.ReactNode;
    onSelect?: () => void;
    isSelected?: boolean;
}

const SortableModule: React.FC<SortableModuleProps> = ({ module, controls, headerPrefix, headerSuffix, children, onSelect, isSelected }) => {
    const theme = useTheme();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: module.module_name,
        data: { type: 'module' }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 'auto',
        position: 'relative' as 'relative',
    };

    const droppableId = `module-drop-area-${module.module_name}`;

    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: {
            moduleName: module.module_name,
        },
    });

    const { active, over: globalOver } = useDndContext();

    // Highlighting logic:
    const isDraggingFile = active?.data.current?.type === 'file-explorer-feature';
    const isOverChild = globalOver?.data?.current?.sortable?.containerId === module.module_name;
    const showHighlight = isDraggingFile && (isOver || isOverChild);

    return (
        <Box ref={setNodeRef} style={style} sx={{ position: 'relative' }}>
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '30px',
                    cursor: 'grab',
                    borderTopLeftRadius: (theme) => theme.shape.borderRadius,
                    borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
                    backgroundColor: module.color || DEFAULT_MODULE_COLOR,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                }}
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>
            <Paper
                ref={setDroppableNodeRef} // Explicitly attach droppable ref here
                variant="outlined"
                sx={{
                    mb: 2,
                    p: 2,
                    pl: 4,
                    backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.08) : alpha(module.color || DEFAULT_MODULE_COLOR, 0.03),
                    borderColor: isSelected ? theme.palette.primary.main : (module.color || DEFAULT_MODULE_COLOR),
                    borderWidth: isSelected ? '2px' : '1px',
                    outline: showHighlight ? '2px dashed' : 'none',
                    outlineColor: showHighlight ? 'primary.main' : 'transparent',
                    transition: 'all 0.2s ease-in-out',
                }}
            >
                <Box
                    display="flex"
                    alignItems="center"
                    mb={1}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
                    sx={{
                        cursor: 'pointer',
                        p: 0.5,
                        borderRadius: 1,
                        '&:hover': {
                            backgroundColor: isSelected
                                ? alpha(theme.palette.primary.main, 0.08)
                                : (theme.palette.mode === 'dark'
                                    ? alpha(theme.palette.common.white, 0.03)
                                    : alpha(theme.palette.common.black, 0.02))
                        }
                    }}
                >
                    <Box
                        sx={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        {headerPrefix}
                        <Typography variant="h6" sx={{ fontSize: `${14 + 2}px`, fontWeight: isSelected ? 'bold' : 'normal' }}>
                            {module.active
                                ? `${module.order}. ${module.module_name}`
                                : module.module_name}
                        </Typography>
                        {headerSuffix}

                        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                            {(module.setup || []).length > 0 && (
                                <Tooltip title="Setup Hooks">
                                    <Chip
                                        label={`${(module.setup || []).length} S`}
                                        size="small"
                                        sx={{
                                            height: '18px',
                                            fontSize: '0.65rem',
                                            backgroundColor: theme.palette.secondary.main,
                                            color: theme.palette.secondary.contrastText,
                                            fontWeight: 'bold'
                                        }}
                                    />
                                </Tooltip>
                            )}
                            {(module.teardown || []).length > 0 && (
                                <Tooltip title="Teardown Hooks">
                                    <Chip
                                        label={`${(module.teardown || []).length} T`}
                                        size="small"
                                        sx={{
                                            height: '18px',
                                            fontSize: '0.65rem',
                                            backgroundColor: theme.palette.secondary.dark,
                                            color: theme.palette.secondary.contrastText,
                                            fontWeight: 'bold'
                                        }}
                                    />
                                </Tooltip>
                            )}
                        </Box>
                    </Box>
                    {controls}
                </Box>
                {children}
            </Paper>
        </Box>
    );
};

export default SortableModule;
