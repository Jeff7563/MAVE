import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { SurfaceView } from './components/surface/SurfaceView';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isSurfaceView = params.get('view') === 'surface';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {isSurfaceView ? <SurfaceView /> : <App />}
    </React.StrictMode>
  );
}
