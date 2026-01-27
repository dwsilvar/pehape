import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    IconButton
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface ImageUploadDialogProps {
    open: boolean;
    onClose: () => void;
    initialText: string;
    initialTag: string | null;
    featurePath: string; // Needed to construct the full upload path context
    onUpload: (text: string, tag: string, file: File) => Promise<void>;
}

export const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
    open,
    onClose,
    initialText,
    initialTag,
    featurePath,
    onUpload
}) => {
    const [text, setText] = useState(initialText);
    const [tag, setTag] = useState(initialTag || '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setText(initialText);
            setTag(initialTag || '');
            setSelectedFile(null);
            setError(null);
            setIsUploading(false);
        }
    }, [open, initialText, initialTag]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!tag) {
            setError("Please specify a tag (e.g., @mytag).");
            return;
        }
        if (!selectedFile) {
            setError("Please select an image file.");
            return;
        }

        setIsUploading(true);
        try {
            await onUpload(text, tag, selectedFile);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Upload OCR Fallback Image</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField
                        id="image-text-field"
                        name="image-text-field"
                        label="Selected Text / Image Name"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        fullWidth
                        helperText="This will be the filename (e.g. 'Submit Button.png')"
                    />
                    <TextField
                        id="scenario-tag-field"
                        name="scenario-tag-field"
                        label="Scenario Tag"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        fullWidth
                        helperText="The tag associated with the scenario (e.g. @login)"
                        placeholder="@tag"
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
                                Select Image
                            </Button>
                        </label>
                        {selectedFile && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Selected: {selectedFile.name}
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
                <Button onClick={onClose} disabled={isUploading}>Cancel</Button>
                <Button onClick={handleUpload} variant="contained" disabled={isUploading || !selectedFile}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
