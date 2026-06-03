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
    Snackbar
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';

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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

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
            const response = await fetch('/api/settings/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (!response.ok) throw new Error('Error al guardar configuraciones');
            setSuccessMessage(true);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Error desconocido');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof SettingsData, value: any) => {
        if (settings) {
            setSettings({ ...settings, [field]: value });
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AppToolbar title={t('pages.settings.title', 'Configuraciones')} icon={<SettingsIcon sx={{ fontSize: 32 }} />} />
            
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
                            />
                            
                            <TextField 
                                label="Ruta de Evidencias (IMAGES_REPORT_PATH)" 
                                variant="outlined" 
                                fullWidth 
                                value={settings.IMAGES_REPORT_PATH}
                                onChange={(e) => handleChange('IMAGES_REPORT_PATH', e.target.value)}
                                size="small"
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
