import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode intentionally omitted: double-mounts break Tone.js and
// three.js resource lifecycles in development.
createRoot(document.getElementById('root')!).render(<App />)
