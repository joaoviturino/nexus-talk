const fs = require('fs')
const path = require('path')
const { getSock } = require('./wa')

const assetsDir = path.join(__dirname, 'assets')
const sessions = new Map()

function audioMimeForPath(p) {
  const ext = path.extname(p).toLowerCase()
  if (ext === '.ogg' || ext === '.opus') return 'audio/ogg; codecs=opus'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  return 'audio/mpeg'
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function buildGraph(flowData) {
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
  const startId = starts[0]?.id || nodes[0]?.id
  return { nodes, edges, nodeMap, startId }
}

function pickNext(edges, id) {
  const out = edges.filter(e=>e.from===id)
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

async function executeFlow(jid, flowData, startNodeId) {
  const sock = getSock()
  if (!sock) throw new Error('Bot não conectado')
  const { edges, nodeMap, startId } = buildGraph(flowData)
  let current = startNodeId || startId
  const visited = new Set()
  while (current && !visited.has(current)) {
    visited.add(current)
    const node = nodeMap.get(current)
    if (!node) break
    if (node.type === 'message') {
      const msg = String(node.data?.text || '').trim()
      if (msg) await sock.sendMessage(jid, { text: msg })
    }
    if (node.type === 'audio') {
      const audioUrl = String(node.data?.audioUrl || '')
      if (audioUrl) {
        const relPath = audioUrl.startsWith('/assets/') ? audioUrl.replace(/^\/assets\//,'') : audioUrl
        const absPath = path.join(assetsDir, relPath)
        if (fs.existsSync(absPath)) {
          const mimetype = audioMimeForPath(absPath)
          await sock.sendMessage(jid, { audio: { url: absPath }, mimetype, ptt: true })
        }
      }
    }
    if (node.type === 'action' && node.data?.kind === 'cta_url') {
      const url = String(node.data?.url || '').trim()
      const displayText = String(node.data?.displayText || 'Follow Me').trim()
      if (url) {
        const parts = [node.data?.title, node.data?.subtitle, node.data?.body].map(v=>String(v||'').trim()).filter(Boolean)
        const text = parts.length ? parts.join('\n') : (displayText || ' ')
        await sock.sendMessage(jid, {
          text,
          templateButtons: [
            {
              index: 1,
              urlButton: {
                displayText: displayText || 'Follow Me',
                url
              }
            }
          ]
        })
      }
    }
    if (node.type === 'quick_reply') {
      const options = Array.isArray(node.data?.options) ? node.data.options.slice(0,3) : []
      const buttons = options.filter(o=>o?.text).map(o=>({
        buttonId: o.key,
        buttonText: { displayText: o.text },
        type: 1
      }))
      if (buttons.length) {
        const parts = [node.data?.title, node.data?.subtitle, node.data?.body].map(v=>String(v||'').trim()).filter(Boolean)
        const text = parts.length ? parts.join('\n') : ' '
        await sock.sendMessage(jid, {
          text,
          footer: String(node.data?.footer || '').trim(),
          buttons,
          headerType: 1
        })
      }
      const nextByOption = {}
      for (const opt of options) {
        const edge = edges.find(e=>e.from===node.id && e.port===opt.key)
        if (edge) nextByOption[opt.key] = edge.to
      }
      sessions.set(jid, { flowData, nextByOption })
      return { waiting: true }
    }
    if (node.type === 'delay') {
      const seconds = Number(node.data?.seconds || 0)
      if (seconds > 0) await sleep(seconds * 1000)
    }
    current = pickNext(edges, current)
  }
  return { done: true }
}

async function continueFromQuickReply(jid, selectedId) {
  const ctx = sessions.get(jid)
  if (!ctx) return false
  const nextId = ctx.nextByOption[selectedId]
  if (!nextId) return false
  sessions.delete(jid)
  await executeFlow(jid, ctx.flowData, nextId)
  return true
}

module.exports = { executeFlow, continueFromQuickReply }
