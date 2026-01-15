import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
// Import tracking - it auto-initializes on load
import './lib/tracking'

createRoot(document.getElementById("root")!).render(<App />);
