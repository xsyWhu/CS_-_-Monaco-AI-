import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './main.css'

window.addEventListener('error', (e) => {
  document.getElementById('root')!.innerHTML = `
    <div style="padding:32px;color:#f38ba8;font-family:monospace;white-space:pre-wrap">
      <h2>Uncaught Error</h2>
      <pre>${e.message}\n${e.filename}:${e.lineno}</pre>
    </div>
  `
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
