import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const shouldDebugLog = process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.log(...args);
  }
};

debugLog('[index.tsx] Starting React app...');

try {
  const rootElement = document.getElementById('root');
  debugLog('[index.tsx] Root element:', rootElement);

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = ReactDOM.createRoot(rootElement as HTMLElement);
  debugLog('[index.tsx] React root created, rendering App...');

  root.render(<App />);

  debugLog('[index.tsx] App rendered successfully');
} catch (error) {
  console.error('[index.tsx] Error rendering app:', error);
  document.body.innerHTML = `<div style="color: red; padding: 20px;">
    <h2>Failed to start application</h2>
    <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
    <pre>${error instanceof Error ? error.stack : ''}</pre>
  </div>`;
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
