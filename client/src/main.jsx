import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (M-192): only the weights the stylesheets use.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './styles/variables.css'
import './styles/globals.css'
import './styles/utilities.css'
import { loadMe } from './app/session.js'
import { browserLanguage, initI18n } from './i18n/index.js'
import { readAnonymousPreference } from './lib/preferences.js'
import App from './app/App.jsx'

// Anonymous language first (M-135); a signed-in account then switches to its own before the first paint.
await initI18n(readAnonymousPreference('language') ?? browserLanguage())
await loadMe()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
