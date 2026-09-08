import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { AppProviders } from './app/providers'

const container = document.getElementById('root')
if (!container) throw new Error('#root не найден')

createRoot(container).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
)
