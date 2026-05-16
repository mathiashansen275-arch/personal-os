import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppV1Shell } from './AppV1Shell';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppV1Shell />
  </React.StrictMode>,
);
