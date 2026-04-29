import React, { useState, useEffect } from 'react'
import { FiSave, FiSettings, FiGlobe, FiKey, FiActivity, FiFileText, FiType } from 'react-icons/fi'

export default function Config(){
  const [webhook, setWebhook] = useState('')
  const [token, setToken] = useState('')
  const [rate, setRate] = useState(60)
  const [logs, setLogs] = useState(false)
  const [lang, setLang] = useState('pt-BR')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nexus_config') || '{}')
      setWebhook(saved.webhook || '')
      setToken(saved.token || '')
      setRate(saved.rate || 60)
      setLogs(!!saved.logs)
      setLang(saved.lang || 'pt-BR')
    } catch {}
  }, [])

  const save = (e) => {
    e.preventDefault()
    const cfg = { webhook, token, rate, logs, lang }
    localStorage.setItem('nexus_config', JSON.stringify(cfg))
    setMsg('Configurações salvas.')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <>
      <h1>Configurações</h1>
      <div className="card">
        <div className="card-title"><FiSettings /> Preferências do Sistema</div>
        <form className="settings-form" onSubmit={save}>
          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}><FiGlobe /> Webhook URL</label>
            <input className="input" type="url" value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder="https://seu-dominio.com/webhook" />
            <small style={{ opacity: 0.6, fontSize: '0.85rem' }}>URL para onde enviaremos eventos de mensagens recebidas.</small>
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}><FiKey /> Token de API</label>
            <input className="input" type="text" value={token} onChange={e=>setToken(e.target.value)} placeholder="Seu token de autenticação" />
          </div>

          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}><FiActivity /> Limite de disparos/min</label>
            <input className="input" type="number" min="1" value={rate} onChange={e=>setRate(+e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
              <input type="checkbox" checked={logs} onChange={e=>setLogs(e.target.checked)} />
              <FiFileText /> Logs Detalhados
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}><FiType /> Idioma</label>
            <select className="select" value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>

          <div className="actions" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button className="btn btn-primary" type="submit"><FiSave /> Salvar Alterações</button>
          </div>
          
          {msg && <div className="toast" style={{ marginTop: '1rem' }}>{msg}</div>}
        </form>
      </div>
    </>
  )
}
