import React, { useState } from 'react';
import { 
    AppBar, 
    Toolbar, 
    Box, 
    Typography, 
    IconButton, 
    Tooltip, 
    Button, 
    alpha, 
    useTheme,
    Menu,
    MenuItem,
    Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLayout } from '../context/LayoutContext';
import { appThemes } from '../theme';
import { useAppVersion } from '../hooks/useAppVersion';

// Material Icons
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SmartButtonRoundedIcon from '@mui/icons-material/SmartButtonRounded';

const AppNavbar: React.FC = () => {
    const theme = useTheme();
    const { t, i18n } = useTranslation();
    const { themeName, setThemeName } = useLayout();
    const appVersion = useAppVersion();
    const [langAnchorEl, setLangAnchorEl] = useState<null | HTMLElement>(null);
    const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);

    const isDark = themeName === 'vs-dark' || themeName.includes('dark');

    const getBaseTheme = (name: string) => {
        if (name.includes('tech-minimal')) return 'tech-minimal';
        if (name.includes('neo-brutalista')) return 'neo-brutalista';
        return 'vs'; // Original
    };

    const currentBaseTheme = getBaseTheme(themeName);

    const handleThemeModeToggle = () => {
        const newMode = isDark ? 'light' : 'dark';
        setThemeName(`${currentBaseTheme}-${newMode}`);
    };

    const handleThemeClick = (event: React.MouseEvent<HTMLElement>) => {
        setThemeAnchorEl(event.currentTarget);
    };

    const handleThemeClose = () => {
        setThemeAnchorEl(null);
    };

    const changeBaseTheme = (base: string) => {
        const currentMode = isDark ? 'dark' : 'light';
        setThemeName(`${base}-${currentMode}`);
        handleThemeClose();
    };

    const baseThemes = [
        { id: 'vs', name: 'Original', color: '#38BDF8' },
        { id: 'tech-minimal', name: 'Tech Minimal', color: '#00B4D8' },
        { id: 'neo-brutalista', name: 'Neo-Brutalista', color: '#708CE7' }
    ];

    const handleLangClick = (event: React.MouseEvent<HTMLElement>) => {
        setLangAnchorEl(event.currentTarget);
    };

    const handleLangClose = () => {
        setLangAnchorEl(null);
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        handleLangClose();
    };

    return (
        <AppBar 
            position="sticky" 
            elevation={0} 
            sx={{ 
                height: '64px',
                bgcolor: 'background.paper',
                borderBottom: 1,
                borderColor: 'divider',
                zIndex: theme.zIndex.appBar
            }}
        >
            <Toolbar sx={{ height: '64px', px: '24px !important', justifyContent: 'space-between' }}>
                
                {/* Left Section: Brand */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <SmartButtonRoundedIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            fontWeight: 800, 
                            fontSize: '22px', 
                            letterSpacing: '-0.5px', 
                            color: 'primary.main',
                            userSelect: 'none'
                        }}
                    >
                        Pehape
                    </Typography>
                    {appVersion && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.divider}`,
                                userSelect: 'none',
                                ml: 0.5
                            }}
                        >
                            v{appVersion.version}
                        </Typography>
                    )}
                </Box>

                {/* Center Section: Dummy Toolbar */}
                <Box 
                    sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        bgcolor: alpha(theme.palette.text.primary, 0.03),
                        px: 2,
                        py: 0.5,
                        borderRadius: theme.shape.borderRadius,
                        border: `${theme.palette.custom.borderWidth || '1px'} solid ${theme.palette.custom.border}`,
                        boxShadow: theme.palette.custom.boxShadow,
                    }}
                >
                    <Typography variant="caption" sx={{ color: 'text.disabled', mr: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.65rem' }}>
                        Herramientas
                    </Typography>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 16, my: 'auto' }} />
                    
                    <Tooltip title="Importar (Deshabilitado)">
                        <span>
                            <IconButton size="small" disabled sx={{ color: 'text.disabled' }}>
                                <FileUploadRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Sincronizar (Deshabilitado)">
                        <span>
                            <IconButton size="small" disabled sx={{ color: 'text.disabled' }}>
                                <SyncRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Preferencias (Deshabilitado)">
                        <span>
                            <IconButton size="small" disabled sx={{ color: 'text.disabled' }}>
                                <SettingsRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Ayuda (Deshabilitado)">
                        <span>
                            <IconButton size="small" disabled sx={{ color: 'text.disabled' }}>
                                <HelpOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                {/* Right Section: Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    
                    {/* Theme Controls Group */}
                    <Box 
                        sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                            borderRadius: theme.shape.borderRadius,
                            border: `${theme.palette.custom.borderWidth || '1px'} solid ${theme.palette.custom.border}`,
                            boxShadow: theme.palette.custom.boxShadow,
                            px: 0.5,
                            py: 0.25,
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            '&:hover': theme.palette.custom.boxShadow ? {
                                boxShadow: 'none',
                                transform: 'translate(2px, 2px)',
                            } : {}
                        }}
                    >
                        {/* Theme Mode Toggle (Light/Dark) */}
                        <Tooltip title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
                            <IconButton onClick={handleThemeModeToggle} color="inherit" size="small">
                                {isDark ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 16, my: 'auto' }} />

                        {/* Theme Style Selector */}
                        <Tooltip title={t('common.theme', 'Estilo del Tema')}>
                            <IconButton onClick={handleThemeClick} color="inherit" size="small">
                                <PaletteRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Menu
                        anchorEl={themeAnchorEl}
                        open={Boolean(themeAnchorEl)}
                        onClose={handleThemeClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        {baseThemes.map((base) => (
                            <MenuItem key={base.id} onClick={() => changeBaseTheme(base.id)} sx={{ gap: 2, minWidth: 200 }}>
                                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: base.color, border: '1px solid', borderColor: 'divider' }} />
                                <Box sx={{ flex: 1, fontSize: '0.875rem' }}>{base.name}</Box>
                                {currentBaseTheme === base.id && <CheckRoundedIcon fontSize="small" color="primary" />}
                            </MenuItem>
                        ))}
                    </Menu>

                    {/* Language Selector */}
                    <Button
                        color="inherit"
                        size="small"
                        startIcon={<LanguageRoundedIcon />}
                        onClick={handleLangClick}
                        sx={{ 
                            textTransform: 'uppercase', 
                            fontWeight: 600,
                            minWidth: '60px',
                            bgcolor: alpha(theme.palette.text.primary, 0.05),
                            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.1) }
                        }}
                    >
                        {i18n.language.split('-')[0]}
                    </Button>

                    <Menu
                        anchorEl={langAnchorEl}
                        open={Boolean(langAnchorEl)}
                        onClose={handleLangClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <MenuItem onClick={() => changeLanguage('es')} sx={{ gap: 1, minWidth: 120 }}>
                            <Box sx={{ flex: 1 }}>Español</Box>
                            {i18n.language.startsWith('es') && <CheckRoundedIcon fontSize="small" color="primary" />}
                        </MenuItem>
                        <MenuItem onClick={() => changeLanguage('en')} sx={{ gap: 1 }}>
                            <Box sx={{ flex: 1 }}>English</Box>
                            {i18n.language.startsWith('en') && <CheckRoundedIcon fontSize="small" color="primary" />}
                        </MenuItem>
                    </Menu>

                </Box>

            </Toolbar>
        </AppBar>
    );
};

export default AppNavbar;
