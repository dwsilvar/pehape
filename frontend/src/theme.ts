import { createTheme, Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      bgMain: string;
      bgSidebar: string;
      bgCanvas: string;
      cardBg: string;
      cardBgHover?: string;
      textMuted: string;
      border: string;
      borderWidth?: string;
      boxShadow?: string;
      tableHeaderBg?: string;
      tableRowHoverBg?: string;
      tableRowGroupBg?: string;
      listItemBg?: string;
      listItemShadow?: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      bgMain?: string;
      bgSidebar?: string;
      bgCanvas?: string;
      cardBg?: string;
      cardBgHover?: string;
      textMuted?: string;
      border?: string;
      borderWidth?: string;
      boxShadow?: string;
      tableHeaderBg?: string;
      tableRowHoverBg?: string;
      tableRowGroupBg?: string;
      listItemBg?: string;
      listItemShadow?: string;
    };
  }
}

// 1. Definimos la interfaz estricta para asegurar que todos los temas tengan las mismas propiedades
export interface AppTheme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceVariant: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentHover: string;
    border: string;
  };
  styles: {
    borderWidth: string;
    borderRadius: string;
    boxShadow: string;
    tableHeaderBg?: string;
    tableRowHoverBg?: string;
    tableRowGroupBg?: string;
    listItemBg?: string;
    listItemShadow?: string;
  };
}

// 2. Definición individual de cada estilo solicitado
const originalLight: AppTheme = {
  id: 'vs-light',
  name: 'Original - Light',
  isDark: false,
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    accent: '#38BDF8',
    accentHover: '#0284C7',
    border: '#E2E8F0',
  },
  styles: {
    borderWidth: '1px',
    borderRadius: '4px',
    boxShadow: 'none',
  }
};

const originalDark: AppTheme = {
  id: 'vs-dark',
  name: 'Original - Dark',
  isDark: true,
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#0B1120',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    accent: '#38BDF8',
    accentHover: '#0284C7',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  styles: {
    borderWidth: '1px',
    borderRadius: '4px',
    boxShadow: 'none',
  }
};

const techMinimalLight: AppTheme = {
  id: 'tech-minimal-light',
  name: 'Tech Minimal - Light',
  isDark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#F8F9FA',
    surfaceVariant: '#E4E6EB',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    accent: '#00B4D8', // Cian tecnológico vibrante
    accentHover: '#0096B4',
    border: '#E2E8F0',
  },
  styles: {
    borderWidth: '1px',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', // Sombra suave y sutil
  }
};

const techMinimalDark: AppTheme = {
  id: 'tech-minimal-dark',
  name: 'Tech Minimal - Dark',
  isDark: true,
  colors: {
    background: '#121212', // Gris oscuro para evitar fatiga
    surface: '#1A1A1A',
    surfaceVariant: '#242424',
    textPrimary: '#F8F9FA',
    textSecondary: '#94A3B8',
    accent: '#00D8F6', // Cian ajustado para mejor contraste en modo oscuro
    accentHover: '#00B4D8',
    border: '#2E2E2E',
  },
  styles: {
    borderWidth: '1px',
    borderRadius: '6px',
    boxShadow: 'none', // En modo oscuro plano las sombras no se perciben bien
  }
};

const neoBrutalistaLight: AppTheme = {
  id: 'neo-brutalista-light',
  name: 'Neo-Brutalista - Light',
  isDark: false,
  colors: {
    background: '#FDF0E6',     // Fondo crema suave de lienzo (Neutral de Figma)
    surface: '#FFFFFF',        // Fondo blanco para celdas de la tabla y tarjetas limpias
    surfaceVariant: '#F7C948', // Amarillo/dorado característico ("Start growing" / "Plan guardado")
    textPrimary: '#1A1A1A',    // Negro de alta legibilidad para reportes y logs
    textSecondary: '#4A4A4A',  // Gris oscuro para subtítulos y rutas (ej: "retiro.feature")
    accent: '#708CE7',         // Azul lavanda/pervinca para destacar acciones principales
    accentHover: '#5673D6',
    border: '#000000',         // Trazo negro puro estructural que define el Brutalismo
  },
  styles: {
    borderWidth: '2px',
    borderRadius: '12px',       // Redondeado controlado para la tabla y contenedores principales
    boxShadow: '5px 5px 0px #000000', // Sombra sólida en bloque hacia abajo-derecha
    tableHeaderBg: '#F7C948',    // Cabecera de la tabla en amarillo destacado para romper la monotonía
    tableRowHoverBg: '#FFF9F5',  // Hover sutil crema-blanco al pasar el cursor por las filas
    tableRowGroupBg: '#FDF0E6',  // Filas agrupadoras (Matriz 1, Matriz 2) con el fondo crema del lienzo
    listItemBg: '#FFFFFF',       // Fondo de las tarjetas del Timeline de resultados
    listItemShadow: '3px 3px 0px #000000', // Sombra rígida de menor tamaño para los ítems de lista
  }
};

