import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, TextField, DialogActions, Button } from '@mui/material';

interface ScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    scheduledTime: string;
    setScheduledTime: (time: string) => void;
    onConfirm: () => void;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ open, onClose, scheduledTime, setScheduledTime, onConfirm }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Programar Ejecución</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    Selecciona la fecha y hora para iniciar la ejecución de pruebas automáticamente.
                </DialogContentText>
                <TextField
                    id="schedule-datetime"
                    label="Fecha y Hora"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    InputLabelProps={{
                        shrink: true,
                    }}
                    fullWidth
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={onConfirm} variant="contained" color="primary">
                    Programar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScheduleDialog;
