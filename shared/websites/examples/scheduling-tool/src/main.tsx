import { hydrateRoot, createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './index.css';

const rootElement = document.getElementById("root")!;
const basename = window.__BASENAME__ || '/';

if (rootElement.innerHTML.trim().length > 0) {
  hydrateRoot(rootElement,
    <BrowserRouter basename={basename}><App /></BrowserRouter>
  );
} else {
  createRoot(rootElement).render(
    <BrowserRouter basename={basename}><App /></BrowserRouter>
  );
}
