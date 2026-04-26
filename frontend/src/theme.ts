import { createTheme, Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      bgMain: string;
      bgSidebar: string;
      bgCanvas: string;
      cardBg: string;
      textMuted: string;
      border: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      bgMain?: string;
      bgSidebar?: string;
      bgCanvas?: string;
      cardBg?: string;
      textMuted?: string;
      border?: string;
    };
  }
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#38BDF8',
    },
    secondary: {
      main: '#94A3B8',
    },
    success: {
      main: '#22C55E',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
    },
    background: {
      default: '#0F172A',
      paper: '#1E293B',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.1)',
    custom: {
      bgMain: '#0F172A',
      bgSidebar: '#1E293B',
      bgCanvas: '#0B1120',
      cardBg: 'rgba(30, 41, 59, 0.7)',
      textMuted: '#94A3B8',
      border: 'rgba(255, 255, 255, 0.1)',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    button: {
      textTransform: 'none',
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#38BDF8',
    },
    secondary: {
      main: '#64748B',
    },
    success: {
      main: '#22C55E',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
    custom: {
      bgMain: '#F8FAFC',
      bgSidebar: '#FFFFFF',
      bgCanvas: '#F1F5F9',
      cardBg: '#FFFFFF',
      textMuted: '#64748B',
      border: '#E2E8F0',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    button: {
      textTransform: 'none',
    },
  },
});

export const getAppTheme = (themeName: string): Theme => {
  return themeName === 'vs-dark' || themeName.includes('dark') || themeName === 'monokai' || themeName === 'dracula' || themeName === 'cobalt' ? darkTheme : lightTheme;
};