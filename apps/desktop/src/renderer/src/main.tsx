import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Surface } from './surface/Surface';
import './index.css';

// The same renderer bundle serves two windows:
//   #surface → ambient MAVE Surface (orb / capsule / panel), M4
//   default  → developer console (diagnostics, M1–M3)
const isSurface = window.location.hash === '#surface';
if (isSurface) {
  document.documentElement.classList.add('is-surface');
  document.title = 'MAVE Surface';
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>{isSurface ? <Surface /> : <App />}</React.StrictMode>
  );
}
