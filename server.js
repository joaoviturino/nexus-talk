const { startServer, createApp } = require('./API/server')

module.exports = { startServer, createApp }

if (require.main === module) startServer()

if (false) {
const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const sqlite3 = require('sqlite3').verbose()
const XLSX = require('xlsx')
const QRCode = require('qrcode')
const { getSock, getConnectionState, getLastQr, getLastQrAt } = require('./wa')
const { executeFlow } = require('./flowRuntime')
const { listChats, listMessages, getMessage, saveMessage, saveChat } = require('./chatStore')
const { addClient, send: sseSend } = require('./sse')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const assetsDir = path.join(__dirname, 'assets')
const publicDir = path.join(__dirname, 'client', 'dist')
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, 'leads.db')
const db = new sqlite3.Database(dbPath)
const flowsPath = path.join(dataDir, 'flows.db')
const flowsDb = new sqlite3.Database(flowsPath)

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    number TEXT
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS client_labels (
    client_id INTEGER,
    label_id INTEGER,
    PRIMARY KEY (client_id, label_id)
  )`)
})
flowsDb.serialize(() => {
  flowsDb.run(`CREATE TABLE IF NOT EXISTS flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    data TEXT,
    created_at INTEGER
  )`)
})

fs.mkdirSync(path.join(assetsDir, 'uploads'), { recursive: true })

app.use('/assets', express.static(assetsDir))
app.use('/', express.static(publicDir))

const uploadStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(assetsDir, 'uploads')),
  filename: (_, file, cb) => {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '_')
    cb(null, name)
  }
})
const upload = multer({ storage: uploadStorage })

app.post('/api/upload', upload.single('file'), (req, res) => {
  res.json({
    ok: true,
    filename: req.file.filename,
    path: `/assets/uploads/${req.file.filename}`
  })
})

app.get('/api/wa/status', (req, res) => {
  const sock = getSock()
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    ok: true,
    connected: !!sock,
    connection: getConnectionState(),
    lastQrAt: getLastQrAt() || 0
  })
})

app.get('/api/wa/qr', async (req, res) => {
  try {
    const qr = getLastQr()
    if (!qr) return res.status(404).json({ ok: false, error: 'QR indisponível' })
    const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
    res.setHeader('Cache-Control', 'no-store')
    res.json({ ok: true, qr, dataUrl, ts: getLastQrAt() || Date.now() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

app.get('/api/chat/chats', async (_, res) => {
  try{
    const rows = await listChats()
    res.json({ ok: true, chats: rows })
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.get('/api/chat/events', (req, res) => {
  addClient(req, res)
})

app.post('/api/chat/subscribe', async (req, res) => {
  try{
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok:false, error:'Bot não conectado' })
    const { jid } = req.body || {}
    if (!jid) return res.status(400).json({ ok:false, error:'jid obrigatório' })
    await sock.presenceSubscribe(jid)
    res.json({ ok:true })
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.get('/api/chat/messages', async (req, res) => {
  try{
    const { jid, before, limit } = req.query
    if (!jid) return res.status(400).json({ ok:false, error:'jid obrigatório' })
    const rows = await listMessages(jid, Number(limit) || 50, Number(before) || Number.MAX_SAFE_INTEGER)
    res.json({ ok:true, messages: rows.reverse() })
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.get('/api/chat/download/:id', async (req, res) => {
  try{
    const msg = await getMessage(req.params.id)
    if (!msg) return res.status(404).json({ ok:false, error:'Mensagem não encontrada' })
    if (!msg.media_path) return res.status(404).json({ ok:false, error:'Sem mídia' })
    const abs = path.join(assetsDir, msg.media_path.replace(/^\/assets\//,''))
    return res.download(abs)
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.post('/api/chat/send', async (req, res) => {
  try{
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok:false, error:'Bot não conectado' })
    const { jid, text, mediaPath, mediaType, fileName } = req.body || {}
    if (!jid || (!text && !mediaPath)) return res.status(400).json({ ok:false, error:'jid e text ou mediaPath obrigatórios' })
    let sent
    if (mediaPath) {
      const rel = String(mediaPath).replace(/^\/assets\//,'')
      const abs = path.join(assetsDir, rel)
      if (mediaType && mediaType.startsWith('image/')) {
        sent = await sock.sendMessage(jid, { image: { url: abs }, caption: text || '' })
      } else if (mediaType && mediaType.startsWith('video/')) {
        sent = await sock.sendMessage(jid, { video: { url: abs }, caption: text || '' })
      } else if (mediaType && mediaType.startsWith('audio/')) {
        sent = await sock.sendMessage(jid, { audio: { url: abs }, ptt: false })
      } else {
        sent = await sock.sendMessage(jid, { document: { url: abs }, fileName: fileName || 'arquivo', mimetype: mediaType || 'application/octet-stream' })
      }
    } else {
      sent = await sock.sendMessage(jid, { text })
    }
    saveChat(jid)
    const id = await saveMessage({
      jid,
      from_jid: 'me',
      timestamp: Date.now(),
      type: mediaPath ? (mediaType?.startsWith('image/') ? 'image' : mediaType?.startsWith('video/') ? 'video' : mediaType?.startsWith('audio/') ? 'audio' : 'document') : 'text',
      body: mediaPath ? (mediaType?.startsWith('audio/') ? '' : (text || '')) : text,
      media_path: mediaPath || '',
      raw_json: {},
      key_id: sent?.key?.id || null
    })
    sseSend('message', { id, jid })
    res.json({ ok:true })
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.post('/api/chat/start', async (req, res) => {
  try{
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok:false, error:'Bot não conectado' })
    const { number, mode, text, flowId } = req.body || {}
    if (!number) return res.status(400).json({ ok:false, error:'number obrigatório' })
    const jid = toJid(number)
    saveChat(jid)
    if (mode === 'flow') {
      if (!flowId) return res.status(400).json({ ok:false, error:'flowId obrigatório' })
      const flow = await new Promise((resolve, reject) => {
        flowsDb.get(`SELECT id, name, data FROM flows WHERE id = ?`, [flowId], (err, row) => err ? reject(err) : resolve(row))
      })
      if (!flow) return res.status(404).json({ ok:false, error:'Fluxo não encontrado' })
      let flowData = {}
      try { flowData = JSON.parse(flow.data || '{}') } catch {}
      await executeFlow(jid, flowData)
      return res.json({ ok:true })
    }
    if (!text || !text.trim()) return res.status(400).json({ ok:false, error:'text obrigatório' })
    const sent = await sock.sendMessage(jid, { text })
    const id = await saveMessage({
      jid,
      from_jid: 'me',
      timestamp: Date.now(),
      type: 'text',
      body: text,
      media_path: '',
      raw_json: {},
      key_id: sent?.key?.id || null
    })
    sseSend('message', { id, jid })
    res.json({ ok:true })
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) })
  }
})

app.get('/api/ping', (_, res) => res.json({ ok: true }))

// ===== WhatsApp group extraction =====
app.get('/api/wa/groups', async (_, res) => {
  try {
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    const data = await sock.groupFetchAllParticipating()
    const groups = Object.values(data).map(g => ({ id: g.id, subject: g.subject, size: g.size }))
    res.json({ ok: true, groups })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

app.get('/api/wa/groups/:jid', async (req, res) => {
  try {
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    const meta = await sock.groupMetadata(req.params.jid)
    const participants = meta.participants.map(p => {
      const jid = p.id
      const number = jid.includes('@') ? jid.split('@')[0] : jid
      return { number, jid, admin: p.admin || null }
    })
    res.json({ ok: true, id: meta.id, subject: meta.subject, size: meta.size, participants })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

function insertClients(rows) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err)
        const stmt = db.prepare(`INSERT INTO clients (name, number) VALUES (?, ?)`)
        let count = 0
        let failed = false
        let pending = rows.length
        if (pending === 0) {
          stmt.finalize(() => {
            db.run('COMMIT', (err2) => err2 ? reject(err2) : resolve(0))
          })
          return
        }
        for (const r of rows) {
          stmt.run([r.name, r.number], (runErr) => {
            if (runErr) {
              failed = true
            } else {
              count++
            }
            pending--
            if (pending === 0) {
              stmt.finalize((finalizeErr) => {
                if (finalizeErr) failed = true
                db.run(failed ? 'ROLLBACK' : 'COMMIT', (endErr) => {
                  if (endErr) return reject(endErr)
                  resolve(count)
                })
              })
            }
          })
        }
      })
    })
  })
}

app.post('/api/wa/groups/:jid/extract', async (req, res) => {
  try {
    const { action } = req.query
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    const meta = await sock.groupMetadata(req.params.jid)
    const rows = meta.participants.map(p => {
      const jid = p.id
      const number = jid.includes('@') ? jid.split('@')[0] : jid
      const name = number
      return { name, number }
    })
    if (action === 'save') {
      const inserted = await insertClients(rows)
      return res.json({ ok: true, inserted })
    } else if (action === 'csv') {
      const header = 'name,number'
      const csv = [header, ...rows.map(r => `${JSON.stringify(r.name)},${JSON.stringify(r.number)}`)].join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="group-${meta.subject}-members.csv"`)
      return res.send(csv)
    } else if (action === 'xlsx') {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'members')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="group-${meta.subject}-members.xlsx"`)
      return res.send(buf)
    } else if (action === 'sql') {
      const lines = rows.map(r => `INSERT INTO clients (name, number) VALUES (${JSON.stringify(r.name)}, ${JSON.stringify(r.number)});`)
      const sql = lines.join('\n')
      res.setHeader('Content-Type', 'application/sql')
      res.setHeader('Content-Disposition', `attachment; filename="group-${meta.subject}-members.sql"`)
      return res.send(sql)
    } else {
      return res.status(400).json({ ok: false, error: 'Ação inválida' })
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

// ===== Clients CRUD =====
app.get('/api/clients', (req, res) => {
  db.all(`SELECT c.id, c.name, c.number,
    GROUP_CONCAT(l.name) AS labels
    FROM clients c
    LEFT JOIN client_labels cl ON cl.client_id = c.id
    LEFT JOIN labels l ON l.id = cl.label_id
    GROUP BY c.id
    ORDER BY c.id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    const clients = rows.map(r => ({ id: r.id, name: r.name, number: r.number, labels: r.labels ? r.labels.split(',') : [] }))
    res.json({ ok: true, clients })
  })
})

