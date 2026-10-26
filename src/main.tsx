import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Fonts and icons ship with the app, so the desktop build works offline.
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@fontsource/share-tech-mono/400.css'
import 'material-symbols/outlined.css'
import './index.css'
import App from './App.tsx'
import { SystemStatusProvider } from './state/SystemStatusProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SystemStatusProvider>
        <App />
      </SystemStatusProvider>
    </BrowserRouter>
  </StrictMode>,
)
