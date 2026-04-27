import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Tooltip, Divider, Typography } from '@mui/material';
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
    BarChart as BarChartIcon,
    Person as PersonIcon,
    BugReport as BugReportIcon,
    Article as ArticleIcon,
    EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayout } from '../context/LayoutContext';

const Sidebar: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { activeView, setActiveView, toggleConsole, isConsoleOpen } = useLayout();

    const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSd9cr759DSc-2lhb51K_xtfJYfeb3-7erusvcTSJDZRjHAuGg/viewform?usp=publish-editor";

    const handleNavigation = (path: string) => {
        navigate(path);
    };

    const isActive = (path: string) => location.pathname === path;
    const isHome = isActive('/');

    if (isCollapsed) {
        return (
            <Box sx={{
                width: 60,
                height: '100%',
                borderRight: '1px solid',
                borderColor: 'divider',
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

                <Tooltip title={t('common.sidebar.test_plan')} placement="right">
                    <IconButton
                        color={isHome ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/')}
                    >
                        <HomeIcon />
                    </IconButton>
                </Tooltip>



                <Divider sx={{ width: '80%', my: 1 }} />

                <Tooltip title={t('common.sidebar.maintenance')} placement="right">
                    <IconButton
                        color={isActive('/maintenance') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/maintenance')}
                    >
                        <BuildIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('common.sidebar.tasks')} placement="right">
                    <IconButton
                        color={isActive('/tasks') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/tasks')}
                    >
                        <AssignmentIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('common.sidebar.feature_editor')} placement="right">
                    <IconButton
                        color={isActive('/feature-editor') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/feature-editor')}
                    >
                        <ArticleIcon />
                    </IconButton>
                </Tooltip>



                <Tooltip title={t('common.sidebar.ocr')} placement="right">
                    <IconButton
                        color={isActive('/ocr-resources') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/ocr-resources')}
                    >
                        <ImageIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('common.sidebar.apps')} placement="right">
                    <IconButton
                        color={isActive('/running-apps') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/running-apps')}
                    >
                        <WindowIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('common.sidebar.reports')} placement="right">
                    <IconButton
                        color={isActive('/reports') ? 'primary' : 'default'}
                        onClick={() => handleNavigation('/reports')}
                    >
                        <BarChartIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('common.sidebar.feedback')} placement="right">
                    <IconButton
                        onClick={() => window.open(FEEDBACK_FORM_URL, '_blank')}
                        sx={{ color: 'warning.main' }}
                    >
                        <BugReportIcon />
                    </IconButton>
                </Tooltip>

                {/* Developer Branding - Collapsed */}
                <Box sx={{ mt: 'auto', mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Tooltip title="Developed by dwsr" placement="right">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <img
                                src="/chavin-head.png"
                                alt="Chavín Head"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    opacity: 0.5,
                                    filter: 'grayscale(100%)'
                                }}
                            />
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.disabled',
                                    fontSize: '0.65rem',
                                    fontWeight: 300,
                                    textAlign: 'center',
                                    display: 'block'
                                }}
                            >
                                dwsr
                            </Typography>
                        </Box>
                    </Tooltip>
                </Box>
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
            borderRight: '1px solid',
            borderColor: 'divider',
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
                        selected={isHome}
                        onClick={() => handleNavigation('/')}
                    >
                        <ListItemIcon>
                            <HomeIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('common.sidebar.test_plan')} />
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
                        <ListItemText primary={t('common.sidebar.maintenance')} />
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
                        <ListItemText primary={t('common.sidebar.tasks')} />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/feature-editor')}
                        onClick={() => handleNavigation('/feature-editor')}
                    >
                        <ListItemIcon>
                            <ArticleIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('common.sidebar.feature_editor')} />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />



                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        selected={isActive('/ocr-resources')}
                        onClick={() => handleNavigation('/ocr-resources')}
                    >
                        <ListItemIcon>
                            <ImageIcon />
                        </ListItemIcon>
                        <ListItemText primary={t('common.sidebar.ocr')} />
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
                        <ListItemText primary={t('common.sidebar.apps')} />
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
                        <ListItemText primary={t('common.sidebar.reports')} />
                    </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 1 }} />

                <ListItem disablePadding>
                    <ListItemButton
                        onClick={() => window.open(FEEDBACK_FORM_URL, '_blank')}
                    >
                        <ListItemIcon>
                            <BugReportIcon sx={{ color: 'warning.main' }} />
                        </ListItemIcon>
                        <ListItemText primary={t('common.sidebar.feedback')} />
                    </ListItemButton>
                </ListItem>
            </List>

            {/* Developer Branding - Expanded */}
            <Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <img
                        src="/chavin-head.png"
                        alt="Chavín Head"
                        style={{
                            width: '28px',
                            height: '28px',
                            opacity: 0.5,
                            filter: 'grayscale(100%)'
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'text.disabled',
                            fontSize: '0.7rem',
                            fontWeight: 300
                        }}
                    >
                        Developed by <strong>dwsr</strong>
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Sidebar;
