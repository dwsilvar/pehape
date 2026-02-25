import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, Typography, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DeleteTaskConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    taskName?: string;
}

const DeleteTaskConfirmationDialog: React.FC<DeleteTaskConfirmationDialogProps> = ({ open, onClose, onConfirm, taskName }) => {
    const { t } = useTranslation();
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{t('common.confirm_delete')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t('orchestrator.tasks.confirm_delete_message', { defaultValue: '¿Estás seguro de que deseas eliminar esta tarea?' })}
                </DialogContentText>
                {taskName && (
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                        {taskName}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={onConfirm} color="error" autoFocus>
                    {t('common.delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteTaskConfirmationDialog;
