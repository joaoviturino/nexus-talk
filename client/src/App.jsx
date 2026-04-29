import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Overview from './pages/Overview.jsx'
import LiveChat from './pages/LiveChat.jsx'
import Upload from './pages/Upload.jsx'
import Disparo from './pages/Disparo.jsx'
import Fluxo from './pages/Fluxo.jsx'
import IA from './pages/IA.jsx'
import Config from './pages/Config.jsx'

export default function App(){
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/kanban" element={<Navigate to="/livechat" replace />} />
          <Route path="/livechat" element={<LiveChat />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/disparo" element={<Disparo />} />
          <Route path="/fluxo" element={<Fluxo />} />
          <Route path="/ia" element={<IA />} />
          <Route path="/config" element={<Config />} />
          <Route path="*" element={<div className="placeholder">Página não encontrada</div>} />
        </Routes>
      </main>
    </div>
  )
}
