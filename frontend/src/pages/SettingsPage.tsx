import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Switch,
    FormControlLabel,
    Button,
    Slider,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Divider,
    Alert,
    CircularProgress,
    Snackbar,
    InputAdornment,
    IconButton,
    Tabs,
    Tab
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Save as SaveIcon,
    FolderOpen as FolderOpenIcon,
    Info as InfoIcon,
    Autorenew as UpdateIcon
} from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';
import { useAppVersion } from '../hooks/useAppVersion';

interface SettingsData {
    IMAGES_BASE_PATH: string;
    IMAGES_REPORT_PATH: string;
    TESSERACT_CMD_PATH: string;
    TESSERACT_LANGUAGE: string;
    IMAGE_CONFIDENCE_THRESHOLD: number;
    OCR_CONFIDENCE_THRESHOLD: number;
    STOP_ON_FAILURE: boolean;
}

const SettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [upgradeConfig, setUpgradeConfig] = useState({ update_url: '', local_update_dir: '' });
    const [updateStatus, setUpdateStatus] = useState<any>(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [applyingUpdate, setApplyingUpdate] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const appVersion = useAppVersion();

    useEffect(() => {
        fetchSettings();
        fetchUpgradeConfig();
    }, []);

    const fetchUpgradeConfig = async () => {
        try {
            const res = await fetch('/api/update/config');
            if (res.ok) {
                const data = await res.json();
                setUpgradeConfig(data);
            }
            const statusRes = await fetch('/api/update/status');
            if (statusRes.ok) {
                const data = await statusRes.json();
                setUpdateStatus(data);
            }
        } catch (e) {
            console.error("Error al cargar config del actualizador:", e);
        }
    };

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/');
            if (!response.ok) throw new Error(t('pages.settings.errorLoading'));
            const data = await response.json();
            setSettings(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            setSaving(true);
            
            // Guardar configuraciones OCR/Globales
            const response = await fetch('/api/settings/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (!response.ok) throw new Error(t('pages.settings.errorSaving'));

            // Guardar configuración del actualizador
            const upgResponse = await fetch('/api/update/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(upgradeConfig),
            });
            if (!upgResponse.ok) throw new Error(t('pages.settings.errorSavingUpdater'));

            setSuccessMessage(true);
            setError(null);
            fetchUpgradeConfig(); // Recargar estado actualizado
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const handleUpgradeChange = (field: string, value: any) => {
        setUpgradeConfig({ ...upgradeConfig, [field]: value });
    };

    const checkUpdates = async () => {
        try {
            setCheckingUpdate(true);
            setUpdateMessage(t('pages.settings.searchingUpdates'));
            const res = await fetch('/api/update/check', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.status === "downloading") {
                    setUpdateMessage(t('pages.settings.downloadingUpdate'));
                    // Poll status
                    const interval = setInterval(async () => {
                        const sRes = await fetch('/api/update/status');
                        if (sRes.ok) {
                            const sData = await sRes.json();
                            setUpdateStatus(sData);
                            if (sData.download_state.status === "completed") {
                                clearInterval(interval);
                                setUpdateMessage(t('pages.settings.downloadComplete'));
                                setCheckingUpdate(false);
                            } else if (sData.download_state.status === "error") {
                                clearInterval(interval);
                                setUpdateMessage(t('pages.settings.downloadError', { error: sData.download_state.error_message }));
                                setCheckingUpdate(false);
                            }
                        }
                    }, 2000);
                } else if (data.status === "ready") {
                    setUpdateMessage(t('pages.settings.updateReady', { version: data.version }));
                    setCheckingUpdate(false);
                    const statusRes = await fetch('/api/update/status');
                    if (statusRes.ok) setUpdateStatus(await statusRes.json());
                } else {
                    setUpdateMessage(t('pages.settings.noUpdatesFound'));
                    setCheckingUpdate(false);
                    const statusRes = await fetch('/api/update/status');
                    if (statusRes.ok) setUpdateStatus(await statusRes.json());
                }
            } else {
                setUpdateMessage(t('pages.settings.checkUpdatesFailed'));
                setCheckingUpdate(false);
            }
        } catch (err) {
            setUpdateMessage(t('pages.settings.checkUpdatesConnError'));
            setCheckingUpdate(false);
        }
    };

    const applyUpdate = async () => {
        if (!window.confirm(t('pages.settings.confirmApplyUpdate'))) {
            return;
        }
        try {
            setApplyingUpdate(true);
            const res = await fetch('/api/update/apply', { method: 'POST' });
            if (res.ok) {
                setUpdateMessage(t('pages.settings.applyingUpdate'));
                // Esperar a que se apague y recargar la página tras 8 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 8000);
            } else {
                const data = await res.json();
                setError(data.detail || t('pages.settings.applyUpdateFailed'));
                setApplyingUpdate(false);
            }
        } catch (err) {
            setError(t('pages.settings.applyUpdateConnError'));
            setApplyingUpdate(false);
        }
    };

    const handleChange = (field: keyof SettingsData, value: any) => {
        if (settings) {
            setSettings({ ...settings, [field]: value });
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AppToolbar title={t('pages.settings.title')} icon={<SettingsIcon sx={{ fontSize: 32 }} />} showControls={false} />
            
            <Box sx={{ p: 1.5, flex: 1, overflow: 'hidden', backgroundColor: 'background.default', display: 'flex', flexDirection: 'column' }}>
                <Paper elevation={0} sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    
                    <Tabs
                        value={tabValue}
                        onChange={(_, val) => setTabValue(val)}
                        variant="fullWidth"
                        sx={{
                            mb: 2.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            '& .MuiTabs-flexContainer': {
                                gap: 1
                            },
                            '& .MuiTab-root': {
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                minHeight: 44,
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 1,
                                alignItems: 'center'
                            }
                        }}
                    >
                        <Tab label={t('pages.settings.tabAutoOcr')} icon={<SettingsIcon sx={{ fontSize: 18 }} />} />
                        <Tab label={t('pages.settings.tabUpdates')} icon={<UpdateIcon sx={{ fontSize: 18 }} />} />
                        <Tab label={t('pages.settings.tabSysInfo')} icon={<InfoIcon sx={{ fontSize: 18 }} />} />
                    </Tabs>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="600" fontSize="1.1rem">
                            {tabValue === 0 && t('pages.settings.headerAuto')}
                            {tabValue === 1 && t('pages.settings.headerUpdates')}
                            {tabValue === 2 && t('pages.settings.headerSysInfo')}
                        </Typography>
                        {tabValue !== 2 && (
                            <Button 
                                variant="contained" 
                                color="primary" 
                                size="small"
                                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} 
                                onClick={handleSave}
                                disabled={saving || !settings}
                            >
                                {t('common.save')}
                            </Button>
                        )}
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2, py: 0.5 }}>{error}</Alert>}

                    {loading || !settings ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 2, pr: 1.5, pl: 0.5 }}>
                            
                            {/* TAB 0: Automatización y OCR */}
                            {tabValue === 0 && (
                                <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
                                    
                                    {/* Left Column: Tesseract & Image Paths */}
                                    <Box sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {/* --- Tesseract Configuration --- */}
                                        <Typography variant="subtitle2" fontWeight="600" color="primary">{t('pages.settings.ocrConfig')}</Typography>
                                        
                                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                                            <Box sx={{ flex: 3 }}>
                                                <TextField 
                                                    label={t('pages.settings.tesseractPath')} 
                                                    variant="outlined" 
                                                    fullWidth 
                                                    value={settings.TESSERACT_CMD_PATH}
                                                    onChange={(e) => handleChange('TESSERACT_CMD_PATH', e.target.value)}
                                                    placeholder={t('pages.settings.tesseractPathPlaceholder')}
                                                    size="small"
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                 <IconButton onClick={async () => {
                                                                    try {
                                                                        const currentPath = encodeURIComponent(settings.TESSERACT_CMD_PATH || '');
                                                                        const res = await fetch(`/api/settings/browse_file?current_path=${currentPath}`);
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            if (data.path) {
                                                                                handleChange('TESSERACT_CMD_PATH', data.path);
                                                                            }
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Error al abrir explorador:", err);
                                                                    }
                                                                }} edge="end" size="small">
                                                                    <FolderOpenIcon fontSize="small" />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 160 }}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>{t('pages.settings.tesseractLanguage')}</InputLabel>
                                                    <Select
                                                        value={settings.TESSERACT_LANGUAGE}
                                                        label={t('pages.settings.tesseractLanguage')}
                                                        onChange={(e) => handleChange('TESSERACT_LANGUAGE', e.target.value)}
                                                    >
                                                        <MenuItem value="spa">{t('pages.settings.langSpa')}</MenuItem>
                                                        <MenuItem value="eng">{t('pages.settings.langEng')}</MenuItem>
                                                        <MenuItem value="spa+eng">{t('pages.settings.langBoth')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                        </Box>

                                        <Divider />

                                        {/* --- Image Paths --- */}
                                        <Typography variant="subtitle2" fontWeight="600" color="primary">{t('pages.settings.imagesConfig')}</Typography>
                                        
                                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                                            <Box sx={{ flex: 1 }}>
                                                <TextField 
                                                    label={t('pages.settings.imagesBasePath')} 
                                                    variant="outlined" 
                                                    fullWidth 
                                                    value={settings.IMAGES_BASE_PATH}
                                                    onChange={(e) => handleChange('IMAGES_BASE_PATH', e.target.value)}
                                                    size="small"
                                                    placeholder={t('pages.settings.imagesBasePathPlaceholder')}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton onClick={async () => {
                                                                    try {
                                                                        const currentPath = encodeURIComponent(settings.IMAGES_BASE_PATH || '');
                                                                        const res = await fetch(`/api/settings/browse_directory?current_path=${currentPath}`);
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            if (data.path) {
                                                                                handleChange('IMAGES_BASE_PATH', data.path);
                                                                            }
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Error al abrir explorador:", err);
                                                                    }
                                                                }} edge="end" size="small">
                                                                    <FolderOpenIcon fontSize="small" />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <TextField 
                                                    label={t('pages.settings.imagesReportPath')} 
                                                    variant="outlined" 
                                                    fullWidth 
                                                    value={settings.IMAGES_REPORT_PATH}
                                                    onChange={(e) => handleChange('IMAGES_REPORT_PATH', e.target.value)}
                                                    size="small"
                                                    placeholder={t('pages.settings.imagesReportPathPlaceholder')}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton onClick={async () => {
                                                                    try {
                                                                        const currentPath = encodeURIComponent(settings.IMAGES_REPORT_PATH || '');
                                                                        const res = await fetch(`/api/settings/browse_directory?current_path=${currentPath}`);
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            if (data.path) {
                                                                                handleChange('IMAGES_REPORT_PATH', data.path);
                                                                            }
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Error al abrir explorador:", err);
                                                                    }
                                                                }} edge="end" size="small">
                                                                    <FolderOpenIcon fontSize="small" />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>

                                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

                                    {/* Right Column: Sliders and Switch */}
                                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="600" color="primary">{t('pages.settings.executionParameters')}</Typography>
                                        
                                        <Box>
                                            <Typography gutterBottom variant="caption" color="text.secondary" fontWeight="600">
                                                {t('pages.settings.ocrConfidence')}
                                            </Typography>
                                            <Box sx={{ px: 1 }}>
                                                <Slider
                                                    value={settings.OCR_CONFIDENCE_THRESHOLD}
                                                    onChange={(_, val) => handleChange('OCR_CONFIDENCE_THRESHOLD', val as number)}
                                                    valueLabelDisplay="auto"
                                                    step={1}
                                                    min={0}
                                                    max={100}
                                                    size="small"
                                                    marks={[
                                                        { value: 0, label: '0%' },
                                                        { value: 100, label: '100%' }
                                                    ]}
                                                />
                                            </Box>
                                        </Box>
                                        
                                        <Box>
                                            <Typography gutterBottom variant="caption" color="text.secondary" fontWeight="600">
                                                {t('pages.settings.imageConfidence')}
                                            </Typography>
                                            <Box sx={{ px: 1 }}>
                                                <Slider
                                                    value={settings.IMAGE_CONFIDENCE_THRESHOLD}
                                                    onChange={(_, val) => handleChange('IMAGE_CONFIDENCE_THRESHOLD', val as number)}
                                                    valueLabelDisplay="auto"
                                                    step={1}
                                                    min={0}
                                                    max={100}
                                                    size="small"
                                                    marks={[
                                                        { value: 0, label: '0%' },
                                                        { value: 100, label: '100%' }
                                                    ]}
                                                />
                                            </Box>
                                        </Box>
                                        
                                        <Box sx={{ pt: 1 }}>
                                            <FormControlLabel
                                                control={
                                                    <Switch 
                                                        checked={settings.STOP_ON_FAILURE} 
                                                        onChange={(e) => handleChange('STOP_ON_FAILURE', e.target.checked)}
                                                        color="primary"
                                                        size="small"
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="600">{t('pages.settings.stopOnFailure')}</Typography>
                                                        <Typography variant="caption" color="text.secondary" display="block">STOP_ON_FAILURE</Typography>
                                                    </Box>
                                                }
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            {/* TAB 1: Actualizaciones */}
                            {tabValue === 1 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {/* --- System Updates --- */}
                                    <Typography variant="subtitle2" fontWeight="600" color="primary">{t('pages.settings.sysUpdates')}</Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        
                                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                                            <Box sx={{ flex: 1 }}>
                                                <TextField
                                                    label={t('pages.settings.updateUrl')}
                                                    variant="outlined"
                                                    fullWidth
                                                    value={upgradeConfig.update_url}
                                                    onChange={(e) => handleUpgradeChange('update_url', e.target.value)}
                                                    size="small"
                                                    placeholder={t('pages.settings.updateUrlPlaceholder')}
                                                />
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <TextField
                                                    label={t('pages.settings.localUpdateDir')}
                                                    variant="outlined"
                                                    fullWidth
                                                    value={upgradeConfig.local_update_dir}
                                                    onChange={(e) => handleUpgradeChange('local_update_dir', e.target.value)}
                                                    size="small"
                                                    placeholder={t('pages.settings.localUpdateDirPlaceholder')}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton onClick={async () => {
                                                                    try {
                                                                        const currentPath = encodeURIComponent(upgradeConfig.local_update_dir || '');
                                                                        const res = await fetch(`/api/settings/browse_directory?current_path=${currentPath}`);
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            if (data.path) {
                                                                                handleUpgradeChange('local_update_dir', data.path);
                                                                            }
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Error al abrir explorador:", err);
                                                                    }
                                                                }} edge="end" size="small">
                                                                    <FolderOpenIcon fontSize="small" />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                disabled={checkingUpdate || applyingUpdate}
                                                onClick={checkUpdates}
                                                size="small"
                                            >
                                                {checkingUpdate ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                                                {t('pages.settings.btnCheckUpdates')}
                                            </Button>

                                            {updateStatus?.local_update_available && (
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    disabled={checkingUpdate || applyingUpdate}
                                                    onClick={applyUpdate}
                                                    size="small"
                                                >
                                                    {applyingUpdate ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
                                                    {t('pages.settings.btnInstallUpdate', { version: updateStatus.local_update_version })}
                                                </Button>
                                            )}
                                        </Box>

                                        {updateMessage && (
                                            <Alert severity={updateMessage.toLowerCase().includes("error") ? "error" : "info"} sx={{ py: 0.5 }}>
                                                {updateMessage}
                                            </Alert>
                                        )}
                                    </Box>
                                </Box>
                            )}

                            {/* TAB 2: Información */}
                            {tabValue === 2 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {/* --- Version Info --- */}
                                    <Typography variant="subtitle2" fontWeight="600" color="primary">{t('pages.settings.sysInfo')}</Typography>
                                    
                                    {appVersion ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <Box sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                                                gap: 2
                                            }}>
                                                <Paper elevation={0} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, backgroundColor: 'rgba(56, 189, 248, 0.04)', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight="600">
                                                        {t('pages.settings.appVersion')}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="700" color="primary">
                                                        v{appVersion.version}
                                                    </Typography>
                                                </Paper>
                                                
                                                <Paper elevation={0} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, backgroundColor: 'rgba(56, 189, 248, 0.04)', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight="600">
                                                        {t('pages.settings.buildDate')}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="700">
                                                        {appVersion.build_date}
                                                    </Typography>
                                                </Paper>
                                                
                                                <Paper elevation={0} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, backgroundColor: 'rgba(56, 189, 248, 0.04)', borderColor: 'divider' }}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight="600">
                                                        {t('pages.settings.minBaseVersion')}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="700">
                                                        {appVersion.min_base_version}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            
                                            <Paper elevation={0} sx={{ p: 2, backgroundColor: 'background.paper', maxHeight: 240, overflowY: 'auto', border: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="subtitle2" fontWeight="600" color="text.primary" gutterBottom>
                                                    {t('pages.settings.changelog')}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.5, fontSize: '0.85rem' }}>
                                                    {appVersion.changelog}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    )}
                                </Box>
                            )}

                        </Box>
                    )}
                </Paper>
            </Box>

            <Snackbar
                open={successMessage}
                autoHideDuration={3000}
                onClose={() => setSuccessMessage(false)}
                message={t('pages.settings.savedSuccess')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
};

export default SettingsPage;
