import { StrictMode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const hrmsTheme = createTheme({
  typography: { fontFamily: "'Montserrat', sans-serif" },
  palette: {
    primary: { main: '#E0442E', dark: '#BD3524', contrastText: '#FFFFFF' },
    text: { primary: '#16181D', secondary: '#6B6F76' },
    background: { default: '#F5F4F0', paper: '#FFFFFF' },
    divider: '#DAD7CF',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, boxShadow: 'none' },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10, backgroundColor: '#FAF9F6', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#DAD7CF' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#A9A69D' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#E0442E', borderWidth: 1.5 } },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 14 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, color: '#4B4E55', backgroundColor: '#FAF9F6' } } },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={hrmsTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);