const neoBrutalistaDark: AppTheme = {
  id: 'neo-brutalista-dark',
  name: 'Neo-Brutalista - Dark',
  isDark: true,
  colors: {
    background: '#120F14',     // Gris-lila ultra oscuro de tu layout real
    surface: '#1A171E',        // Superficie de tarjetas y celdas (rompe el fondo general)
    surfaceVariant: '#D9A726', // Amarillo calibrado para no encandilar en la oscuridad
    textPrimary: '#FDF0E6',    // El crema claro pasa a ser el texto principal (alto contraste)
    textSecondary: '#A39EAC',  // Gris lila atenuado para meta-datos de pruebas
    accent: '#8FA3FF',         // Azul neón/pervinca optimizado para contrastar en la oscuridad
    accentHover: '#708CE7',
    border: '#383241',         // ¡FUNDAMENTAL! Gris lila marcado para que los bordes de la tabla sean visibles
  },
  styles: {
    borderWidth: '2px',
    borderRadius: '12px',
    boxShadow: '5px 5px 0px #8FA3FF', // Sombra en bloque usando el azul de acento (efecto calcomanía/neón)
    tableHeaderBg: '#25212B',    // Cabecera oscura claramente diferenciada de las filas
    tableRowHoverBg: '#2E2936',  // Hover notable para interactuar con las filas de escenarios
    tableRowGroupBg: '#25212B',  // Separadores de Matriz/Ciclo que cortan visualmente la tabla
    listItemBg: '#1A171E',       // Fondo de las tarjetas del Timeline en modo oscuro
    listItemShadow: '4px 4px 0px #8FA3FF', // Sombra de bloque neón para que el árbol de flujos "explote"
  }
};

// 3. Exportación del mapa global de temas
export const appThemes: Record<string, AppTheme> = {
  'vs-light': originalLight,
  'vs-dark': originalDark,
  'tech-minimal-light': techMinimalLight,
  'tech-minimal-dark': techMinimalDark,
  'neo-brutalista-light': neoBrutalistaLight,
  'neo-brutalista-dark': neoBrutalistaDark,
};

// 4. Mapa global de exportación para tus componentes o proveedor de contexto
export const brutalistThemes: Record<string, AppTheme> = {
  light: neoBrutalistaLight,
  dark: neoBrutalistaDark,
};

// Tema por defecto de la aplicación
export const defaultTheme = originalLight;

// Función para construir un Tema de Material-UI desde un AppTheme
function buildMuiTheme(appTheme: AppTheme): Theme {
  const isBrutalist = appTheme.id.includes('brutalista');
  return createTheme({
    palette: {
      mode: appTheme.isDark ? 'dark' : 'light',
      primary: {
        main: appTheme.colors.accent,
      },
      secondary: {
        main: appTheme.colors.surfaceVariant,
      },
      background: {
        default: appTheme.colors.background,
        paper: appTheme.colors.surface,
      },
      text: {
        primary: appTheme.colors.textPrimary,
        secondary: appTheme.colors.textSecondary,
      },
      divider: appTheme.colors.border,
      custom: {
        bgMain: appTheme.colors.background,
        bgSidebar: appTheme.colors.surface,
        bgCanvas: appTheme.colors.surfaceVariant,
        cardBg: appTheme.colors.surface,
        cardBgHover: appTheme.colors.surfaceVariant,
        textMuted: appTheme.colors.textSecondary,
        border: appTheme.colors.border,
        borderWidth: appTheme.styles.borderWidth,
        boxShadow: appTheme.styles.boxShadow !== 'none' ? appTheme.styles.boxShadow : undefined,
        tableHeaderBg: appTheme.styles.tableHeaderBg,
        tableRowHoverBg: appTheme.styles.tableRowHoverBg,
        tableRowGroupBg: appTheme.styles.tableRowGroupBg,
        listItemBg: appTheme.styles.listItemBg,
        listItemShadow: appTheme.styles.listItemShadow,
      },
    },
    shape: {
      borderRadius: parseInt(appTheme.styles.borderRadius.replace('px', '')) || 4,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `${appTheme.styles.borderWidth} solid ${appTheme.colors.border}`,
            boxShadow: appTheme.styles.boxShadow !== 'none' ? appTheme.styles.boxShadow : undefined,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: appTheme.styles.borderRadius,
            boxShadow: isBrutalist ? appTheme.styles.boxShadow : undefined,
            border: isBrutalist ? `${appTheme.styles.borderWidth} solid ${appTheme.colors.border}` : undefined,
            fontWeight: 600,
            '&:hover': {
                boxShadow: isBrutalist ? 'none' : undefined,
                transform: isBrutalist ? 'translate(4px, 4px)' : undefined,
            }
          },
          contained: {
             backgroundColor: appTheme.colors.accent,
             color: appTheme.colors.background, // Contraste
             '&:hover': {
                 backgroundColor: appTheme.colors.accentHover,
             }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: appTheme.colors.surface,
            color: appTheme.colors.textPrimary,
            borderBottom: `${appTheme.styles.borderWidth} solid ${appTheme.colors.border}`,
            boxShadow: 'none',
          }
        }
      },
      MuiAccordion: {
          styleOverrides: {
              root: {
                  boxShadow: 'none',
                  border: `${appTheme.styles.borderWidth} solid ${appTheme.colors.border}`,
              }
          }
      }
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      button: {
        textTransform: 'none',
      },
    },
  });
}

// Generar temas cacheados para no reconstruirlos cada vez
const muiThemesMap: Record<string, Theme> = {};
for (const key in appThemes) {
  muiThemesMap[key] = buildMuiTheme(appThemes[key]);
}

export const getAppTheme = (themeName: string): Theme => {
  if (muiThemesMap[themeName]) {
    return muiThemesMap[themeName];
  }
  
  // Mapear los nombres antiguos o desconocidos a los temas originales correspondientes
  if (themeName === 'light') return muiThemesMap['vs-light'];
  if (themeName === 'dark' || themeName === 'monokai' || themeName === 'dracula') return muiThemesMap['vs-dark'];
  
  return muiThemesMap['vs-dark']; // Default por seguridad
};