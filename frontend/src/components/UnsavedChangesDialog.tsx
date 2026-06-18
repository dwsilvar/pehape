import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, alpha, useTheme,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesDialogProps {
  open: boolean;
  /** Called when the user clicks "Guardar y continuar" */
  onSaveAndLeave: () => void;
  /** Called when the user clicks "Descartar y salir" */
  onDiscardAndLeave: () => void;
  /** Called when the user clicks "Cancelar" (stay on page) */
  onCancel: () => void;
}

/**
 * Modal de confirmación que aparece cuando el usuario intenta navegar
 * fuera de una página con cambios sin guardar.
 */
const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  onSaveAndLeave,
  onDiscardAndLeave,
  onCancel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
          bgcolor: 'background.paper',
          backgroundImage:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, rgba(255, 255, 255, 0) 0%, ${alpha(theme.palette.warning.dark, 0.08)} 100%)`
              : 'none',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.12),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 20, color: 'warning.main' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            {t('common.unsavedTitle')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5, pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {t('common.unsavedText')}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Primary: save and leave */}
        <Button
          variant="contained"
          startIcon={<SaveRoundedIcon />}
          onClick={onSaveAndLeave}
          fullWidth
          sx={{ fontWeight: 600 }}
        >
          {t('common.unsavedSave')}
        </Button>

        {/* Secondary: discard */}
        <Button
          variant="outlined"
          color="error"
          startIcon={<ExitToAppRoundedIcon />}
          onClick={onDiscardAndLeave}
          fullWidth
          sx={{ fontWeight: 500 }}
        >
          {t('common.unsavedDiscard')}
        </Button>

        {/* Cancel: stay */}
        <Button
          variant="text"
          onClick={onCancel}
          fullWidth
          sx={{ color: 'text.secondary', fontWeight: 400 }}
        >
          {t('common.unsavedCancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UnsavedChangesDialog;
