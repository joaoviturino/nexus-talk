import React, { useEffect, useMemo, useState } from 'react'

import { FiUsers, FiDatabase, FiFileText, FiTable, FiCode, FiTrash2, FiPlus, FiTag, FiDownload, FiUpload, FiSearch, FiSave } from 'react-icons/fi'

export default function Upload(){
  const [tab, setTab] = useState('extract')
  const [groups, setGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [modalGroup, setModalGroup] = useState(null)
  const [clients, setClients] = useState([])
  const [labels, setLabels] = useState([])
  const [newClient, setNewClient] = useState({ name: '', number: '' })
  const [importFile, setImportFile] = useState(null)
  const [importType, setImportType] = useState('csv')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (tab === 'extract') {
      setLoadingGroups(true)
      fetch('/api/wa/groups').then(r=>r.json()).then(json=>{
        setGroups(json.groups || [])
        setLoadingGroups(false)
      }).catch(()=>{
        setLoadingGroups(false)
      })
    } else {
      refreshClients()
      refreshLabels()
    }
  }, [tab])

  const refreshClients = () => {
    fetch('/api/clients').then(r=>r.json()).then(json=>{
      setClients(json.clients || [])
    })
  }
  const refreshLabels = () => {
    fetch('/api/labels').then(r=>r.json()).then(json=>{
      setLabels(json.labels || [])
    })
  }

  const downloadExport = async (jid, action) => {
    const res = await fetch(`/api/wa/groups/${encodeURIComponent(jid)}/extract?action=${action}`, { method:'POST' })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = res.headers.get('Content-Disposition')?.match(/filename=\"(.+)\"/)?.[1] || `export.${action}`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const saveToDb = async (jid) => {
    const res = await fetch(`/api/wa/groups/${encodeURIComponent(jid)}/extract?action=save`, { method:'POST' })
    const json = await res.json()
    setMsg(json.ok ? `Salvos: ${json.inserted}` : 'Erro ao salvar')
    setTimeout(()=>setMsg(''), 2500)
    setModalGroup(null)
    refreshClients()
  }

  const setClientLabel = async (clientId, labelId) => {
    await fetch(`/api/clients/${clientId}/labels`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ labelId })
    })
    refreshClients()
  }
  const createLabel = async (name) => {
    await fetch(`/api/labels`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name })
    })
    refreshLabels()
  }
  const addClient = async (e) => {
    e.preventDefault()
    const { name, number } = newClient
    if(!name || !number) return
    const res = await fetch('/api/clients', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(newClient)
    })
    const json = await res.json()
    if(json.ok) {
      setNewClient({ name:'', number:'' })
      refreshClients()
    }
  }
  const updateClient = async (id, payload) => {
    await fetch(`/api/clients/${id}`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    })
    refreshClients()
  }
  const deleteClient = async (id) => {
    await fetch(`/api/clients/${id}`, { method:'DELETE' })
    refreshClients()
  }
  const doImport = async (e) => {
    e.preventDefault()
    if(!importFile) return
    const data = new FormData()
    data.append('file', importFile)
    const res = await fetch(`/api/import?type=${importType}`, { method:'POST', body:data })
    const json = await res.json()
    setMsg(json.ok ? `Importados: ${json.inserted}` : 'Erro na importação')
    setTimeout(()=>setMsg(''), 2500)
    refreshClients()
  }

  const labelMap = useMemo(()=>Object.fromEntries(labels.map(l=>[l.id, l.name])),[labels])

  return (
    <>
      <h1>Extração & Upload</h1>
      <div className="tabs">
        <button className={'tab' + (tab==='extract'?' active':'')} onClick={()=>setTab('extract')}><FiDownload /> Extração</button>
        <button className={'tab' + (tab==='upload'?' active':'')} onClick={()=>setTab('upload')}><FiUpload /> Upload & Base</button>
      </div>

      {tab==='extract' && (
        <div className="card">
          <div className="card-title"><FiUsers /> Grupos Disponíveis</div>
          {loadingGroups ? <div className="upload-result">Carregando grupos...</div> : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Grupo</th><th>Membros</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {groups.map(g=>(
                    <tr key={g.id}>
                      <td><span className="menu-icon"><FiUsers /></span> {g.subject}</td>
                      <td><span className="badge">{g.size}</span></td>
                      <td><button className="btn btn-primary btn-sm" onClick={()=>setModalGroup(g)}><FiDownload /> Extrair Membros</button></td>
                    </tr>
                  ))}
                  {groups.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', opacity:0.6}}>Nenhum grupo encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==='upload' && (
        <>
          <div className="card">
            <div className="card-title"><FiUsers /> Base de Clientes</div>
            <div className="table-responsive" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Nome</th><th>Número</th><th>Etiquetas</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>
                        <input className="input input-sm" value={c.name} onChange={e=>updateClient(c.id,{ name:e.target.value, number:c.number })} />
                      </td>
                      <td>
                        <input className="input input-sm" value={c.number} onChange={e=>updateClient(c.id,{ name:c.name, number:e.target.value })} />
                      </td>
                      <td>
                        <div className="labels-row">{(c.labels||[]).join(', ')}</div>
                        <select className="select select-sm" onChange={e=>setClientLabel(c.id, e.target.value)} style={{ marginTop: '0.2rem' }}>
                          <option value="">+ Etiquetar</option>
                          {labels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </td>
                      <td><button className="btn btn-danger btn-sm" onClick={()=>deleteClient(c.id)}><FiTrash2 /></button></td>
                    </tr>
                  ))}
                  {clients.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', opacity:0.6}}>Nenhum cliente cadastrado</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div className="card">
              <div className="card-title"><FiPlus /> Cadastrar Cliente</div>
              <form className="upload-form" onSubmit={addClient}>
                <div className="form-group">
                   <label>Nome</label>
                   <input className="input" type="text" placeholder="Ex: João Silva" value={newClient.name} onChange={e=>setNewClient(v=>({ ...v, name:e.target.value }))} />
                </div>
                <div className="form-group">
                   <label>Número</label>
                   <input className="input" type="text" placeholder="Ex: 5511999999999" value={newClient.number} onChange={e=>setNewClient(v=>({ ...v, number:e.target.value }))} />
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: '1rem' }}><FiPlus /> Adicionar</button>
              </form>
            </div>
            
            <div className="card">
              <div className="card-title"><FiUpload /> Importar</div>
              <form className="upload-form" onSubmit={doImport}>
                <div className="form-group">
                   <label>Formato</label>
                   <select className="select" value={importType} onChange={e=>setImportType(e.target.value)}>
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                    <option value="sql">SQL</option>
                  </select>
                </div>
                <div className="form-group">
                   <label>Arquivo</label>
                   <input className="input" type="file" onChange={e=>setImportFile(e.target.files[0])} required style={{ paddingTop: '0.5rem' }} />
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: '1rem' }}><FiFileText /> Importar</button>
              </form>
            </div>
            
            <div className="card">
              <div className="card-title"><FiTag /> Etiquetas</div>
              <div className="upload-form">
                <div className="form-group">
                  <label>Nova Etiqueta</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" type="text" placeholder="Nome da etiqueta" id="newLabelName" />
                    <button className="btn btn-outline" onClick={()=>createLabel(document.getElementById('newLabelName').value || '')}><FiPlus /></button>
                  </div>
                </div>
              </div>
              <div className="upload-result" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                 {labels.map(l=><span key={l.id} className="badge">{l.name}</span>)}
              </div>
            </div>
          </div>
        </>
      )}

      {msg && <div className="toast">{msg}</div>}

      {modalGroup && (
        <div className="modal">
          <div className="modal-body">
            <div className="modal-title"><FiUsers /> Extrair de: {modalGroup.subject}</div>
            <div className="modal-actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={()=>saveToDb(modalGroup.id)}><FiDatabase /> Salvar no Banco de Dados Atual</button>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={()=>downloadExport(modalGroup.id, 'csv')}><FiFileText /> CSV</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={()=>downloadExport(modalGroup.id, 'xlsx')}><FiTable /> XLSX</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={()=>downloadExport(modalGroup.id, 'sql')}><FiCode /> SQL</button>
              </div>
            </div>
            <div className="upload-result" style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
               Formatos exportados incluem Nome e Número.
            </div>
            <button className="btn btn-ghost" style={{ marginTop: '1rem', width: '100%' }} onClick={()=>setModalGroup(null)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
