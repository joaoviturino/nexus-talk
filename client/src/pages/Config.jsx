import React, { useState, useEffect } from 'react'
import { FiSave, FiSettings, FiGlobe, FiKey, FiActivity, FiFileText, FiType, FiRefreshCw } from 'react-icons/fi'

export default function Config(){
  const [webhook, setWebhook] = useState('')
  const [token, setToken] = useState('')
  const [rate, setRate] = useState(60)
  const [logs, setLogs] = useState(false)
  const [lang, setLang] = useState('pt-BR')
  const [msg, setMsg] = useState('')
  const [wa, setWa] = useState({ connected: false, connection: 'unknown', dataUrl: '', lastQrAt: 0 })

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

  useEffect(() => {
    let alive = true
    let es
    let timer

    const load = async () => {
      try{
        const s = await fetch('/api/wa/status', { cache: 'no-store' }).then(r=>r.json())
        if (!alive) return
        if (s?.ok) {
          setWa(prev => ({ ...prev, connected: !!s.connected, connection: s.connection || 'unknown', lastQrAt: Number(s.lastQrAt || 0) }))
        }
      }catch{}

      try{
        const r = await fetch('/api/wa/qr', { cache: 'no-store' })
        if (!alive) return
        if (r.ok) {
          const j = await r.json()
          if (j?.ok) setWa(prev => ({ ...prev, dataUrl: j.dataUrl || prev.dataUrl, lastQrAt: Number(j.ts || prev.lastQrAt || 0) }))
        }
      }catch{}
    }

    const startPoll = () => {
      if (timer) return
      timer = setInterval(load, 2500)
    }

    const stopPoll = () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    load()
    startPoll()

    try{
      es = new EventSource('/api/chat/events')
      es.addEventListener('wa.status', (ev) => {
        try{
          const data = JSON.parse(ev.data || '{}')
          const conn = data?.connection || 'unknown'
          setWa(prev => ({ ...prev, connection: conn }))
          if (conn === 'open') {
            setWa(prev => ({ ...prev, connected: true, dataUrl: '' }))
            stopPoll()
          } else {
            startPoll()
          }
        }catch{}
      })
      es.addEventListener('wa.qr', () => {
        load()
      })
    }catch{}

    return () => {
      alive = false
      try { es && es.close() } catch {}
      stopPoll()
    }
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            <FiActivity /> Conexão WhatsApp
          </span>
          <span
            className="badge"
            style={{
              background: wa.connection === 'open'
                ? 'rgba(34,197,94,0.18)'
                : wa.connection === 'qr'
                  ? 'rgba(59,130,246,0.18)'
                  : 'rgba(255,255,255,0.10)',
              border: wa.connection === 'open'
                ? '1px solid rgba(34,197,94,0.35)'
                : wa.connection === 'qr'
                  ? '1px solid rgba(59,130,246,0.35)'
                  : '1px solid rgba(255,255,255,0.12)',
              color: wa.connection === 'open' ? '#4ade80' : wa.connection === 'qr' ? '#93c5fd' : 'var(--text-main)'
            }}
          >
            {wa.connection === 'open' ? 'Conectado' : wa.connection === 'qr' ? 'Aguardando QR' : wa.connection === 'close' ? 'Desconectado' : 'Iniciando'}
          </span>
        </div>

        <div className="card-body">
          {wa.connection === 'open' ? (
            <div style={{ opacity: 0.85 }}>
              WhatsApp conectado. Se desconectar, o QR aparece aqui automaticamente.
            </div>
          ) : wa.dataUrl ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 340,
                  maxWidth: '100%',
                  padding: '0.75rem',
                  borderRadius: '14px',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 18px 45px rgba(0,0,0,0.35)'
                }}
              >
                <img
                  alt="QR Code WhatsApp"
                  src={wa.dataUrl}
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px' }}
                />
              </div>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontWeight: 650, marginBottom: '0.4rem' }}>Como conectar</div>
                <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                  No WhatsApp: Dispositivos conectados → Conectar um dispositivo → escaneie o QR.
                </div>
                <div style={{ marginTop: '0.9rem' }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setWa(prev => ({ ...prev, dataUrl: '' }))
                      fetch('/api/wa/qr', { cache: 'no-store' }).then(r=>r.ok ? r.json() : null).then(j=>{
                        if (j?.ok) setWa(prev => ({ ...prev, dataUrl: j.dataUrl || prev.dataUrl, lastQrAt: Number(j.ts || prev.lastQrAt || 0) }))
                      }).catch(()=>{})
                    }}
                  >
                    <FiRefreshCw /> Atualizar QR
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ opacity: 0.85 }}>
                {wa.connection === 'qr'
                  ? 'Gerando QR…'
                  : 'Aguardando o WhatsApp gerar um QR. Se a sessão estiver válida, ele conecta sozinho.'}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  fetch('/api/wa/status', { cache: 'no-store' }).then(r=>r.json()).then(s=>{
                    if (s?.ok) setWa(prev => ({ ...prev, connected: !!s.connected, connection: s.connection || 'unknown', lastQrAt: Number(s.lastQrAt || 0) }))
                    return fetch('/api/wa/qr', { cache: 'no-store' })
                  }).then(r=>r && r.ok ? r.json() : null).then(j=>{
                    if (j?.ok) setWa(prev => ({ ...prev, dataUrl: j.dataUrl || prev.dataUrl, lastQrAt: Number(j.ts || prev.lastQrAt || 0) }))
                  }).catch(()=>{})
                }}
              >
                <FiRefreshCw /> Ver QR
              </button>
            </div>
          )}
        </div>
      </div>

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
