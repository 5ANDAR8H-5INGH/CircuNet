import { DefaultTheme } from 'styled-components';

export const theme: DefaultTheme = {
  colors: {
    primary: {
      main: '#176B4D', // Deep green for circularity
      light: '#65A98A',
      dark: '#104632',
    },
    secondary: {
      main: '#287C73', // Teal for material exchange
      light: '#69AAA2',
      dark: '#1B5C55',
    },
    text: {
      primary: '#1F2D27',
      secondary: '#64736B',
      disabled: '#9AA69F',
    },
    background: {
      default: '#F4F7F3',
      paper: '#FFFFFF',
    },
    error: '#B54745',
    success: '#267A52',
    warning: '#D59128',
    info: '#287C73',
    disabled: '#9AA69F',
    white: '#FFFFFF',
    border: '#DFE7E1',
  },
  spacing: (multiplier = 1) => `${8 * multiplier}px`,
  breakpoints: {
    xs: '320px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
  },
  shadows: {
    sm: '0 2px 8px rgba(31,55,42,0.06)',
    md: '0 8px 24px rgba(31,55,42,0.08)',
    lg: '0 16px 36px rgba(31,55,42,0.12)',
    xl: '0 24px 52px rgba(31,55,42,0.16)',
  },
  typography: {
    fontFamily: '"Poppins", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeights: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700,
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      xxl: '24px',
    },
  },
  borderRadius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
    circle: '50%',
  },
};

export default theme; 