import React, { useEffect, useMemo, useState } from 'react'
import { FiSend, FiUsers, FiFilter, FiSearch, FiMessageSquare, FiMic, FiShare2, FiUser, FiSmartphone, FiCheck, FiX } from 'react-icons/fi'

export default function Disparo(){
  const [clients, setClients] = useState([])
  const [labels, setLabels] = useState([])
  const [flows, setFlows] = useState([])
  const [tab, setTab] = useState('massa')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [labelId, setLabelId] = useState('')
  const [step, setStep] = useState(null)
  const [mode, setMode] = useState('selected')
  const [singleMode, setSingleMode] = useState('base')
  const [singleClientId, setSingleClientId] = useState('')
  const [singleNumber, setSingleNumber] = useState('')
  const [sendType, setSendType] = useState('text')
  const [text, setText] = useState('')
  const [flowId, setFlowId] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(()=>{
    fetch('/api/clients').then(r=>r.json()).then(j=>setClients(j.clients||[]))
    fetch('/api/labels').then(r=>r.json()).then(j=>setLabels(j.labels||[]))
    fetch('/api/flows').then(r=>r.json()).then(j=>setFlows(j.flows||[]))
  },[])

  const filteredClients = useMemo(()=>{
    const term = search.trim().toLowerCase()
    return clients.filter(c=>{
      if (!term) return true
      return (c.name||'').toLowerCase().includes(term) || (c.number||'').toLowerCase().includes(term)
    })
  },[clients,search])

  const toggleSelect = (id) => setSelected(v=>({ ...v, [id]: !v[id] }))
  const clearSelection = () => setSelected({})

  const openStep1 = () => {
    setStep(1)
    setMode('selected')
    setSingleMode('base')
    setText('')
    setFlowId('')
    setAudioUrl('')
  }
  const nextStep = () => setStep(2)
  const closeStep = () => setStep(null)

  const canSend = useMemo(()=>{
    if (sendType === 'text' && !text.trim()) return false
    if (sendType === 'flow' && !flowId) return false
    if (sendType === 'audio' && (!audioUrl || uploadingAudio)) return false
    if (tab === 'massa') {
      if (mode === 'selected') {
        const hasAny = Object.values(selected).some(Boolean)
        return hasAny
      }
      if (mode === 'label') return !!labelId
      return false
    } else {
      if (singleMode === 'base') return !!singleClientId
      if (singleMode === 'externo') return !!singleNumber.trim()
      return false
    }
  },[sendType,text,flowId,audioUrl,uploadingAudio,tab,mode,selected,labelId,singleMode,singleClientId,singleNumber])

  const uploadAudio = async (file) => {
    if (!file) return
    setUploadingAudio(true)
    try{
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method:'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.path) {
        setAudioUrl(json.path)
        setToast('Áudio pronto para envio')
        setTimeout(()=>setToast(''), 2000)
      } else {
        setToast(json.error || 'Falha no upload do áudio')
        setTimeout(()=>setToast(''), 2500)
      }
    }catch(e){
      setToast(e.message || 'Falha no upload do áudio')
      setTimeout(()=>setToast(''), 2500)
    }finally{
      setUploadingAudio(false)
    }
  }

  const doSend = async () => {
    if (!canSend || sending) return
    setSending(true)
    try{
      let body = {}
      if (tab === 'massa') {
        if (mode === 'selected') {
          const ids = Object.keys(selected).filter(k=>selected[k]).map(k=>+k)
          const out = clients.filter(c=>ids.includes(c.id)).map(c=>({ name:c.name, number:c.number }))
          body = { mode:'selected', clients: out }
        } else {
          body = { mode:'label', labelId }
        }
      } else {
        if (singleMode === 'base') {
          const c = clients.find(c=>String(c.id)===String(singleClientId))
          if (!c) throw new Error('Cliente não Selecionado')
          body = { mode:'single', single:{ name:c.name, number:c.number } }
        } else {
          if (!singleNumber) throw new Error('Número não Informado')
          body = { mode:'single', single:{ name: singleNumber, number: singleNumber } }
        }
      }
      let url = ''
      if (sendType === 'text') {
        url = '/api/send/text'
        body.text = text
      } else if (sendType === 'flow') {
        url = '/api/send/flow'
        body.flowId = flowId
      } else {
        url = '/api/send/audio'
        body.audioUrl = audioUrl
      }
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
      const ct = res.headers.get('content-type') || ''
      let json = {}
      if (ct.includes('application/json')) {
        try { json = await res.json() } catch { json = { ok:false, error:'Falha ao ler JSON' } }
      } else {
        const txt = await res.text()
        json = { ok:false, error: txt || `HTTP ${res.status}` }
      }
      if (res.ok && json.ok) {
        setToast(`Enviado: ${json.sent ?? ''}`.trim())
        setTimeout(()=>setToast(''), 2500)
        closeStep()
        clearSelection()
      } else {
        setToast(json.error || `HTTP ${res.status}`)
        setTimeout(()=>setToast(''), 2500)
      }
    }catch(e){
      setToast(e.message || 'Falha no envio')
      setTimeout(()=>setToast(''), 2500)
    }finally{
      setSending(false)
    }
  }

  return (
    <>
      <h1>Disparo</h1>
      <div className="tabs">
        <button className={'tab' + (tab==='massa'?' active':'')} onClick={()=>setTab('massa')}><FiUsers /> Disparo em Massa</button>
        <button className={'tab' + (tab==='unico'?' active':'')} onClick={()=>setTab('unico')}><FiUser /> Disparo Único</button>
      </div>

      {tab==='massa' && (
        <div className="card">
          <div className="card-title"><FiFilter /> Selecionar Clientes ou Filtrar</div>
          <div className="upload-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
               <input className="input" placeholder="Buscar por nome ou número..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width: '100%' }} />
               <FiSearch style={{ position: 'absolute', right: 10, top: 12, opacity: 0.5 }} />
            </div>
            <select className="select" value={labelId} onChange={e=>setLabelId(e.target.value)}>
              <option value="">Todas as Etiquetas</option>
              {labels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={openStep1}>Próximo <FiSend /></button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Nome</th>
                  <th>Número</th>
                  <th>Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(c=>(
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={!!selected[c.id]} onChange={()=>toggleSelect(c.id)} /></td>
                    <td>{c.name}</td>
                    <td>{c.number}</td>
                    <td>
                      {(c.labels||[]).map(l=>(
                        <span key={l} className="badge" style={{ marginRight: 4 }}>{l}</span>
                      ))}
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', opacity: 0.6, padding: '2rem' }}>Nenhum cliente encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='unico' && (
        <div className="card">
          <div className="card-title"><FiUser /> Escolha o Cliente</div>
          <div className="upload-form">
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Origem do Contato</label>
            <select className="select" value={singleMode} onChange={e=>setSingleMode(e.target.value)} style={{ marginBottom: '1rem' }}>
              <option value="base">Cliente da Base</option>
              <option value="externo">Novo Número</option>
            </select>
            
            {singleMode==='base' ? (
              <select className="select" value={singleClientId} onChange={e=>setSingleClientId(e.target.value)}>
                <option value="">Selecione o Cliente</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name} - {c.number}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="Ex: 5511999999999" value={singleNumber} onChange={e=>setSingleNumber(e.target.value)} />
            )}
            
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={openStep1}>Próximo <FiSend /></button>
            </div>
          </div>
        </div>
      )}

      {step===1 && (
        <div className="modal">
          <div className="modal-body" style={{ maxWidth: 500 }}>
            <div className="modal-title"><FiSend /> Configurar Envio</div>
            
            {tab==='massa' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Destinatários</label>
                <select className="select" value={mode} onChange={e=>setMode(e.target.value)}>
                  <option value="selected">Selecionados Manualmente ({Object.values(selected).filter(Boolean).length})</option>
                  <option value="label">Todos com a etiqueta selecionada</option>
                </select>
              </div>
            )}
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Tipo de Mensagem</label>
              <select className="select" value={sendType} onChange={e=>setSendType(e.target.value)}>
                <option value="text">Mensagem de Texto</option>
                <option value="flow">Fluxo Automático</option>
                <option value="audio">Áudio Gravado</option>
              </select>
            </div>

            {sendType==='text' ? (
              <div className="form-group">
                <textarea className="input" rows="5" placeholder="Olá! Gostaria de apresentar..." value={text} onChange={e=>setText(e.target.value)} />
              </div>
            ) : sendType==='flow' ? (
              <div className="form-group">
                <select className="select" value={flowId} onChange={e=>setFlowId(e.target.value)}>
                  <option value="">Selecione o Fluxo</option>
                  {flows.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <FiMic /> Carregar Áudio (.ogg / .mp3)
                  <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e=>uploadAudio(e.target.files[0])} />
                </label>
                {audioUrl && <div className="badge" style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FiCheck /> Áudio pronto</div>}
                {uploadingAudio && <div className="badge">Enviando arquivo...</div>}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '2rem' }}>
              <button className="btn btn-primary" onClick={doSend} disabled={!canSend || sending}>
                {sending ? 'Enviando...' : 'Enviar Agora'}
              </button>
              <button className="btn btn-outline" onClick={closeStep}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
