import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../common/theme.css'
import { WallView } from './WallView'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WallView />
  </StrictMode>
)
