import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import './design/base.css';
import './ui/ui.css';
import './ui/tree/tree.css';
import './ui/print/print.css';
import App from './App';
import { registerApp } from './pwa/register';

registerApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