app.post('/api/clients', (req, res) => {
  const { name, number } = req.body
  if (!name || !number) return res.status(400).json({ ok: false, error: 'name e number são obrigatórios' })
  db.run(`INSERT INTO clients (name, number) VALUES (?, ?)`, [name, number], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, id: this.lastID })
  })
})

app.put('/api/clients/:id', (req, res) => {
  const { name, number } = req.body
  db.run(`UPDATE clients SET name = ?, number = ? WHERE id = ?`, [name, number, req.params.id], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, updated: this.changes })
  })
})

app.delete('/api/clients/:id', (req, res) => {
  db.run(`DELETE FROM client_labels WHERE client_id = ?`, [req.params.id], () => {
    db.run(`DELETE FROM clients WHERE id = ?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ ok: false, error: err.message })
      res.json({ ok: true, deleted: this.changes })
    })
  })
})

// ===== Labels =====
app.get('/api/labels', (_, res) => {
  db.all(`SELECT id, name FROM labels ORDER BY name`, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, labels: rows })
  })
})

app.post('/api/labels', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' })
  db.run(`INSERT INTO labels (name) VALUES (?)`, [name], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, id: this.lastID })
  })
})

app.post('/api/clients/:id/labels', (req, res) => {
  const { labelId, name } = req.body
  const clientId = req.params.id
  const link = (lid) => {
    db.run(`INSERT OR IGNORE INTO client_labels (client_id, label_id) VALUES (?, ?)`, [clientId, lid], function (err) {
      if (err) return res.status(500).json({ ok: false, error: err.message })
      res.json({ ok: true })
    })
  }
  if (labelId) return link(labelId)
  if (!name) return res.status(400).json({ ok: false, error: 'name ou labelId é obrigatório' })
  db.run(`INSERT INTO labels (name) VALUES (?)`, [name], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    link(this.lastID)
  })
})

app.delete('/api/clients/:id/labels/:labelId', (req, res) => {
  db.run(`DELETE FROM client_labels WHERE client_id = ? AND label_id = ?`, [req.params.id, req.params.labelId], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true })
  })
})

// ===== Import endpoints =====
const importUpload = multer({ storage: uploadStorage })
app.post('/api/import', importUpload.single('file'), (req, res) => {
  const type = (req.query.type || '').toLowerCase()
  if (!req.file) return res.status(400).json({ ok: false, error: 'Arquivo não enviado' })
  try {
    const filePath = req.file.path
    if (type === 'csv') {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split(/\r?\n/).filter(Boolean)
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const [name, number] = lines[i].split(',').map(s => s.replace(/^"|"$/g, ''))
        if (name && number) rows.push({ name, number })
      }
      insertClients(rows).then(count => res.json({ ok: true, inserted: count })).catch(err => res.status(500).json({ ok: false, error: err.message }))
    } else if (type === 'xlsx') {
      const wb = XLSX.readFile(filePath)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)
      insertClients(rows.map(r => ({ name: r.name || r.nome || '', number: r.number || r.numero || '' }))).then(count => res.json({ ok: true, inserted: count })).catch(err => res.status(500).json({ ok: false, error: err.message }))
    } else if (type === 'sql') {
      const sql = fs.readFileSync(filePath, 'utf-8')
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean).filter(s => /^INSERT\s+INTO\s+clients/i.test(s))
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return res.status(500).json({ ok: false, error: err.message })
          let failed = false
          let pending = statements.length
          if (pending === 0) {
            return db.run('COMMIT', [], (err2) => {
              if (err2) return res.status(500).json({ ok: false, error: err2.message })
              res.json({ ok: true, inserted: 0 })
            })
          }
          for (const s of statements) {
            db.run(s, [], (runErr) => {
              if (runErr) failed = true
              pending--
              if (pending === 0) {
                db.run(failed ? 'ROLLBACK' : 'COMMIT', [], (endErr) => {
                  if (endErr) return res.status(500).json({ ok: false, error: endErr.message })
                  res.json({ ok: true, inserted: failed ? undefined : statements.length })
                })
              }
            })
          }
        })
      })
    } else {
      res.status(400).json({ ok: false, error: 'Tipo inválido (csv, xlsx, sql)' })
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

// ===== Flows endpoints (separate DB) =====
app.get('/api/flows', (_, res) => {
  flowsDb.all(`SELECT id, name, created_at FROM flows ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, flows: rows })
  })
})

