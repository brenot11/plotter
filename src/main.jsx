import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PinScreen, { checkAuth, setAuth } from './components/PinScreen.jsx'
import './styles/global.css'

function Root() {
  const [unlocked, setUnlocked] = useState(() => checkAuth())

  if (!unlocked) {
    return <PinScreen onUnlock={() => setUnlocked(true)} />
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
