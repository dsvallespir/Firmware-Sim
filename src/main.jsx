/*
 * ============================================================
 * main.jsx - Punto de entrada de la aplicación React
 * ============================================================
 * 
 * Inicializa:
 * 1. React con StrictMode (detecta problemas en desarrollo)
 * 2. BrowserRouter para navegación SPA
 * 3. AuthProvider para contexto de autenticación global
 * 4. App como componente raíz
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
