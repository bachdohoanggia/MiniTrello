import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RootApp from './RootApp.jsx';
import { AuthProvider } from './AuthContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider><RootApp /></AuthProvider>
  </StrictMode>
);
