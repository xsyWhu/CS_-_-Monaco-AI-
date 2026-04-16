import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './main.css'

// 将根组件挂载到 index.html 中的 #root 容器。
createRoot(document.getElementById('root')!).render(
  // StrictMode 在开发期帮助发现副作用与潜在问题。
  <StrictMode>
    <App />
  </StrictMode>
)
