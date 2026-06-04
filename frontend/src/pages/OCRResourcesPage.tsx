import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Card, CardContent, Grid, Chip, CircularProgress, Button, IconButton, Snackbar, Alert, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Image as ImageIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';

interface OCRImage {
    relative_path: string;
    filename: string;
    key_text: string;
    full_path_parts: string[];
    associated_texts?: string[];
    mapped_to?: { feature: string; tag: string | null; text?: string }[];
    is_mapped?: boolean;
}

const OCRResourcesPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [images, setImages] = useState<OCRImage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterType, setFilterType] = useState<'all' | 'generic' | 'specific'>('all');

    // Snackbar state
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const response = await fetch(`/api/ocr-images?t=${Date.now()}`);
                if (!response.ok) {
                    throw new Error(`Error fetching images: ${response.statusText}`);
                }
                const data = await response.json();
                setImages(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, []);

    // Sorting and filtering logic
    const sortedImages = [...images].sort((a, b) =>
        (a.key_text || "").localeCompare(b.key_text || "")
    );

    const filteredImages = sortedImages.filter(img => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesFilename = img.filename.toLowerCase().includes(query);
            const matchesKeyText = img.key_text?.toLowerCase().includes(query);
            const matchesAssociated = img.associated_texts?.some(text =>
                text.toLowerCase().includes(query)
            );
            const matchesMapped = img.mapped_to?.some(m =>
                m.feature.toLowerCase().includes(query) ||
                m.text?.toLowerCase().includes(query)
            );

            if (!matchesFilename && !matchesKeyText && !matchesAssociated && !matchesMapped) {
                return false;
            }
        }


        // Filter by type
        if (filterType === 'generic') {
            const isGeneric = img.full_path_parts[1] === 'generic' ||
                img.mapped_to?.some(m => m.feature === 'generic');
            if (!isGeneric) {
                return false;
            }
        } else if (filterType === 'specific') {
            const isGeneric = img.full_path_parts[1] === 'generic' ||
                img.mapped_to?.some(m => m.feature === 'generic');
            if (isGeneric) {
                return false;
            }
        }

        return true;
    });

    const handleDeleteImage = async (img: OCRImage) => {
        if (!window.confirm(t('editor.gallery.delete_confirm', { name: img.key_text }))) {
            return;
        }

        try {
            const response = await fetch(`/api/resources/images/${encodeURIComponent(img.relative_path)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t('editor.gallery.delete_error'));
            }

            setSnackbarMessage(t('editor.gallery.delete_success'));
            setSnackbarOpen(true);

            // Refresh list
            const updatedImages = images.filter(i => i.relative_path !== img.relative_path);
            setImages(updatedImages);
        } catch (err: any) {
            console.error("Delete error", err);
            setSnackbarMessage(`Error: ${err.message}`);
            setSnackbarOpen(true);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Typography color="error">Error: {error}</Typography></Box>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title={t('editor.gallery.title')} icon={<ImageIcon sx={{ fontSize: 32 }} />} showControls={false} />
            <Box sx={{ p: 4, flex: 1, overflowY: 'auto' }}>
                <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                    {t('editor.gallery.subtitle')}
                </Typography>

                {/* Search and Filter Bar */}
                <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        placeholder={t('editor.gallery.search_placeholder', { defaultValue: 'Buscar por nombre, texto o feature...' })}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ flex: '1 1 300px', minWidth: '200px' }}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>{t('editor.gallery.filter_label', { defaultValue: 'Filtrar' })}</InputLabel>
                        <Select
                            value={filterType}
                            label={t('editor.gallery.filter_label', { defaultValue: 'Filtrar' })}
                            onChange={(e) => setFilterType(e.target.value as 'all' | 'generic' | 'specific')}
                        >
                            <MenuItem value="all">{t('editor.gallery.filter_all', { defaultValue: 'Todo' })}</MenuItem>
                            <MenuItem value="generic">{t('editor.gallery.filter_generic', { defaultValue: 'Imágenes genéricas' })}</MenuItem>
                            <MenuItem value="specific">{t('editor.gallery.filter_specific', { defaultValue: 'Imágenes específicas' })}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* Results Counter */}
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    {t('editor.gallery.showing_results', {
                        defaultValue: 'Mostrando {{count}} de {{total}} imágenes',
                        count: filteredImages.length,
                        total: images.length
                    })}
                </Typography>

                {filteredImages.length === 0 ? (
                    <Typography variant="body1">
                        {searchQuery || filterType !== 'all'
                            ? t('editor.gallery.no_results', { defaultValue: 'No se encontraron imágenes con los filtros aplicados' })
                            : t('editor.gallery.no_images')}
                    </Typography>
                ) : (
                    <Grid container spacing={3}>
                        {filteredImages.map((img) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={img.relative_path}>
                                <Card elevation={2}>
                                    <Box sx={{
                                        height: 150,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        bgcolor: '#f5f5f5',
                                        overflow: 'hidden'
                                    }}>
                                        <img
                                            src={`/api/resources/images/${img.relative_path}`}
                                            alt={img.key_text}
                                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                                        />
                                    </Box>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main', lineHeight: 1.2 }}>
                                                    {img.mapped_to && img.mapped_to.length > 0
                                                        ? Array.from(new Set(img.mapped_to.map(m => m.text).filter(Boolean))).join(' / ')
                                                        : `"${img.key_text}"`}
                                                </Typography>
                                                {(img.full_path_parts[1] === 'generic' || img.mapped_to?.some(m => m.feature === 'generic')) && (
                                                    <Chip
                                                        label={t('editor.upload_dialog.generic_label')}
                                                        size="small"
                                                        color="info"
                                                        variant="filled"
                                                        sx={{ mt: 0.5, height: 18, fontSize: '0.6rem', fontWeight: 'bold' }}
                                                    />
                                                )}
                                            </Box>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteImage(img)}
                                                title={t('editor.gallery.delete_tooltip')}
                                                sx={{ ml: 1, mt: -0.5 }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>

                                        {/* Image ID (Filename) */}
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontFamily: 'monospace', fontSize: '0.6rem' }}>
                                            ID: {img.filename}
                                        </Typography>

                                        {/* Associated Steps from Mapping */}
                                        {img.associated_texts && img.associated_texts.length > 0 && (
                                            <Box sx={{ mt: 1 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                                                    {t('editor.gallery.associated_steps')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                    {Array.from(new Set(img.associated_texts)).map((text, idx) => (
                                                        <Chip key={idx} label={text} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, bgcolor: 'rgba(0,0,0,0.02)' }} />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Related Features Mapping */}
                                        {img.mapped_to && img.mapped_to.length > 0 && (
                                            <Box sx={{ mt: 1.5 }}>
                                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                                                    {t('editor.gallery.usage_in_features')}
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                    {img.mapped_to.map((m, idx) => {
                                                        const isGeneric = m.feature === 'generic' || img.full_path_parts[1] === 'generic';
                                                        const featureLabel = isGeneric
                                                            ? t('editor.ocr_association.generic')
                                                            : (m.feature.length > 40 ? `...${m.feature.substring(m.feature.length - 40)}` : m.feature);

                                                        return (
                                                            <Typography
                                                                key={idx}
                                                                variant="caption"
                                                                sx={{
                                                                    fontSize: '0.6rem',
                                                                    display: 'block',
                                                                    bgcolor: isGeneric ? 'rgba(25, 118, 210, 0.08)' : 'rgba(0,0,0,0.03)',
                                                                    p: 0.5,
                                                                    borderRadius: 1,
                                                                    borderLeft: '2px solid',
                                                                    borderColor: isGeneric ? 'primary.main' : 'divider',
                                                                    wordBreak: 'break-all'
                                                                }}
                                                                title={isGeneric ? t('editor.upload_dialog.generic_hint') : m.feature}
                                                            >
                                                                <strong>{isGeneric ? featureLabel : `"${featureLabel}"`}</strong> &rarr; "{m.text || t('editor.gallery.no_text')}"
                                                            </Typography>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}

                <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert onClose={handleCloseSnackbar} severity="warning" sx={{ width: '100%' }}>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default OCRResourcesPage;
