import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';

interface ExportPlanDialogProps {
  open: boolean;
  planId: string | null | undefined;
  planName?: string;
  onClose: () => void;
}

const ExportPlanDialog: React.FC<ExportPlanDialogProps> = ({
  open,
  planId,
  planName,
  onClose,
}) => {
  const theme = useTheme();
  const [includeAllFeatures, setIncludeAllFeatures] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  const handleExport = () => {
    if (!planId) return;
    const params = new URLSearchParams();
    if (includeAllFeatures) params.set('include_all_features', 'true');
    if (includeImages) params.set('include_images', 'true');
    const query = params.toString();
    window.location.href = `/api/export-plan/${planId}${query ? `?${query}` : ''}`;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1.5,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <FileDownloadRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Exportar Plan
          </Typography>
          {planName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {planName}
            </Typography>
          )}
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          El plan se exportará siempre con los <strong>features usados</strong> por el plan.
          Puedes ampliar el contenido con las siguientes opciones:
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {/* Option: all features */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            mb: 1.5,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: includeAllFeatures ? 'primary.main' : 'divider',
            bgcolor: includeAllFeatures
              ? alpha(theme.palette.primary.main, 0.05)
              : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setIncludeAllFeatures((v) => !v)}
        >
          <Box
            sx={{
              mt: 0.2,
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: includeAllFeatures
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.action.hover, 0.5),
              color: includeAllFeatures ? 'primary.main' : 'text.secondary',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            <FolderOpenRoundedIcon fontSize="small" />
          </Box>
          <Box flex={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeAllFeatures}
                  onChange={(e) => setIncludeAllFeatures(e.target.checked)}
                  size="small"
                  sx={{ p: 0, mr: 1 }}
                  onClick={(e) => e.stopPropagation()}
                />
              }
              label={
                <Typography variant="body2" fontWeight={600}>
                  Incluir todos los features
                </Typography>
              }
              sx={{ m: 0 }}
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
              Agrega al archivo también los features que <em>no están usados</em> en este plan
              (todos los .feature del proyecto).
            </Typography>
          </Box>
        </Box>

        {/* Option: images */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: includeImages ? 'secondary.main' : 'divider',
            bgcolor: includeImages
              ? alpha(theme.palette.secondary.main, 0.05)
              : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setIncludeImages((v) => !v)}
        >
          <Box
            sx={{
              mt: 0.2,
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: includeImages
                ? alpha(theme.palette.secondary.main, 0.15)
                : alpha(theme.palette.action.hover, 0.5),
              color: includeImages ? 'secondary.main' : 'text.secondary',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            <ImageRoundedIcon fontSize="small" />
          </Box>
          <Box flex={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  size="small"
                  color="secondary"
                  sx={{ p: 0, mr: 1 }}
                  onClick={(e) => e.stopPropagation()}
                />
              }
              label={
                <Typography variant="body2" fontWeight={600}>
                  Incluir imágenes de los literales
                </Typography>
              }
              sx={{ m: 0 }}
            />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
              Incluye las imágenes OCR referenciadas dentro de los features exportados
              (carpeta <code>images/</code> en el .desb).
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{ borderRadius: 2, minWidth: 90 }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          size="small"
          disabled={!planId}
          startIcon={<FileDownloadRoundedIcon />}
          sx={{
            borderRadius: 2,
            minWidth: 120,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
            },
          }}
        >
          Exportar .desb
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportPlanDialog;
