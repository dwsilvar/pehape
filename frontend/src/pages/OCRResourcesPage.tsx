import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Grid, Chip, Divider, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Button, IconButton, Snackbar, Alert } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Image as ImageIcon, Edit as EditIcon } from '@mui/icons-material';
import AppToolbar from '../components/AppToolbar';

interface OCRImage {
    relative_path: string;
    filename: string;
    key_text: string; // The text being searched
    full_path_parts: string[];
}

const OCRResourcesPage: React.FC = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState<OCRImage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

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

    // Grouping logic: Try to group by "Feature" (assuming parent folder of tag folder)
    // Structure: .../FeatureName/Tag/Image.png
    // Parts: [..., Feature, Tag, Image]
    // If length < 3, just put in "Uncategorized"

    const groupedImages = images.reduce((acc, img) => {
        let groupName = "Uncategorized";
        const parts = img.full_path_parts;

        // Heuristic: The folder containing the image is the Tag. The folder above that is the Feature.
        if (parts.length >= 3) {
            const featureName = parts[parts.length - 3];
            groupName = featureName;
        } else if (parts.length === 2) {
            groupName = parts[0]; // Just the top folder
        }

        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(img);
        return acc;
    }, {} as Record<string, OCRImage[]>);


    const handleOpenFeature = async (groupName: string, exampleImage: OCRImage) => {
        // Reconstruct feature path
        try {
            const parts = exampleImage.full_path_parts;
            if (parts.length < 3) {
                console.warn("Cannot derive feature path from image path (too short)");
                return;
            }

            // Remove last 2 parts (FileName, Tag)
            const featureAndDirs = parts.slice(0, -2);
            /*
               Example: .../images/features/path/to/feature/tag/image.png
               parts: [features, path, to, feature, tag, image.png]
               featureAndDirs: [features, path, to, feature]
               relativePath: features/path/to/feature.feature
            */
            const relativePath = `${featureAndDirs.join('/')}.feature`;

            // 1. Validate if feature exists
            try {
                const response = await fetch(`/api/features/${encodeURIComponent(relativePath)}`);
                if (!response.ok) {
                    setSnackbarMessage(`El feature asociado (${relativePath}) no existe.`);
                    setSnackbarOpen(true);
                    return;
                }
            } catch (err) {
                console.error("Validation error", err);
                setSnackbarMessage(`Error verificando el feature: ${relativePath}`);
                setSnackbarOpen(true);
                return;
            }

            navigate(`/?openFile=${encodeURIComponent(relativePath)}`);
        } catch (e) {
            console.error("Error opening feature", e);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Typography color="error">Error: {error}</Typography></Box>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <AppToolbar title="Recursos de Imágenes OCR" icon={<ImageIcon sx={{ fontSize: 32 }} />} />
            <Box sx={{ p: 4, flex: 1, overflowY: 'auto' }}>
                <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                    Imágenes de respaldo utilizadas cuando falla el reconocimiento de texto OCR.
                </Typography>

                {Object.keys(groupedImages).length === 0 && (
                    <Typography variant="body1">No se encontraron imágenes en <code>resources/images/</code>.</Typography>
                )}

                {Object.entries(groupedImages).map(([groupName, groupImages]) => (
                    <Accordion key={groupName} defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                                <Typography variant="h6" sx={{ flexGrow: 1 }}>{groupName}</Typography>
                                <Chip label={`${groupImages.length} images`} size="small" sx={{ mr: 2 }} />
                                {groupName !== 'Uncategorized' && (
                                    <Button
                                        component="div"
                                        size="small"
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenFeature(groupName, groupImages[0]);
                                        }}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        Open Feature
                                    </Button>
                                )}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={3}>
                                {groupImages.map((img) => (
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
                                                <Typography variant="subtitle2" noWrap title={img.key_text} sx={{ fontWeight: 'bold' }}>
                                                    "{img.key_text}"
                                                </Typography>
                                                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {/* Show hierarchy tags */}
                                                    {img.full_path_parts.slice(0, -1).map((part, idx) => (
                                                        <Chip key={idx} label={part} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                ))}

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
