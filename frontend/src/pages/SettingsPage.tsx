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
    IconButton
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon, FolderOpen as FolderOpenIcon } from '@mui/icons-material';
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
            if (!response.ok) throw new Error('Error al cargar configuraciones');
            const data = await response.json();
            setSettings(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Error desconocido');
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
            if (!response.ok) throw new Error('Error al guardar configuraciones');

            // Guardar configuración del actualizador
            const upgResponse = await fetch('/api/update/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(upgradeConfig),
            });
            if (!upgResponse.ok) throw new Error('Error al guardar configuración del actualizador');

            setSuccessMessage(true);
            setError(null);
            fetchUpgradeConfig(); // Recargar estado actualizado
        } catch (err: any) {
            setError(err.message || 'Error desconocido');
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
            setUpdateMessage("Buscando actualizaciones...");
            const res = await fetch('/api/update/check', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.status === "downloading") {
                    setUpdateMessage("Descargando actualización en segundo plano...");
                    // Poll status
                    const interval = setInterval(async () => {
                        const sRes = await fetch('/api/update/status');
                        if (sRes.ok) {
                            const sData = await sRes.json();
                            setUpdateStatus(sData);
                            if (sData.download_state.status === "completed") {
                                clearInterval(interval);
                                setUpdateMessage("Descarga completa. Actualización lista.");
                                setCheckingUpdate(false);
                            } else if (sData.download_state.status === "error") {
                                clearInterval(interval);
                                setUpdateMessage(`Error al descargar: ${sData.download_state.error_message}`);
                                setCheckingUpdate(false);
                            }
                        }
                    }, 2000);
                } else if (data.status === "ready") {
                    setUpdateMessage(`Actualización v${data.version} lista localmente.`);
                    setCheckingUpdate(false);
                    const statusRes = await fetch('/api/update/status');
                    if (statusRes.ok) setUpdateStatus(await statusRes.json());
                } else {
                    setUpdateMessage("No se encontraron actualizaciones nuevas.");
                    setCheckingUpdate(false);
                    const statusRes = await fetch('/api/update/status');
                    if (statusRes.ok) setUpdateStatus(await statusRes.json());
                }
            } else {
                setUpdateMessage("Fallo al buscar actualizaciones.");
                setCheckingUpdate(false);
            }
        } catch (err) {
            setUpdateMessage("Error de conexión al buscar actualizaciones.");
            setCheckingUpdate(false);
        }
    };

    const applyUpdate = async () => {
        if (!window.confirm("¿Está seguro de que desea aplicar la actualización? El servidor se reiniciará automáticamente y perderá la conexión por unos segundos.")) {
            return;
        }
        try {
            setApplyingUpdate(true);
            const res = await fetch('/api/update/apply', { method: 'POST' });
            if (res.ok) {
                setUpdateMessage("Aplicando actualización y reiniciando el servidor...");
                // Esperar a que se apague y recargar la página tras 8 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 8000);
            } else {
                const data = await res.json();
                setError(data.detail || "Fallo al iniciar el actualizador");
                setApplyingUpdate(false);
            }
        } catch (err) {
            setError("Error al enviar comando de actualización");
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
            <AppToolbar title={t('pages.settings.title', 'Configuraciones')} icon={<SettingsIcon sx={{ fontSize: 32 }} />} showControls={false} />
            
            <Box sx={{ px: 4, pt: 4, flex: 1, overflowY: 'auto', backgroundColor: 'background.default' }}>
                <Paper elevation={0} sx={{ p: 4, mb: '5px', maxWidth: 800, mx: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6" fontWeight="600">Parámetros Globales</Typography>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} 
                            onClick={handleSave}
                            disabled={saving || !settings}
                        >
                            {t('common.save', 'Guardar')}
                        </Button>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                    {loading || !settings ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            
                            {/* --- Tesseract Configuration --- */}
                            <Typography variant="subtitle1" fontWeight="600" color="primary">Configuración OCR (Tesseract)</Typography>
                            <TextField 
                                label="Ruta de Tesseract (TESSERACT_CMD_PATH)" 
                                variant="outlined" 
                                fullWidth 
                                value={settings.TESSERACT_CMD_PATH}
                                onChange={(e) => handleChange('TESSERACT_CMD_PATH', e.target.value)}
                                helperText="Ruta absoluta al ejecutable tesseract.exe"
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
                                            }} edge="end">
                                                <FolderOpenIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            
                            <FormControl fullWidth size="small">
                                <InputLabel>Idioma OCR (TESSERACT_LANGUAGE)</InputLabel>
                                <Select
                                    value={settings.TESSERACT_LANGUAGE}
                                    label="Idioma OCR (TESSERACT_LANGUAGE)"
                                    onChange={(e) => handleChange('TESSERACT_LANGUAGE', e.target.value)}
                                >
                                    <MenuItem value="spa">Español (spa)</MenuItem>
                                    <MenuItem value="eng">Inglés (eng)</MenuItem>
                                    <MenuItem value="spa+eng">Español + Inglés</MenuItem>
                                </Select>
                            </FormControl>

                            <Box>
                                <Typography gutterBottom variant="body2" color="text.secondary">
                                    Umbral de Confianza OCR (OCR_CONFIDENCE_THRESHOLD)
                                </Typography>
                                <Box sx={{ px: 2 }}>
                                    <Slider
                                        value={settings.OCR_CONFIDENCE_THRESHOLD}
                                        onChange={(_, val) => handleChange('OCR_CONFIDENCE_THRESHOLD', val as number)}
                                        valueLabelDisplay="auto"
                                        step={1}
                                        min={0}
                                        max={100}
                                        marks={[
                                            { value: 0, label: '0%' },
                                            { value: 100, label: '100%' }
                                        ]}
                                    />
                                </Box>
                            </Box>

                            <Divider />

                            {/* --- Image Paths --- */}
                            <Typography variant="subtitle1" fontWeight="600" color="primary">Configuración de Imágenes y Rutas</Typography>
                            <TextField 
                                label="Ruta Base de Imágenes (IMAGES_BASE_PATH)" 
                                variant="outlined" 
                                fullWidth 
                                value={settings.IMAGES_BASE_PATH}
                                onChange={(e) => handleChange('IMAGES_BASE_PATH', e.target.value)}
                                size="small"
                                helperText="Ruta absoluta o relativa a la carpeta de imágenes"
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
                                            }} edge="end">
                                                <FolderOpenIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            
                            <TextField 
                                label="Ruta de Evidencias (IMAGES_REPORT_PATH)" 
                                variant="outlined" 
                                fullWidth 
                                value={settings.IMAGES_REPORT_PATH}
                                onChange={(e) => handleChange('IMAGES_REPORT_PATH', e.target.value)}
                                size="small"
                                helperText="Ruta absoluta o relativa a la carpeta para guardar capturas de reportes"
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
                                            }} edge="end">
                                                <FolderOpenIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                            
                            <Box>
                                <Typography gutterBottom variant="body2" color="text.secondary">
                                    Umbral de Coincidencia de Imágenes (IMAGE_CONFIDENCE_THRESHOLD)
                                </Typography>
                                <Box sx={{ px: 2 }}>
                                    <Slider
                                        value={settings.IMAGE_CONFIDENCE_THRESHOLD}
                                        onChange={(_, val) => handleChange('IMAGE_CONFIDENCE_THRESHOLD', val as number)}
                                        valueLabelDisplay="auto"
                                        step={1}
                                        min={0}
                                        max={100}
                                        marks={[
                                            { value: 0, label: '0%' },
                                            { value: 100, label: '100%' }
                                        ]}
                                    />
                                </Box>
                            </Box>

                            <Divider />

                            {/* --- Execution Engine --- */}
                            <Typography variant="subtitle1" fontWeight="600" color="primary">Motor de Ejecución</Typography>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={settings.STOP_ON_FAILURE} 
                                        onChange={(e) => handleChange('STOP_ON_FAILURE', e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body1">Detener en el Primer Fallo (STOP_ON_FAILURE)</Typography>
                                        <Typography variant="caption" color="text.secondary">Si está activo, detiene la ejecución del flujo cuando un escenario falla.</Typography>
                                    </Box>
                                }
                            />

                            <Divider sx={{ my: 1 }} />

                            {/* --- System Updates --- */}
                            <Typography variant="subtitle1" fontWeight="600" color="primary">Actualizaciones del Sistema</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                                <TextField
                                    label="URL del Servidor de Actualizaciones (UPDATE_URL)"
                                    variant="outlined"
                                    fullWidth
                                    value={upgradeConfig.update_url}
                                    onChange={(e) => handleUpgradeChange('update_url', e.target.value)}
                                    size="small"
                                    helperText="Dirección HTTP/HTTPS que sirve las actualizaciones del sistema"
                                />

                                <TextField
                                    label="Carpeta Local de Actualizaciones (LOCAL_UPDATE_DIR)"
                                    variant="outlined"
                                    fullWidth
                                    value={upgradeConfig.local_update_dir}
                                    onChange={(e) => handleUpgradeChange('local_update_dir', e.target.value)}
                                    size="small"
                                    helperText="Carpeta donde se comprueban y descargan los archivos ZIP de actualización"
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
                                                }} edge="end">
                                                    <FolderOpenIcon />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />

                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        disabled={checkingUpdate || applyingUpdate}
                                        onClick={checkUpdates}
                                        size="small"
                                    >
                                        {checkingUpdate ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                                        Buscar Actualizaciones
                                    </Button>

                                    {updateStatus?.local_update_available && (
                                        <Button
                                            variant="contained"
                                            color="secondary"
                                            disabled={checkingUpdate || applyingUpdate}
                                            onClick={applyUpdate}
                                            size="small"
                                        >
                                            {applyingUpdate ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
                                            Instalar Actualización v{updateStatus.local_update_version}
                                        </Button>
                                    )}
                                </Box>

                                {updateMessage && (
                                    <Alert severity={updateMessage.toLowerCase().includes("error") ? "error" : "info"} sx={{ py: 0.5 }}>
                                        {updateMessage}
                                    </Alert>
                                )}
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            {/* --- Version Info --- */}
                            <Typography variant="subtitle1" fontWeight="600" color="primary">Información del Sistema</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                                    <strong>Versión de la Aplicación:</strong>
                                    <span style={{
                                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38BDF8',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem'
                                    }}>
                                        {appVersion ? `v${appVersion.version}` : 'Cargando...'}
                                    </span>
                                </Typography>
                                {appVersion && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Fecha de Compilación:</strong> {appVersion.build_date}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Versión Mínima Requerida:</strong> {appVersion.min_base_version}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Changelog / Novedades:</strong> {appVersion.changelog}
                                        </Typography>
                                    </>
                                )}
                            </Box>

                        </Box>
                    )}
                </Paper>
            </Box>

            <Snackbar
                open={successMessage}
                autoHideDuration={3000}
                onClose={() => setSuccessMessage(false)}
                message="Configuraciones guardadas correctamente"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
};

export default SettingsPage;
