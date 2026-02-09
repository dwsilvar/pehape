import React from 'react';
import { Dialog, DialogTitle, DialogContentText, DialogContent, List, RadioGroup, ListItem, ListItemButton, Radio, ListItemText, Collapse, Box, Chip, Typography, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Module } from '../../../types';

interface HookDialogProps {
    open: boolean;
    onClose: () => void;
    titleData: { targetModuleName: string, hookType: 'setup' | 'teardown' } | null;
    availableHookModules: Module[];
    selectedHookModule: string;
    onSelectHookModule: (moduleName: string) => void;
    expandedHookModule: string | null;
    onToggleExpandHook: (moduleName: string) => void;
    selectedTags: Set<string>;
    onTagFilterToggle: (tag: string) => void;
    onConfirm: () => void;
}

const HookDialog: React.FC<HookDialogProps> = ({
    open,
    onClose,
    titleData,
    availableHookModules,
    selectedHookModule,
    onSelectHookModule,
    expandedHookModule,
    onToggleExpandHook,
    selectedTags,
    onTagFilterToggle,
    onConfirm,
}) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>
                Agregar Hook de '{titleData?.hookType}'
                <DialogContentText sx={{ fontSize: '0.9rem', mt: 1 }}>
                    Solo se muestran los módulos marcados como "Hooks". Asegúrese de clasificar el módulo deseado como hook en la vista de Módulos.
                </DialogContentText>
            </DialogTitle>
            <DialogContent sx={{ height: '400px' }}>
                {availableHookModules.length > 0 ? (
                    <List>
                        <RadioGroup
                            value={selectedHookModule}
                            onChange={(e) => {
                                onSelectHookModule(e.target.value);
                            }}
                        >
                            {availableHookModules.map(module => {
                                const allTags = Array.from(new Set(module.features.flatMap(f => f.display_tags || [])));
                                const isExpanded = expandedHookModule === module.module_name;

                                const moduleTagsSet = new Set(allTags);
                                const matchesFilter = selectedTags.size === 0 || Array.from(selectedTags).every(tag => moduleTagsSet.has(tag));

                                return (
                                    <React.Fragment key={module.module_name}>
                                        <ListItem
                                            disablePadding
                                            sx={{
                                                opacity: matchesFilter ? 1 : 0.5,
                                                transition: 'opacity 0.2s ease-in-out',
                                            }}
                                        >
                                            <ListItemButton
                                                dense
                                                disabled={!matchesFilter}
                                                onClick={() => {
                                                    onSelectHookModule(module.module_name);
                                                    // Trigger toggle expand handled by parent? 
                                                    // Logic in original was composite. Here we just call handler.
                                                    onToggleExpandHook(module.module_name);
                                                }}
                                            >
                                                <Radio value={module.module_name} />
                                                <ListItemText primary={module.module_name} />
                                            </ListItemButton>
                                        </ListItem>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <List component="div" disablePadding dense>
                                                <ListItem sx={{ pl: 4 }}>
                                                    {allTags.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {allTags.map(tag => (
                                                                <Chip
                                                                    key={tag}
                                                                    label={tag}
                                                                    size="small"
                                                                    clickable
                                                                    onClick={() => onTagFilterToggle(tag)}
                                                                    color={selectedTags.has(tag) ? 'primary' : 'default'}
                                                                />
                                                            ))}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">Este módulo no tiene tags.</Typography>
                                                    )}
                                                </ListItem>
                                            </List>
                                        </Collapse>
                                    </React.Fragment>
                                );
                            })}
                        </RadioGroup>
                    </List>
                ) : (
                    <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                        {t('orchestrator.no_modules')}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={onConfirm} disabled={!selectedHookModule}>{t('common.confirm')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default HookDialog;
