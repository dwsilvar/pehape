import React from 'react';
import { Box, Paper, Typography } from '@mui/material'; // Fixed: removed duplicate DragIndicatorIcon from here
// Checking original imports: import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Module } from '../../../types';

const DEFAULT_MODULE_COLOR = '#7e57c2';

interface SortableModuleProps {
    module: Module;
    controls: React.ReactNode;
    children: React.ReactNode;
}

const SortableModule: React.FC<SortableModuleProps> = ({ module, controls, children }) => {
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
                elevation={2}
                sx={{
                    mb: 2,
                    p: 2,
                    pl: 4,
                    backgroundColor: module.color ? `${module.color}20` : 'background.paper',
                    outline: showHighlight ? '2px dashed' : 'none',
                    outlineColor: showHighlight ? 'primary.main' : 'transparent',
                    transition: 'outline-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
                }}
            >
                <Box display="flex" alignItems="center" mb={1}>
                    <Box
                        sx={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Typography variant="h6" sx={{ fontSize: `${14 + 2}px`, flexGrow: 1 }}>
                            {module.active
                                ? `${module.order}. ${module.module_name}`
                                : module.module_name}
                        </Typography>
                    </Box>
                    {controls}
                </Box>
                {children}
            </Paper>
        </Box>
    );
};

export default SortableModule;
