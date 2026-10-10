import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../common/theme.css'
import { AdminView } from './AdminView'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminView />
  </StrictMode>
)
