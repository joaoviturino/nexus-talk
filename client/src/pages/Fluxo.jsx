import React, { useEffect, useRef, useState } from 'react'
import { FiSave, FiPlusCircle, FiTrash2, FiMessageSquare, FiGitBranch, FiClock, FiZap, FiLink, FiUpload, FiDownload, FiLayout, FiX, FiCheck } from 'react-icons/fi'

export default function Fluxo(){
  const [flows, setFlows] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [currentName, setCurrentName] = useState('')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [connectMode, setConnectMode] = useState(null)
  const [wireMode, setWireMode] = useState(false)
  const canvasRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [pan, setPan] = useState(null)
  const [ghostWire, setGhostWire] = useState(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [newFlowOpen, setNewFlowOpen] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [toast, setToast] = useState('')
  const [uploadingAudioId, setUploadingAudioId] = useState('')
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [startModalFromId, setStartModalFromId] = useState(null)

  useEffect(()=>{
    fetch('/api/flows').then(r=>r.json()).then(json=>{
      setFlows(json.flows || [])
      if ((json.flows||[]).length) {
        loadFlow(json.flows[0].id)
      }
    })
  },[])

  const loadFlow = async (id) => {
    const r = await fetch(`/api/flows/${id}`)
    const j = await r.json()
    if(j.ok){
      setCurrentId(j.id)
      setCurrentName(j.name)
      const loadedNodes = (j.data?.nodes || []).map(n => {
        if (n.type === 'condition') {
          const baseCases = [{ key:'if', label:'Se respondeu' }, { key:'else', label:'Se não respondeu' }]
          n = {
            ...n,
            data: {
              waitKind: n.data?.waitKind || 'any',
              waitValue: n.data?.waitValue || '',
              timeoutHours: n.data?.timeoutHours || 1,
              cases: Array.isArray(n.data?.cases) && n.data.cases.length ? n.data.cases : baseCases
            }
          }
        }
        if (n.type === 'quick_reply') {
          if (!Array.isArray(n.data?.options) || !n.data.options.length) {
            n = { ...n, data: { ...n.data, options: [{ key:'opt1', text:'Digite a opção 1' }, { key:'opt2', text:'Digite a opção 2' }] } }
          }
        }
        return n
      })
      setNodes(loadedNodes)
      setEdges(j.data?.edges || [])
    }
  }

  const createFlow = () => {
    setNewFlowOpen(true)
    setNewFlowName('')
  }
  const confirmCreateFlow = async () => {
    const name = newFlowName.trim()
    if(!name) return
    const r = await fetch('/api/flows', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name }) })
    const j = await r.json()
    if(j.ok){
      await loadFlow(j.id)
      const list = await fetch('/api/flows').then(r=>r.json())
      setFlows(list.flows || [])
      setToast('Fluxo Criado')
      setTimeout(()=>setToast(''),2000)
    } else {
      setToast('Erro ao Criar Fluxo')
      setTimeout(()=>setToast(''),2000)
    }
    setNewFlowOpen(false)
  }

  const saveFlow = async () => {
    if(!currentId) return
    const payload = { nodes, edges }
    const r = await fetch(`/api/flows/${currentId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ data: payload }) })
    const j = await r.json()
    if(j.ok){
      setToast('Fluxo Salvo')
      setTimeout(()=>setToast(''),2000)
    } else {
      setToast('Falha ao Salvar')
      setTimeout(()=>setToast(''),2000)
    }
  }

  const exportFlow = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fluxo-${currentName || currentId}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const importFlow = async (file) => {
    const text = await file.text()
    try{
      const j = JSON.parse(text)
      setNodes(Array.isArray(j.nodes)?j.nodes:[])
      setEdges(Array.isArray(j.edges)?j.edges:[])
    }catch{}
  }

  const addNode = (type, fromId = null) => {
    const id = 'n'+Math.random().toString(36).slice(2,9)
    const origin = fromId ? nodes.find(n=>n.id===fromId) : null
    const base = {
      id,
      x: origin ? origin.x + 320 : 80,
      y: origin ? origin.y : 80,
      type,
      data: {}
    }
    if(type === 'message') base.data = { text:'' }
    if(type === 'audio') base.data = { audioUrl:'' }
    if(type === 'quick_reply') base.data = { body:'', title:'', subtitle:'', footer:'', options:[{ key:'opt1', text:'Digite a opção 1' }, { key:'opt2', text:'Digite a opção 2' }] }
    if(type === 'condition') base.data = { waitKind:'any', waitValue:'', timeoutHours:1, cases:[{ key:'if', label:'Se respondeu' }, { key:'else', label:'Se não respondeu' }] }
    if(type === 'delay') base.data = { seconds:5 }
    if(type === 'action') base.data = { kind:'label', value:'', url:'', displayText:'Follow Me' }
    setNodes(v=>[...v, base])
    if (origin) {
      setEdges(v=>[...v,{ id:'e'+Math.random().toString(36).slice(2,9), from:origin.id, to:id, port:'next' }])
    }
  }

  const toWorld = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale
    }
  }
  const onMouseDownNode = (e, node) => {
    const p = toWorld(e.clientX, e.clientY)
    setDrag({
      id: node.id,
      offsetX: p.x - node.x,
      offsetY: p.y - node.y
    })
  }
  const onMouseDownCanvas = (e) => {
    if (e.target !== canvasRef.current) return
    setPan({
      startX: e.clientX,
      startY: e.clientY,
      vx: viewport.x,
      vy: viewport.y
    })
  }
  const onMouseMoveCanvas = (e) => {
    if(!drag && !connectMode && !pan) return
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    if (pan) {
      const dx = e.clientX - pan.startX
      const dy = e.clientY - pan.startY
      setViewport(v=>({ ...v, x: pan.vx + dx, y: pan.vy + dy }))
    }
    if (drag) {
      const x = (cx - viewport.x) / viewport.scale - drag.offsetX
      const y = (cy - viewport.y) / viewport.scale - drag.offsetY
      setNodes(v=>v.map(n=>n.id===drag.id?{...n,x,y}:n))
    }
    if (connectMode && ghostWire) {
      const wx = (cx - viewport.x) / viewport.scale
      const wy = (cy - viewport.y) / viewport.scale
      setGhostWire(g=>g?{...g, x2:wx, y2:wy}:null)
    }
  }
  const onMouseUpCanvas = () => {
    setDrag(null)
    setPan(null)
    setGhostWire(null)
  }

  const startConnect = (fromId, port) => setConnectMode({ fromId, port })
  const finishConnect = (toId) => {
    if(connectMode && toId !== connectMode.fromId){
      setEdges(v=>[...v,{ id:'e'+Math.random().toString(36).slice(2,9), from:connectMode.fromId, to:toId, port:connectMode.port || 'next' }])
    }
    setConnectMode(null)
  }

  const removeNode = (id) => {
    setNodes(v=>v.filter(n=>n.id!==id))
    setEdges(v=>v.filter(e=>e.from!==id && e.to!==id))
  }
  const removeEdge = (id) => setEdges(v=>v.filter(e=>e.id!==id))

  const updateNodeData = (id, patch) => setNodes(v=>v.map(n=>n.id===id?{...n, data:{...n.data, ...patch}}:n))
  const handleMouseDownOut = (e, n, port) => {
    e.preventDefault()
    e.stopPropagation()
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const handleRect = e.currentTarget.getBoundingClientRect()
    const sx = handleRect.left - canvasRect.left + handleRect.width / 2
    const sy = handleRect.top - canvasRect.top + handleRect.height / 2
    const x1 = (sx - viewport.x) / viewport.scale
    const y1 = (sy - viewport.y) / viewport.scale
    setGhostWire({ x1, y1, x2: x1, y2: y1 })
    startConnect(n.id, port)
  }
  const getHandleLabel = (port) => {
    if (port === 'if') return 'Se respondeu'
    if (port && port.startsWith('elseif')) return 'Senão se'
    if (port === 'else') return 'Se não respondeu'
    return 'Next'
  }

  const onWheelCanvas = (e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const scale = viewport.scale
    const nextScale = Math.min(2.5, Math.max(0.5, scale * (e.deltaY > 0 ? 0.9 : 1.1)))
    const wx = (cx - viewport.x) / scale
    const wy = (cy - viewport.y) / scale
    const nx = cx - wx * nextScale
    const ny = cy - wy * nextScale
    setViewport({ x: nx, y: ny, scale: nextScale })
  }

  const uploadAudio = async (nodeId, file) => {
    if (!file) return
    setUploadingAudioId(nodeId)
    try{
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method:'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.path) {
        updateNodeData(nodeId, { audioUrl: json.path })
        setToast('Áudio carregado')
        setTimeout(()=>setToast(''),2000)
      } else {
        setToast(json.error || 'Falha no upload do áudio')
        setTimeout(()=>setToast(''),2500)
      }
    }catch(e){
      setToast(e.message || 'Falha no upload do áudio')
      setTimeout(()=>setToast(''),2500)
    }finally{
      setUploadingAudioId('')
    }
  }

  return (
    <>
      <h1>Fluxo de Conversas</h1>
      <div className="card" style={{ padding: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="select" style={{ width: 'auto', minWidth: 200, marginBottom: 0 }} value={currentId || ''} onChange={e=>loadFlow(e.target.value)}>
          <option value="">Selecione um Fluxo</option>
          {flows.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className="btn btn-primary" onClick={createFlow}><FiPlusCircle /> Novo Fluxo</button>
        <div style={{ flex: 1 }}></div>
        <button className="btn" onClick={saveFlow}><FiSave /> Salvar</button>
        <label className="btn btn-outline btn-icon" title="Importar">
          <FiUpload />
          <input type="file" style={{ display:'none' }} onChange={e=>e.target.files[0]&&importFlow(e.target.files[0])} />
        </label>
        <button className="btn btn-outline btn-icon" onClick={exportFlow} title="Exportar"><FiDownload /></button>
      </div>

      <div className="flow-workspace" style={{ height: 'calc(100vh - 220px)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {paletteOpen && (
          <div className="flow-palette" style={{ width: 220, background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', padding: '1rem', overflowY: 'auto' }}>
            <div className="card-title" style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <FiLayout /> Blocos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('message')}><FiMessageSquare /> Mensagem</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('quick_reply')}><FiLink /> Reply Button</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('audio')}><FiUpload /> Áudio</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('condition')}><FiGitBranch /> Aguardar resposta</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('delay')}><FiClock /> Atraso</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: '0.5rem' }} onClick={()=>addNode('action')}><FiZap /> Ação</button>
            </div>
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={()=>setPaletteOpen(false)}><FiX /> Ocultar Menu</button>
            </div>
          </div>
        )}
        {!paletteOpen && (
           <button className="btn btn-outline btn-icon" style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }} onClick={()=>setPaletteOpen(true)}><FiLayout /></button>
        )}

        <button className="flow-start-btn" onClick={()=>{ setStartModalFromId(null); setStartModalOpen(true) }}>
          <span>Primeiro Passo</span>
          <FiPlusCircle />
        </button>

        <div className={'flow-canvas' + (wireMode ? ' wire-mode' : '')} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0f172a' }} ref={canvasRef} onMouseDown={onMouseDownCanvas} onMouseMove={onMouseMoveCanvas} onMouseUp={onMouseUpCanvas} onWheel={onWheelCanvas}>
          <div className="flow-layer" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            <svg className="flow-edges" width="10000" height="10000" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              <defs>
                <linearGradient id="flowEdgeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
                <filter id="flowEdgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="0 0 0 0 0.1  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.6 0"
                  />
                </filter>
                <marker id="flowEdgeArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
                </marker>
              </defs>
              {edges.map(e=>{
                const a = nodes.find(n=>n.id===e.from)
                const b = nodes.find(n=>n.id===e.to)
                if(!a || !b) return null
                const x1 = a.x + 140, y1 = a.y + 140
                const x2 = b.x + 140, y2 = b.y + 140
                const path = `M ${x1} ${y1} C ${x1+60} ${y1} ${x2-60} ${y2} ${x2} ${y2}`
                let label = e.port==='if' ? 'Se' : (e.port?.startsWith('elseif') ? 'Senão se' : (e.port==='else' ? 'Senão' : 'Next'))
                if (a.type === 'quick_reply' && Array.isArray(a.data?.options)) {
                  const opt = a.data.options.find(o=>o.key===e.port)
                  if (opt?.text) label = opt.text
                }
                return (
                  <g key={e.id} style={{ pointerEvents: 'stroke' }}>
                    <path d={path} stroke="url(#flowEdgeGradient)" fill="none" strokeWidth="4" opacity="0.22" filter="url(#flowEdgeGlow)" />
                    <path d={path} stroke="url(#flowEdgeGradient)" fill="none" strokeWidth="2.5" markerEnd="url(#flowEdgeArrow)" />
                    <text x={(x1+x2)/2} y={(y1+y2)/2 - 8} fill="#cbd5f5" fontSize="11" textAnchor="middle">{label}</text>
                  </g>
                )
              })}
              {ghostWire && (() => {
                const x1 = ghostWire.x1, y1 = ghostWire.y1
                const x2 = ghostWire.x2, y2 = ghostWire.y2
                const path = `M ${x1} ${y1} C ${x1+60} ${y1} ${x2-60} ${y2} ${x2} ${y2}`
                return (
                  <path
                    d={path}
                    stroke="#38bdf8"
                    fill="none"
                    strokeWidth="2.5"
                    strokeDasharray="6 6"
                    markerEnd="url(#flowEdgeArrow)"
                  />
                )
              })()}
            </svg>

            {nodes.map(n=>(
              <div key={n.id} className="flow-node" style={{ left:n.x, top:n.y }} onMouseUp={()=>connectMode && finishConnect(n.id)}>
              <div className="flow-node-header" onMouseDown={e=>onMouseDownNode(e,n)}>
                <span className="flow-node-title">
                  {n.type==='message' && <FiMessageSquare />}
                  {n.type==='quick_reply' && <FiLink />}
                  {n.type==='condition' && <FiGitBranch />}
                  {n.type==='delay' && <FiClock />}
                  {n.type==='action' && <FiZap />}
                  {' '} {n.type==='condition' ? 'Aguardar resposta' : n.type.charAt(0).toUpperCase() + n.type.slice(1).replace('_', ' ')}
                </span>
                <div className="flow-node-actions">
                  <button className="btn btn-icon btn-xs" onClick={()=>removeNode(n.id)}><FiTrash2 /></button>
                </div>
              </div>
              <div className="flow-node-body" onMouseUp={()=>connectMode && finishConnect(n.id)}>
                {n.type==='message' && (
                  <>
                    <div className="msg-box">
                      <textarea className="msg-textarea" rows="3" placeholder="Digite a mensagem..." value={n.data.text} onChange={e=>updateNodeData(n.id,{ text:e.target.value })} />
                    </div>
                  </>
                )}
                {n.type==='audio' && (
                  <div className="upload-form">
                    <label className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                       <FiUpload /> Upload
                       <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e=>uploadAudio(n.id, e.target.files[0])} />
                    </label>
                    {n.data.audioUrl && <span className="badge" style={{ marginTop: '0.5rem' }}><FiCheck /> Áudio pronto</span>}
                    {uploadingAudioId===n.id && <span className="badge">Enviando...</span>}
                  </div>
                )}
                {n.type==='quick_reply' && (
                  <div className="quick-reply-form">
                    <input className="input input-sm" placeholder="Texto da mensagem" value={n.data.body || ''} onChange={e=>updateNodeData(n.id,{ body:e.target.value })} />
                    <input className="input input-sm" placeholder="Título" value={n.data.title || ''} onChange={e=>updateNodeData(n.id,{ title:e.target.value })} />
                    <input className="input input-sm" placeholder="Subtítulo" value={n.data.subtitle || ''} onChange={e=>updateNodeData(n.id,{ subtitle:e.target.value })} />
                    <input className="input input-sm" placeholder="Rodapé" value={n.data.footer || ''} onChange={e=>updateNodeData(n.id,{ footer:e.target.value })} />
                    {(n.data.options || []).map((opt)=>(
                      <div key={opt.key} className="flow-case-row">
                        <input className="input input-sm" value={opt.text || ''} onChange={e=>{
                          const copy = (n.data.options||[]).map(o=>o.key===opt.key?{...o, text:e.target.value}:o)
                          updateNodeData(n.id,{ options:copy })
                        }} />
                        <div className="flow-handle out" style={{ right:-6 }} onMouseDown={(e)=>handleMouseDownOut(e, n, opt.key)}>
                          <span className="flow-handle-label">{opt.text || 'Opção'}</span>
                        </div>
                      </div>
                    ))}
                    {(n.data.options||[]).length < 3 && (
                      <button className="btn btn-outline btn-sm" onClick={()=>{
                        const copy = [...(n.data.options||[])]
                        const idx = copy.length + 1
                        copy.push({ key:`opt${idx}`, text:`digite a opção ${idx}` })
                        updateNodeData(n.id,{ options:copy })
                      }}><FiPlusCircle /> Add Opção</button>
                    )}
                  </div>
                )}
                {n.type==='condition' && (
                  <div className="await-response">
                    <div className="await-field">
                      <span className="await-label">Tipo de resposta</span>
                      <select
                        className="select select-sm"
                        value={n.data.waitKind || 'any'}
                        onChange={e=>updateNodeData(n.id,{ waitKind:e.target.value })}
                      >
                        <option value="any">Qualquer resposta</option>
                        <option value="text">Mensagem de texto</option>
                        <option value="contains">Mensagem que contém</option>
                        <option value="equals">Mensagem exatamente igual</option>
                        <option value="starts">Mensagem que começa com</option>
                      </select>
                    </div>
                    {(n.data.waitKind === 'contains' || n.data.waitKind === 'equals' || n.data.waitKind === 'starts') && (
                      <input
                        className="input input-sm"
                        placeholder="Digite o texto esperado"
                        value={n.data.waitValue || ''}
                        onChange={e=>updateNodeData(n.id,{ waitValue:e.target.value })}
                      />
                    )}
                    <div className="await-field">
                      <span className="await-label">Tempo de espera</span>
                      <div className="await-time">
                        <input
                          className="input input-sm"
                          type="number"
                          min="1"
                          value={n.data.timeoutHours || 1}
                          onChange={e=>updateNodeData(n.id,{ timeoutHours:+e.target.value })}
                        />
                        <span>hora(s)</span>
                      </div>
                    </div>
                    <div className="await-hint">Aguardar resposta do usuário antes de continuar</div>
                  </div>
                )}
                {n.type==='delay' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input className="input" type="number" min="0" value={n.data.seconds} onChange={e=>updateNodeData(n.id,{ seconds:+e.target.value })} style={{ width: 80 }} />
                    <span>segundos</span>
                  </div>
                )}
                {n.type==='action' && (
                  <>
                    <select className="select select-sm" value={n.data.kind} onChange={e=>updateNodeData(n.id,{ kind:e.target.value })}>
                      <option value="label">Adicionar Etiqueta</option>
                      <option value="webhook">Chamar Webhook</option>
                      <option value="cta_url">Botão URL</option>
                    </select>
                    {n.data.kind === 'cta_url' ? (
                      <>
                        <input className="input input-sm" placeholder="Texto do botão" value={n.data.displayText || ''} onChange={e=>updateNodeData(n.id,{ displayText:e.target.value })} />
                        <input className="input input-sm" placeholder="Link do botão" value={n.data.url || ''} onChange={e=>updateNodeData(n.id,{ url:e.target.value })} />
                      </>
                    ) : (
                      <input className="input input-sm" placeholder="Valor" value={n.data.value || ''} onChange={e=>updateNodeData(n.id,{ value:e.target.value })} />
                    )}
                  </>
                )}
                <button className="btn btn-outline btn-sm flow-next-btn" onClick={()=>{ setStartModalFromId(n.id); setStartModalOpen(true) }}>
                  <FiPlusCircle /> Próxima ação
                </button>
              </div>
              <div className="flow-handle in" style={{ left:18, bottom:14 }} />
              {n.type==='condition'
                ? Array.isArray(n.data.cases) && n.data.cases.map((c,idx)=>(
                    <div key={c.key} className="flow-handle out" style={{ left:90 + idx*60, bottom:14 }}
                      onMouseDown={(e)=>handleMouseDownOut(e, n, c.key)}>
                      <span className="flow-handle-label">{getHandleLabel(c.key)}</span>
                    </div>
                  ))
                : n.type==='quick_reply'
                  ? Array.isArray(n.data.options) && n.data.options.map((opt,idx)=>(
                      <div key={opt.key} className="flow-handle out" style={{ left:90 + idx*60, bottom:14 }}
                        onMouseDown={(e)=>handleMouseDownOut(e, n, opt.key)}>
                        <span className="flow-handle-label">{opt.text || 'Opção'}</span>
                      </div>
                    ))
                  : <div className="flow-handle out" style={{ left:240, bottom:14 }}
                      onMouseDown={(e)=>handleMouseDownOut(e, n, 'next')}>
                      <span className="flow-handle-label">{getHandleLabel('next')}</span>
                    </div>
              }
            </div>
          ))}
          </div>
        </div>
      </div>
      {newFlowOpen && (
        <div className="modal" onMouseUp={e=>e.stopPropagation()}>
          <div className="modal-body">
            <div className="modal-title">Criar Fluxo</div>
            <div className="upload-form">
              <input className="input" type="text" placeholder="Nome do Fluxo" value={newFlowName} onChange={e=>setNewFlowName(e.target.value)} />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={confirmCreateFlow}>Criar</button>
                <button className="btn btn-outline" onClick={()=>setNewFlowOpen(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {startModalOpen && (
        <div className="modal" onClick={()=>{ setStartModalOpen(false); setStartModalFromId(null) }}>
          <div className="modal-body flow-step-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Adicionar passo inicial</div>
            <div className="flow-step-grid">
              <button className="flow-step-card" onClick={()=>{ addNode('message', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiMessageSquare />
                <span>Mensagem</span>
              </button>
              <button className="flow-step-card" onClick={()=>{ addNode('quick_reply', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiLink />
                <span>Quick Reply</span>
              </button>
              <button className="flow-step-card" onClick={()=>{ addNode('audio', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiUpload />
                <span>Áudio</span>
              </button>
              <button className="flow-step-card" onClick={()=>{ addNode('delay', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiClock />
                <span>Atraso</span>
              </button>
              <button className="flow-step-card" onClick={()=>{ addNode('condition', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiGitBranch />
                <span>Condição</span>
              </button>
              <button className="flow-step-card" onClick={()=>{ addNode('action', startModalFromId); setStartModalOpen(false); setStartModalFromId(null) }}>
                <FiZap />
                <span>Ação</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={()=>{ setStartModalOpen(false); setStartModalFromId(null) }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">{toast}</div>
      )}
    </>
  )
}
