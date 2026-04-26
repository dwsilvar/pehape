import React, { useState } from 'react';
import { 
    Drawer, Box, Typography, IconButton, useTheme, alpha, 
    Accordion, AccordionSummary, AccordionDetails, Dialog 
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';

interface StepInspectorDrawerProps {
    scenario: any | null;
    isOpen: boolean;
    onClose: () => void;
}

const StepInspectorDrawer: React.FC<StepInspectorDrawerProps> = ({ scenario, isOpen, onClose }) => {
    const theme = useTheme();
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    if (!scenario) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'passed': return <CheckCircleRoundedIcon sx={{ color: '#10B981', fontSize: 20 }} />;
            case 'failed': return <CancelRoundedIcon sx={{ color: '#EF4444', fontSize: 20 }} />;
            default: return <HelpOutlineRoundedIcon sx={{ color: '#94A3B8', fontSize: 20 }} />;
        }
    };

    return (
        <>
            <Drawer
                anchor="right"
                open={isOpen}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        width: 500,
                        maxWidth: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: theme.palette.primary.main }}>
                        <ListAltRoundedIcon />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                            Inspector de Pasos (Steps)
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="subtitle2" color="text.secondary">Escenario Seleccionado</Typography>
                    <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{scenario.name || scenario.scenario_name}</Typography>
                </Box>

                <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                    {(!scenario.steps || scenario.steps.length === 0) ? (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
                            No hay información de pasos (steps) disponible para este escenario.
                        </Typography>
                    ) : (
                        scenario.steps.map((step: any, index: number) => {
                            const hasAttachments = step.attachments && step.attachments.length > 0;
                            const isFailed = step.status === 'failed';

                            return (
                                <Accordion 
                                    key={index} 
                                    defaultExpanded={isFailed}
                                    disableGutters
                                    sx={{ 
                                        mb: 1, 
                                        border: `1px solid ${isFailed ? alpha('#EF4444', 0.5) : theme.palette.divider}`,
                                        boxShadow: 'none',
                                        '&:before': { display: 'none' }
                                    }}
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                        sx={{ 
                                            backgroundColor: isFailed ? alpha('#EF4444', 0.05) : 'transparent',
                                            '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 }
                                        }}
                                    >
                                        {getStatusIcon(step.status)}
                                        <Typography variant="body2" sx={{ fontWeight: isFailed ? 600 : 400 }}>
                                            <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{step.keyword} </Box>
                                            {step.name}
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        {hasAttachments ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {step.attachments.map((att: any, attIdx: number) => (
                                                    <Box key={attIdx}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                                            {att.name}
                                                        </Typography>
                                                        {att.type === 'image/png' ? (
                                                            <Box 
                                                                sx={{ 
                                                                    position: 'relative',
                                                                    cursor: 'pointer',
                                                                    borderRadius: 1,
                                                                    overflow: 'hidden',
                                                                    border: `1px solid ${theme.palette.divider}`,
                                                                    '&:hover .zoom-overlay': {
                                                                        opacity: 1
                                                                    }
                                                                }}
                                                                onClick={() => setZoomedImage(`/api/reports/attachment/${att.source}`)}
                                                            >
                                                                <Box 
                                                                    component="img"
                                                                    src={`/api/reports/attachment/${att.source}`}
                                                                    alt={att.name}
                                                                    sx={{ width: '100%', display: 'block' }}
                                                                />
                                                                <Box 
                                                                    className="zoom-overlay"
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        top: 0, left: 0, right: 0, bottom: 0,
                                                                        backgroundColor: alpha('#000', 0.4),
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        opacity: 0,
                                                                        transition: 'opacity 0.2s',
                                                                        color: '#fff'
                                                                    }}
                                                                >
                                                                    <ZoomInRoundedIcon sx={{ fontSize: 40 }} />
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="caption" color="text.secondary">
                                                                Attachment no renderizable: {att.type}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                No hay capturas asociadas a este paso.
                                            </Typography>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            );
                        })
                    )}
                </Box>
            </Drawer>

            <Dialog
                open={!!zoomedImage}
                onClose={() => setZoomedImage(null)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { backgroundColor: 'transparent', boxShadow: 'none' }
                }}
            >
                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <IconButton 
                        onClick={() => setZoomedImage(null)}
                        sx={{ position: 'absolute', top: -40, right: 0, color: '#fff' }}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                    <Box 
                        component="img"
                        src={zoomedImage || ''}
                        alt="Zoomed attachment"
                        sx={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 2 }}
                    />
                </Box>
            </Dialog>
        </>
    );
};

export default StepInspectorDrawer;
