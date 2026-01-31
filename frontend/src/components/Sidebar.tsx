import React, { useState } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Tooltip, Divider } from '@mui/material';
import {
    Home as HomeIcon,
    Build as BuildIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    AccountTree as AccountTreeIcon,
    Terminal as TerminalIcon,
    Assignment as AssignmentIcon,
    Image as ImageIcon,
    Window as WindowIcon,
    BarChart as BarChartIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayout } from '../context/LayoutContext';

const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { activeView, setActiveView, toggleConsole, isConsoleOpen } = useLayout();

    const handleNavigation = (path: string, view?: 'editor' | 'orchestrator') => {
        navigate(path);
        if (view) {
            setActiveView(view);
        }
    };

    const isActive = (path: string) => location.pathname === path;
    const isHome = isActive('/');

    if (isCollapsed) {
        return (
            <Box sx={{
                width: 60,
                height: '100%',
                borderRight: '1px solid #ddd',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pt: 2,
                bgcolor: 'background.paper',
                flexShrink: 0,
                zIndex: 1300
            }}>
                <IconButton onClick={() => setIsCollapsed(false)} sx={{ mb: 2 }}>
                    <ChevronRightIcon />
                </IconButton>

                <Tooltip title="Editor (Code)" placement="right">
                    <IconButton
                        color={isHome && activeView === 'editor' ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/', 'editor')}
                    >
                        <HomeIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Orchestrator (Flow)" placement="right">
                    <IconButton
                        color={isHome && activeView === 'orchestrator' ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/', 'orchestrator')}
                    >
                        <AccountTreeIcon />
                    </IconButton>
                </Tooltip>

                <Divider sx={{ width: '80%', my: 1 }} />

                <Tooltip title="Toggle Console" placement="right">
                    <IconButton
                        color={isConsoleOpen ? 'secondary' : 'default'}
                        onClick={toggleConsole}
                    >
                        <TerminalIcon />
                    </IconButton>
                </Tooltip>

                <Divider sx={{ width: '80%', my: 1 }} />

                <Tooltip title="Maintenance" placement="right">
                    <IconButton
                        color={isActive('/maintenance') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/maintenance')}
                    >
                        <BuildIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Tasks Documentation" placement="right">
                    <IconButton
                        color={isActive('/tasks') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/tasks')}
                    >
                        <AssignmentIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="OCR Resources" placement="right">
                    <IconButton
                        color={isActive('/ocr-resources') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/ocr-resources')}
                    >
                        <ImageIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Running Apps" placement="right">
                    <IconButton
                        color={isActive('/running-apps') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/running-apps')}
                    >
                        <WindowIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Reports" placement="right">
                    <IconButton
                        color={isActive('/reports') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/reports')}
                    >
                        <BarChartIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }

    return (
        <Box sx={{
            width: 240,
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #ddd',
            bgcolor: 'background.paper',
            zIndex: 1300
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', p: 1 }}>
                <IconButton onClick={() => setIsCollapsed(true)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
            </Box>

            <List component="nav">
                <ListItem disablePadding>
                    <ListItemButton
                        selected={isHome && activeView === 'editor'}
                        onClick={() => handleNavigation('/', 'editor')}
                    >
                        <ListItemIcon>
                            <HomeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Editor" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isHome && activeView === 'orchestrator'}
                        onClick={() => handleNavigation('/', 'orchestrator')}
                    >
                        <ListItemIcon>
                            <AccountTreeIcon />
                        </ListItemIcon>
                        <ListItemText primary="Execution Order" />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton onClick={toggleConsole}>
                        <ListItemIcon>
                            <TerminalIcon color={isConsoleOpen ? 'secondary' : 'inherit'} />
                        </ListItemIcon>
                        <ListItemText primary={isConsoleOpen ? "Hide Console" : "Show Console"} />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/maintenance')}
                        onClick={() => handleNavigation('/maintenance')}
                    >
                        <ListItemIcon>
                            <BuildIcon />
                        </ListItemIcon>
                        <ListItemText primary="Maintenance" />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/tasks')}
                        onClick={() => handleNavigation('/tasks')}
                    >
                        <ListItemIcon>
                            <AssignmentIcon />
                        </ListItemIcon>
                        <ListItemText primary="Tasks" />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/ocr-resources')}
                        onClick={() => handleNavigation('/ocr-resources')}
                    >
                        <ListItemIcon>
                            <ImageIcon />
                        </ListItemIcon>
                        <ListItemText primary="OCR Images" />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/running-apps')}
                        onClick={() => handleNavigation('/running-apps')}
                    >
                        <ListItemIcon>
                            <WindowIcon />
                        </ListItemIcon>
                        <ListItemText primary="Running Apps" />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/reports')}
                        onClick={() => handleNavigation('/reports')}
                    >
                        <ListItemIcon>
                            <BarChartIcon />
                        </ListItemIcon>
                        <ListItemText primary="Reports" />
                    </ListItemButton>
                </ListItem>
            </List>
        </Box>
    );
};

export default Sidebar;
