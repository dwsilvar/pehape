import { createTheme, ThemeOptions } from '@mui/material/styles';

// Paletas de colores inspiradas en temas populares de VS Code.
// Estos son valores aproximados y se pueden ajustar para un mejor resultado.
const themePalettes: { [key:string]: ThemeOptions } = {
  'monokai': {
    palette: {
      mode: 'dark',
      primary: { main: '#AE81FF' }, // Púrpura
      secondary: { main: '#A6E22E' }, // Verde lima
      background: {
        default: '#272822', // Fondo principal de Monokai
        paper: '#3E3D32',   // Fondo de paneles
      },
      text: {
        primary: '#F8F8F2',
        secondary: '#75715E',
      },
    },
  },
  'dracula': {
    palette: {
      mode: 'dark',
      primary: { main: '#BD93F9' }, // Púrpura
      secondary: { main: '#50FA7B' }, // Verde
      background: {
        default: '#282A36',
        paper: '#44475A',
      },
      text: {
        primary: '#F8F8F2',
        secondary: '#6272A4',
      },
    },
  },
  'vs-dark': {
    palette: {
      mode: 'dark',
      primary: { main: '#569CD6' }, // Azul
      secondary: { main: '#4EC9B0' }, // Turquesa
      background: {
        default: '#1E1E1E',
        paper: '#252526',
      },
      text: {
        primary: '#D4D4D4',
        secondary: '#808080',
      },
    },
  },
  // Puedes agregar más temas como 'solarized-dark', 'cobalt', etc.
};

/**
 * Crea un tema de Material-UI basado en el nombre de un tema de VS Code.
 * @param themeName El nombre del tema (ej. 'monokai').
 * @returns Un objeto de tema de MUI.
 */
export const getAppTheme = (themeName: string) => {
  const themeOptions = themePalettes[themeName] || themePalettes['vs-dark']; // Fallback a vs-dark
  return createTheme(themeOptions);
};