import React, { useEffect, useMemo, useState } from 'react'
import { FiPhoneCall } from 'react-icons/fi'

export default function LiveChat(){
  const [chats, setChats] = useState([])
  const [current, setCurrent] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [presence, setPresence] = useState({})
  const [search, setSearch] = useState('')
  const [flows, setFlows] = useState([])
  const [callOpen, setCallOpen] = useState(false)
  const [callNumber, setCallNumber] = useState('')
  const [callMode, setCallMode] = useState('text')
  const [callText, setCallText] = useState('')
  const [callFlowId, setCallFlowId] = useState('')
  const [previewImage, setPreviewImage] = useState('')

  useEffect(()=>{
    fetch('/api/chat/chats').then(r=>r.json()).then(j=>setChats(j.chats||[]))
    fetch('/api/flows').then(r=>r.json()).then(j=>setFlows(j.flows||[]))
  },[])

  useEffect(()=>{
    if(!current) return
    fetch(`/api/chat/messages?jid=${encodeURIComponent(current.jid)}&limit=100`).then(r=>r.json()).then(j=>setMessages(j.messages||[]))
    fetch('/api/chat/subscribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ jid: current.jid }) })
  },[current])

  useEffect(()=>{
    const es = new EventSource('/api/chat/events')
    es.addEventListener('message', (ev)=>{
      try{
        const data = JSON.parse(ev.data)
        if (!data?.jid) return
        if (current?.jid === data.jid) {
          fetch(`/api/chat/messages?jid=${encodeURIComponent(data.jid)}&limit=100`).then(r=>r.json()).then(j=>setMessages(j.messages||[]))
        }
        fetch('/api/chat/chats').then(r=>r.json()).then(j=>setChats(j.chats||[]))
      }catch{}
    })
    es.addEventListener('presence', (ev)=>{
      try{
        const data = JSON.parse(ev.data)
        if (!data?.jid) return
        setPresence(p=>({ ...p, [data.jid]: data.status }))
      }catch{}
    })
    return () => es.close()
  },[current])

  const send = async () => {
    if (!current || !text.trim()) return
    try {
      const res = await fetch('/api/chat/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ jid: current.jid, text }) })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        alert('Erro ao enviar mensagem: ' + (json.error || res.statusText))
        return
      }
      setText('')
      const j = await fetch(`/api/chat/messages?jid=${encodeURIComponent(current.jid)}&limit=100`).then(r=>r.json())
      setMessages(j.messages || [])
    } catch (e) {
      alert('Erro de conexão: ' + e.message)
    }
  }

  const normalizeTs = (ts) => {
    if (!ts) return null
    const n = Number(ts)
    if (!Number.isFinite(n)) return null
    return n < 100000000000 ? n * 1000 : n
  }
  const formatDate = (ts) => {
    const t = normalizeTs(ts)
    if (!t) return ''
    return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const formatTime = (ts) => {
    const t = normalizeTs(ts)
    if (!t) return ''
    return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const displayItems = useMemo(()=>{
    const items = []
    let lastDate = ''
    for (const m of messages) {
      const dateLabel = formatDate(m.timestamp)
      if (dateLabel && dateLabel !== lastDate) {
        items.push({ kind: 'date', id: `date-${dateLabel}`, label: dateLabel })
        lastDate = dateLabel
      }
      items.push({ kind: 'message', ...m })
    }
    return items
  },[messages])

  const title = useMemo(()=>current?.name || current?.jid || 'Bate-papo ao Vivo',[current])
  const status = current?.jid ? (presence[current.jid] || 'offline') : ''
  const filteredChats = useMemo(()=>{
    const term = search.trim().toLowerCase()
    if (!term) return chats
    return chats.filter(c=>String(c.name||'').toLowerCase().includes(term) || String(c.jid||'').toLowerCase().includes(term))
  },[chats,search])
  const openCall = () => {
    setCallOpen(true)
    setCallNumber('')
    setCallMode('text')
    setCallText('')
    setCallFlowId('')
  }
  const startCall = async () => {
    const number = callNumber.replace(/\D+/g,'')
    if (!number) return
    if (callMode === 'text' && !callText.trim()) return
    if (callMode === 'flow' && !callFlowId) return
    try {
      const res = await fetch('/api/chat/start', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          number,
          mode: callMode,
          text: callText,
          flowId: callFlowId
        })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        alert('Erro ao iniciar conversa: ' + (json.error || res.statusText))
        return
      }
      const list = await fetch('/api/chat/chats').then(r=>r.json())
      setChats(list.chats || [])
      const jid = `${number}@s.whatsapp.net`
      setCurrent({ jid, name: number })
      setCallOpen(false)
    } catch (e) {
      alert('Erro de conexão: ' + e.message)
    }
  }

  return (
    <div className="livechat">
      <div className="livechat-sidebar">
        <div className="livechat-sidebar-top">
          <div className="livechat-search">
            <input className="input" placeholder="Buscar contato" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>
        <div className="livechat-list">
          {filteredChats.map(c=>(
            <button key={c.jid} className={'livechat-item' + (current?.jid===c.jid ? ' active' : '')} onClick={()=>setCurrent(c)}>
              <div className="livechat-avatar">{(c.name||c.jid||'?').slice(0,1).toUpperCase()}</div>
              <div className="livechat-item-body">
                <div className="livechat-name">{c.name || c.jid}</div>
                <div className="livechat-sub">{c.jid}</div>
              </div>
              <span className={'livechat-dot ' + (presence[c.jid] || 'offline')} />
            </button>
          ))}
        </div>
      </div>
      <div className="livechat-main">
        <div className="livechat-header">
          <div className="livechat-header-left">
            <div className="livechat-header-avatar">{(title||'?').slice(0,1).toUpperCase()}</div>
            <div>
              <div className="livechat-header-title">{title}</div>
              <div className={'livechat-status ' + status}>{status}</div>
            </div>
          </div>
          <button className="btn btn-outline" onClick={openCall}><FiPhoneCall /> Chamar</button>
        </div>
        <div className="livechat-messages">
          {displayItems.map(item=> item.kind === 'date' ? (
            <div key={item.id} className="livechat-date">{item.label}</div>
          ) : (
            <div key={item.id} className={'livechat-bubble ' + (item.from_jid==='me' ? 'out' : 'in')}>
              {item.type === 'audio' && item.media_path ? (
                <div className="livechat-media">
                  <audio controls src={item.media_path} />
                  <a className="livechat-audio" href={`/api/chat/download/${item.id}`}>Baixar áudio</a>
                </div>
              ) : item.type === 'image' && item.media_path ? (
                <img className="livechat-image" src={item.media_path} alt="" onClick={()=>setPreviewImage(item.media_path)} />
              ) : item.type === 'video' && item.media_path ? (
                <video className="livechat-video" controls src={item.media_path} />
              ) : item.type === 'document' && item.media_path ? (
                <a className="livechat-doc" href={`/api/chat/download/${item.id}`}>{item.body || 'Baixar documento'}</a>
              ) : (
                <span>{item.body}</span>
              )}
              <div className="livechat-time">{formatTime(item.timestamp)}</div>
            </div>
          ))}
        </div>
        {current && (
          <div className="livechat-input">
            <label className="btn btn-outline livechat-attach">
              Anexo
              <input type="file" onChange={async e=>{
                const file = e.target.files?.[0]
                if (!file || !current) return
                const fd = new FormData()
                fd.append('file', file)
                const res = await fetch('/api/upload', { method:'POST', body: fd })
                const json = await res.json()
                if (json.ok && json.path) {
                  await fetch('/api/chat/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ jid: current.jid, mediaPath: json.path, mediaType: file.type, fileName: file.name, text: text.trim() }) })
                  setText('')
                }
              }} />
            </label>
            <input className="input livechat-text" value={text} onChange={e=>setText(e.target.value)} placeholder="Digite sua mensagem" />
            <button className="btn btn-primary" onClick={send}>Enviar</button>
          </div>
        )}
      </div>
      {callOpen && (
        <div className="modal">
          <div className="modal-body livechat-call">
            <div className="modal-title">Iniciar Nova Conversa</div>
            <div className="livechat-call-row">
              <span className="livechat-code">+55</span>
              <input className="input" placeholder="Digite o número do WhatsApp" value={callNumber} onChange={e=>setCallNumber(e.target.value)} />
            </div>
            <div className="livechat-call-actions">
              <button className={'btn' + (callMode==='text' ? ' btn-primary' : '')} onClick={()=>setCallMode('text')}>Mensagem Personalizada</button>
              <button className={'btn' + (callMode==='flow' ? ' btn-primary' : '')} onClick={()=>setCallMode('flow')}>Fluxo</button>
            </div>
            {callMode === 'text' ? (
              <textarea className="input livechat-call-text" rows="4" placeholder="Digite a mensagem" value={callText} onChange={e=>setCallText(e.target.value)} />
            ) : (
              <select className="select" value={callFlowId} onChange={e=>setCallFlowId(e.target.value)}>
                <option value="">Selecione o Fluxo</option>
                {flows.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={startCall}>Iniciar Conversa</button>
              <button className="btn btn-outline" onClick={()=>setCallOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {previewImage && (
        <div className="modal" onClick={()=>setPreviewImage('')}>
          <div className="livechat-preview" onClick={e=>e.stopPropagation()}>
            <img src={previewImage} alt="" />
          </div>
        </div>
      )}
    </div>
  )
}