app.post('/api/flows', (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ ok: false, error: 'name é obrigatório' })
  const now = Date.now()
  flowsDb.run(`INSERT INTO flows (name, data, created_at) VALUES (?, ?, ?)`, [name, JSON.stringify({ nodes: [], edges: [] }), now], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, id: this.lastID })
  })
})

app.get('/api/flows/:id', (req, res) => {
  flowsDb.get(`SELECT id, name, data FROM flows WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    if (!row) return res.status(404).json({ ok: false, error: 'Fluxo não encontrado' })
    let data = {}
    try { data = JSON.parse(row.data || '{}') } catch {}
    res.json({ ok: true, id: row.id, name: row.name, data })
  })
})

app.put('/api/flows/:id', (req, res) => {
  const { data } = req.body
  if (!data) return res.status(400).json({ ok: false, error: 'data é obrigatório' })
  flowsDb.run(`UPDATE flows SET data = ? WHERE id = ?`, [JSON.stringify(data), req.params.id], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, updated: this.changes })
  })
})

app.delete('/api/flows/:id', (req, res) => {
  flowsDb.run(`DELETE FROM flows WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, deleted: this.changes })
  })
})

// ===== Clients by label =====
app.get('/api/clients/by-label/:labelId', (req, res) => {
  const labelId = req.params.labelId
  db.all(`
    SELECT c.id, c.name, c.number
    FROM clients c
    INNER JOIN client_labels cl ON cl.client_id = c.id
    WHERE cl.label_id = ?
    ORDER BY c.id DESC
  `, [labelId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message })
    res.json({ ok: true, clients: rows })
  })
})

