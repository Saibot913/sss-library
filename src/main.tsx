import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* BrowserRouter gives real paths (/catalog) rather than hash ones
        (/#/catalog). Note this needs the host to serve index.html for unknown
        paths — Vercel and Netlify do that for Vite SPAs by default, but a
        plain static server will 404 on a refresh of /catalog. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
