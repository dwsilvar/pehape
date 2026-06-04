import React, { useState } from 'react';
import { AppBar, Toolbar, Button, Box, IconButton, Tooltip, Menu, MenuItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LanguageIcon from '@mui/icons-material/Language';
import CheckIcon from '@mui/icons-material/Check';
import PaletteIcon from '@mui/icons-material/Palette';
import { useLayout } from '../context/LayoutContext';
import { appThemes } from '../theme';

interface AppToolbarProps {
    title?: string;
    icon?: React.ReactNode;
    showViewMenu?: boolean;
    showControls?: boolean;
    children?: React.ReactNode;
}

const AppToolbar: React.FC<AppToolbarProps> = ({ title, icon, showViewMenu = false, showControls = true, children }) => {
    const { t, i18n } = useTranslation();
    const { themeName, setThemeName } = useLayout();
    const [viewMenuAnchorEl, setViewMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [themeMenuAnchorEl, setThemeMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [languageMenuAnchorEl, setLanguageMenuAnchorEl] = useState<null | HTMLElement>(null);

    const handleViewMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setViewMenuAnchorEl(event.currentTarget);
    };

    const handleViewMenuClose = () => {
        setViewMenuAnchorEl(null);
    };

    const handleThemeMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setThemeMenuAnchorEl(event.currentTarget);
    };

    const handleThemeMenuClose = () => {
        setThemeMenuAnchorEl(null);
    };

    const handleThemeChange = (newTheme: string) => {
        setThemeName(newTheme);
        handleThemeMenuClose();
    };

    const handleLanguageMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setLanguageMenuAnchorEl(event.currentTarget);
    };

    const handleLanguageMenuClose = () => {
        setLanguageMenuAnchorEl(null);
    };

    const handleLanguageChange = (lng: string) => {
        i18n.changeLanguage(lng);
        handleLanguageMenuClose();
    };

    return (
        <>
            <AppBar position="static" elevation={0} color="default" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar variant="dense" sx={{ minHeight: '48px' }}>
                    {/* Left side: Page title and icon */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        {icon && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1.5, color: 'primary.main' }}>
                                {icon}
                            </Box>
                        )}
                        {title && (
                            <Typography variant="h6" component="h1" sx={{ fontWeight: 500, mr: 3 }}>
                                {title}
                            </Typography>
                        )}
                        {children}
                    </Box>

                    {/* Right side: View, Theme and Language controls */}
                    {showControls && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* View Menu Button */}
                        {showViewMenu && (
                            <Button color="inherit" onClick={handleViewMenuClick} size="small">
                                {t('common.view')}
                            </Button>
                        )}

                        {/* Theme Selector Button */}
                        <Tooltip title={t('common.theme') || 'Theme'}>
                            <Box
                                onClick={handleThemeMenuClick}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                            >
                                <PaletteIcon fontSize="small" />
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', mt: 0.25 }}>
                                    Tema
                                </Typography>
                            </Box>
                        </Tooltip>

                        {/* Language Selector Button */}
                        <Tooltip title={t('common.language')}>
                            <Box
                                onClick={handleLanguageMenuClick}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                <LanguageIcon fontSize="small" />
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', mt: 0.25 }}>
                                    {i18n.language === 'es' ? 'ES' : 'EN'}
                                </Typography>
                            </Box>
                        </Tooltip>
                    </Box>
                    )}
                </Toolbar>
            </AppBar>

            {/* View Menu (optional) */}
            {showViewMenu && (
                <Menu
                    anchorEl={viewMenuAnchorEl}
                    open={Boolean(viewMenuAnchorEl)}
                    onClose={handleViewMenuClose}
                >
                    <MenuItem disabled>{t('common.view')}</MenuItem>
                    <MenuItem onClick={handleViewMenuClose}>
                        <Typography variant="caption" color="text.secondary">
                            {t('common.view_options')}
                        </Typography>
                    </MenuItem>
                </Menu>
            )}

            {/* Theme Selection Menu */}
            <Menu
                anchorEl={themeMenuAnchorEl}
                open={Boolean(themeMenuAnchorEl)}
                onClose={handleThemeMenuClose}
            >
                {Object.values(appThemes).map((theme) => (
                    <MenuItem key={theme.id} onClick={() => handleThemeChange(theme.id)}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: theme.colors.accent, border: '1px solid', borderColor: theme.colors.border }} />
                            <Box sx={{ flexGrow: 1, pr: 2 }}>{theme.name}</Box>
                            {themeName === theme.id && <CheckIcon fontSize="small" color="primary" />}
                        </Box>
                    </MenuItem>
                ))}
            </Menu>

            {/* Language Selection Menu */}
            <Menu
                anchorEl={languageMenuAnchorEl}
                open={Boolean(languageMenuAnchorEl)}
                onClose={handleLanguageMenuClose}
            >
                <MenuItem onClick={() => handleLanguageChange('en')}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flexGrow: 1 }}>English</Box>
                        {i18n.language === 'en' && <CheckIcon fontSize="small" color="primary" />}
                    </Box>
                </MenuItem>
                <MenuItem onClick={() => handleLanguageChange('es')}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flexGrow: 1 }}>Español</Box>
                        {i18n.language === 'es' && <CheckIcon fontSize="small" color="primary" />}
                    </Box>
                </MenuItem>
            </Menu>
        </>
    );
};

export default AppToolbar;