function normalizeNumber(number) {
  const n = String(number).replace(/\D+/g, '')
  return n
}
function toJid(number) {
  const n = normalizeNumber(number)
  return `${n}@s.whatsapp.net`
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function buildFlowSequence(flowData) {
  const nodes = Array.isArray(flowData?.nodes) ? flowData.nodes : []
  const edges = Array.isArray(flowData?.edges) ? flowData.edges : []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const incoming = new Map()
  for (const n of nodes) incoming.set(n.id, 0)
  for (const e of edges) {
    if (incoming.has(e.to)) incoming.set(e.to, (incoming.get(e.to) || 0) + 1)
  }
  const starts = nodes.filter(n => (incoming.get(n.id) || 0) === 0)
  starts.sort((a,b)=> (a.x - b.x) || (a.y - b.y))
  let current = starts[0]?.id || nodes[0]?.id
  const visited = new Set()
  const sequence = []
  const edgesFrom = (id) => edges.filter(e=>e.from===id)
  const pickNext = (id) => {
    const out = edgesFrom(id)
    if (!out.length) return null
    const byPort = (p) => out.find(e=>e.port===p)
    const next = byPort('next')
    if (next) return next.to
    const ifEdge = byPort('if')
    if (ifEdge) return ifEdge.to
    const elseif = out.find(e=>String(e.port||'').startsWith('elseif'))
    if (elseif) return elseif.to
    const els = byPort('else')
    if (els) return els.to
    return out[0].to
  }
  while (current && !visited.has(current)) {
    visited.add(current)
    const node = nodeMap.get(current)
    if (node) sequence.push(node)
    current = pickNext(current)
  }
  return sequence
}

function audioMimeForPath(p) {
  const ext = path.extname(p).toLowerCase()
  if (ext === '.ogg' || ext === '.opus') return 'audio/ogg; codecs=opus'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  return 'audio/mpeg'
}

// ===== Send endpoints =====
app.post('/api/send/text', async (req, res) => {
  try {
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    const { mode, clients, labelId, single, text } = req.body || {}
    if (!text || !text.trim()) return res.status(400).json({ ok: false, error: 'Texto obrigatório' })
    let targets = []
    if (mode === 'selected') {
      targets = Array.isArray(clients) ? clients : []
    } else if (mode === 'label') {
      const list = await new Promise((resolve, reject) => {
        db.all(`
          SELECT c.id, c.name, c.number
          FROM clients c
          INNER JOIN client_labels cl ON cl.client_id = c.id
          WHERE cl.label_id = ?
          ORDER BY c.id DESC
        `, [labelId], (err, rows) => err ? reject(err) : resolve(rows))
      })
      targets = list
    } else if (mode === 'single') {
      if (single?.number) targets = [single]
    }
    if (!targets.length) return res.status(400).json({ ok: false, error: 'Nenhum destinatário' })
    const results = []
    for (const t of targets) {
      const jid = toJid(t.number)
      try {
        await sock.sendMessage(jid, { text })
        results.push({ number: t.number, ok: true })
      } catch (e) {
        results.push({ number: t.number, ok: false, error: e.message || String(e) })
      }
    }
    res.json({ ok: true, sent: results.filter(r=>r.ok).length, results })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

app.post('/api/send/flow', async (req, res) => {
  try {
    const { mode, clients, labelId, single, flowId, dryRun } = req.body || {}
    if (!flowId) return res.status(400).json({ ok: false, error: 'flowId obrigatório' })
    const flow = await new Promise((resolve, reject) => {
      flowsDb.get(`SELECT id, name, data FROM flows WHERE id = ?`, [flowId], (err, row) => err ? reject(err) : resolve(row))
    })
    if (!flow) return res.status(404).json({ ok: false, error: 'Fluxo não encontrado' })
    let flowData = {}
    try { flowData = JSON.parse(flow.data || '{}') } catch {}
    const sequence = buildFlowSequence(flowData)
    if (!sequence.length) return res.status(400).json({ ok: false, error: 'Fluxo vazio' })
    if (dryRun) {
      const steps = sequence.map(n => {
        if (n.type === 'message') return { type: 'message', text: String(n.data?.text || '').trim() }
        if (n.type === 'delay') return { type: 'delay', seconds: Number(n.data?.seconds || 0) }
        return { type: n.type }
      }).filter(s => s.type !== 'message' || s.text)
      return res.json({ ok: true, steps })
    }
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    let targets = []
    if (mode === 'selected') {
      targets = Array.isArray(clients) ? clients : []
    } else if (mode === 'label') {
      const list = await new Promise((resolve, reject) => {
        db.all(`
          SELECT c.id, c.name, c.number
          FROM clients c
          INNER JOIN client_labels cl ON cl.client_id = c.id
          WHERE cl.label_id = ?
          ORDER BY c.id DESC
        `, [labelId], (err, rows) => err ? reject(err) : resolve(rows))
      })
      targets = list
    } else if (mode === 'single') {
      if (single?.number) targets = [single]
    }
    if (!targets.length) return res.status(400).json({ ok: false, error: 'Nenhum destinatário' })
    const results = []
    for (const t of targets) {
      const jid = toJid(t.number)
      try {
        await executeFlow(jid, flowData)
        results.push({ number: t.number, ok: true })
      } catch (e) {
        results.push({ number: t.number, ok: false, error: e.message || String(e) })
      }
    }
    res.json({ ok: true, sent: results.filter(r=>r.ok).length, results })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

app.post('/api/send/audio', async (req, res) => {
  try {
    const sock = getSock()
    if (!sock) return res.status(503).json({ ok: false, error: 'Bot não conectado' })
    const { mode, clients, labelId, single, audioUrl } = req.body || {}
    if (!audioUrl) return res.status(400).json({ ok: false, error: 'audioUrl obrigatório' })
    let targets = []
    if (mode === 'selected') {
      targets = Array.isArray(clients) ? clients : []
    } else if (mode === 'label') {
      const list = await new Promise((resolve, reject) => {
        db.all(`
          SELECT c.id, c.name, c.number
          FROM clients c
          INNER JOIN client_labels cl ON cl.client_id = c.id
          WHERE cl.label_id = ?
          ORDER BY c.id DESC
        `, [labelId], (err, rows) => err ? reject(err) : resolve(rows))
      })
      targets = list
    } else if (mode === 'single') {
      if (single?.number) targets = [single]
    }
    if (!targets.length) return res.status(400).json({ ok: false, error: 'Nenhum destinatário' })
    const relPath = audioUrl.startsWith('/assets/') ? audioUrl.replace(/^\/assets\//,'') : audioUrl
    const absPath = path.join(assetsDir, relPath)
    if (!fs.existsSync(absPath)) return res.status(404).json({ ok: false, error: 'Arquivo não encontrado' })
    const ext = path.extname(absPath).toLowerCase()
    const mimetype = ext === '.ogg' ? 'audio/ogg; codecs=opus'
      : ext === '.opus' ? 'audio/ogg; codecs=opus'
      : ext === '.mp3' ? 'audio/mpeg'
      : ext === '.wav' ? 'audio/wav'
      : 'audio/mpeg'
    const results = []
    for (const t of targets) {
      const jid = toJid(t.number)
      try {
        await sock.sendMessage(jid, { audio: { url: absPath }, mimetype, ptt: true })
        results.push({ number: t.number, ok: true })
      } catch (e) {
        results.push({ number: t.number, ok: false, error: e.message || String(e) })
      }
    }
    res.json({ ok: true, sent: results.filter(r=>r.ok).length, results })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) })
  }
})

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
    return res.status(404).json({ ok: false })
  }
  res.sendFile(path.join(publicDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server rodando em http://localhost:${PORT}/`)
})
}
