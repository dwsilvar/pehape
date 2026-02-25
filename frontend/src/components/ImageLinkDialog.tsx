import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Grid,
    Card,
    CardActionArea,
    CardContent,
    CircularProgress,
    InputAdornment,
    Checkbox,
    FormControlLabel,
    Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface OCRImage {
    relative_path: string;
    filename: string;
    key_text: string;
    full_path_parts: string[];
    associated_texts?: string[];
    is_mapped?: boolean;
}

interface ImageLinkDialogProps {
    open: boolean;
    onClose: () => void;
    initialText: string;
    initialTag: string | null;
    featurePath: string;
    onLink: (sourcePath: string, text: string, tag: string, isGeneric: boolean) => Promise<void>;
}

export const ImageLinkDialog: React.FC<ImageLinkDialogProps> = ({
    open,
    onClose,
    initialText,
    initialTag,
    featurePath,
    onLink
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [images, setImages] = useState<OCRImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<OCRImage | null>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Linking parameters
    const [text, setText] = useState(initialText);
    const [tag, setTag] = useState(initialTag || '');
    const [isGeneric, setIsGeneric] = useState(false);

    useEffect(() => {
        if (open) {
            fetchImages();
            setText(initialText);
            setTag(initialTag || '');
            setSearchTerm('');
            setSelectedImage(null);
            setError(null);
            setIsLinking(false);
            setIsGeneric(false);
        }
    }, [open, initialText, initialTag]);

    const fetchImages = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/ocr-images');
            if (response.ok) {
                const data = await response.json();

                // Sort images: those matching initialText first
                const sorted = (data as OCRImage[]).sort((a, b) => {
                    const matchA = a.key_text?.toLowerCase() === initialText.toLowerCase();
                    const matchB = b.key_text?.toLowerCase() === initialText.toLowerCase();
                    if (matchA && !matchB) return -1;
                    if (!matchA && matchB) return 1;
                    return 0;
                });

                setImages(sorted);

                // Auto-select first if it matches exactly
                if (sorted.length > 0 && sorted[0].key_text?.toLowerCase() === initialText.toLowerCase()) {
                    setSelectedImage(sorted[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching images", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLink = async () => {
        if (!selectedImage) return;
        if (!isGeneric && !tag) {
            setError(t('editor.upload_dialog.error_tag'));
            return;
        }

        setIsLinking(true);
        try {
            await onLink(selectedImage.relative_path, text, tag, isGeneric);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al vincular');
        } finally {
            setIsLinking(false);
        }
    };

    const filteredImages = images.filter(img =>
        img.key_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        img.relative_path.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('editor.link_dialog.title', 'Vincular Imagen OCR Existente')}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label={t('editor.upload_dialog.text_label')}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={t('editor.upload_dialog.tag_label')}
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            fullWidth
                            disabled={isGeneric}
                        />
                    </Box>

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isGeneric}
                                onChange={(e) => setIsGeneric(e.target.checked)}
                                color="primary"
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">{t('editor.upload_dialog.generic_label')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('editor.upload_dialog.generic_hint')}
                                </Typography>
                            </Box>
                        }
                    />

                    <Divider sx={{ my: 1 }} />

                    <TextField
                        placeholder={t('common.search', 'Buscar imagen...')}
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }
                        }}
                    />

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1 }}>
                            <Grid container spacing={2}>
                                {filteredImages.map((img) => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={img.relative_path}>
                                        <Card
                                            elevation={selectedImage?.relative_path === img.relative_path ? 8 : 1}
                                            sx={{
                                                border: selectedImage?.relative_path === img.relative_path ? 2 : 0,
                                                borderColor: 'primary.main',
                                                height: '100%'
                                            }}
                                        >
                                            <CardActionArea onClick={() => setSelectedImage(img)} sx={{ height: '100%' }}>
                                                <Box sx={{
                                                    height: 100,
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
                                                <CardContent sx={{ p: 1 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }} noWrap>
                                                        {img.key_text}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block' }} noWrap>
                                                        {img.relative_path}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ))}
                                {filteredImages.length === 0 && (
                                    <Grid size={{ xs: 12 }}>
                                        <Typography variant="body2" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                            No se encontraron imágenes.
                                        </Typography>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>
                    )}

                    {error && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isLinking}>{t('common.cancel')}</Button>
                <Button
                    onClick={handleLink}
                    variant="contained"
                    disabled={isLinking || !selectedImage}
                >
                    {isLinking ? t('common.loading') : t('common.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
