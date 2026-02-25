import { createTheme, Theme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
  },
});

export const getAppTheme = (themeName: string): Theme => {
  return themeName === 'vs-dark' || themeName.includes('dark') || themeName === 'monokai' || themeName === 'dracula' || themeName === 'cobalt' ? darkTheme : lightTheme;
};