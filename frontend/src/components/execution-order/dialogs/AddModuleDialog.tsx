import React from 'react';
import { Dialog, DialogTitle, DialogContent, List, ListItemButton, Checkbox, ListItemText, Typography, DialogActions, Button } from '@mui/material';
import { Module } from '../../../types';

interface AddModuleDialogProps {
    open: boolean;
    onClose: () => void;
    availableModules: Module[];
    selectedModules: Set<string>;
    onToggleSelection: (moduleName: string) => void;
    onConfirm: () => void;
}

const AddModuleDialog: React.FC<AddModuleDialogProps> = ({ open, onClose, availableModules, selectedModules, onToggleSelection, onConfirm }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Agregar Módulos al Plan de Ejecución</DialogTitle>
            <DialogContent>
                {availableModules.length > 0 ? (
                    <List>
                        {availableModules.map(module => (
                            <ListItemButton key={module.module_name} onClick={() => onToggleSelection(module.module_name)}>
                                <Checkbox
                                    edge="start"
                                    checked={selectedModules.has(module.module_name)}
                                    tabIndex={-1}
                                    disableRipple
                                />
                                <ListItemText primary={module.module_name} />
                            </ListItemButton>
                        ))}
                    </List>
                ) : (
                    <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                        No hay módulos inactivos para agregar.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={onConfirm} disabled={selectedModules.size === 0}>
                    Agregar Seleccionados
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddModuleDialog;
