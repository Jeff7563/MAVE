import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { SurfaceView } from './components/surface/SurfaceView';
import { MaveUiLab } from './ui-v2/lab/MaveUiLab';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isSurfaceView = params.get('view') === 'surface';
const isLabView = params.get('view') === 'lab' || params.get('view') === 'ui-v2';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {isSurfaceView ? <SurfaceView /> : isLabView ? <MaveUiLab /> : <App />}
    </React.StrictMode>
  );
}
