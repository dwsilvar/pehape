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
    IconButton,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface ImageUploadDialogProps {
    open: boolean;
    onClose: () => void;
    initialText: string;
    initialTag: string | null;
    featurePath: string; // Needed to construct the full upload path context
    onUpload: (text: string, tag: string, file: File, isGeneric: boolean) => Promise<void>;
}

export const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
    open,
    onClose,
    initialText,
    initialTag,
    featurePath,
    onUpload
}) => {
    const { t } = useTranslation();
    const [text, setText] = useState(initialText);
    const [tag, setTag] = useState(initialTag || '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGeneric, setIsGeneric] = useState(false);

    useEffect(() => {
        if (open) {
            setText(initialText);
            setTag(initialTag || '');
            setSelectedFile(null);
            setError(null);
            setIsUploading(false);
            setIsGeneric(false);
        }
    }, [open, initialText, initialTag]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        // Skip tag validation if generic
        if (!isGeneric && !tag) {
            setError(t('editor.upload_dialog.error_tag'));
            return;
        }
        if (!selectedFile) {
            setError(t('editor.upload_dialog.error_file'));
            return;
        }

        setIsUploading(true);
        try {
            await onUpload(text, tag, selectedFile, isGeneric);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : t('editor.upload_dialog.error_upload'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('editor.upload_dialog.title')}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                        id="image-text-field"
                        name="image-text-field"
                        label={t('editor.upload_dialog.text_label')}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        fullWidth
                        helperText={t('editor.upload_dialog.text_hint')}
                    />

                    {/* Generic Image Checkbox */}
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

                    <TextField
                        id="scenario-tag-field"
                        name="scenario-tag-field"
                        label={t('editor.upload_dialog.tag_label')}
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        fullWidth
                        helperText={t('editor.upload_dialog.tag_hint')}
                        placeholder={t('editor.upload_dialog.tag_placeholder')}
                        disabled={isGeneric}
                    />

                    <Box sx={{ border: '1px dashed grey', p: 2, borderRadius: 1, textAlign: 'center' }}>
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="raised-button-file"
                            name="raised-button-file"
                            type="file"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="raised-button-file">
                            <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />}>
                                {t('editor.upload_dialog.select_image')}
                            </Button>
                        </label>
                        {selectedFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                {t('editor.upload_dialog.selected')}: {selectedFile.name}
                            </Typography>
                        )}
                    </Box>

                    {error && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isUploading}>{t('common.cancel')}</Button>
                <Button onClick={handleUpload} variant="contained" disabled={isUploading || !selectedFile}>
                    {isUploading ? t('editor.upload_dialog.uploading') : t('editor.upload_dialog.upload')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
