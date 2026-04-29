const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadContentFromMessage, makeCacheableSignalKeyStore } = require('@itsukichan/baileys')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const path = require('path')

const { assetsDir, authDir } = require('./paths')
const { setSock, setConnectionState, setLastQr, clearLastQr } = require('./wa')
const { continueFromQuickReply } = require('./flowRuntime')
const { saveChat, saveMessage, updateMessageMedia, getMessageByKey } = require('./chatStore')
const { send: sseSend } = require('./sse')

const extFromMime = (mime) => {
  if (!mime) return 'bin'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('opus')) return 'opus'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('jpeg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('pdf')) return 'pdf'
  return 'bin'
}

const msgRetryCounterCache = new Map()

let sock
let reconnectTimer = null
let reconnectAttempts = 0
let qrShown = false
let started = false

async function startBot() {
  setConnectionState('starting')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  qrShown = false
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))

  if (sock && sock.ev) {
    try {
      sock.ev.removeAllListeners('connection.update')
      sock.ev.removeAllListeners('messages.upsert')
      sock.ev.removeAllListeners('creds.update')
      sock.ev.removeAllListeners('presence.update')
    } catch {}
  }

  sock = makeWASocket({
    logger: pino({ level: 'fatal' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
    },
    printQRInTerminal: true,
    browser: Browsers.appropriate('Chrome'),
    version,
    connectTimeoutMs: 30000,
    qrTimeout: 60000,
    msgRetryCounterCache,
    getMessage: async (key) => {
      try {
        if (!key.id) return undefined
        const msg = await getMessageByKey(key.id)
        return msg || undefined
      } catch {
        return undefined
      }
    },
    generateHighQualityLinkPreview: true
  })

  setSock(sock)
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrShown = true
      setLastQr(qr)
      setConnectionState('qr')
      sseSend('wa.qr', { qr, ts: Date.now() })
      sseSend('wa.status', { connection: 'qr' })
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const message = lastDisconnect?.error?.message || String(lastDisconnect?.error || '')
      setConnectionState('close')
      sseSend('wa.status', { connection: 'close', statusCode: statusCode ?? null, message: message || '' })

      if (statusCode === DisconnectReason.loggedOut) {
        reconnectAttempts = 0
        try {
          fs.rmSync(authDir, { recursive: true, force: true })
        } catch {}
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            startBot()
          }, 1000)
        }
        return
      }

      const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts))
      reconnectAttempts = Math.min(reconnectAttempts + 1, 10)

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          startBot()
        }, delay)
      }

      if (reconnectAttempts >= 3 && !qrShown) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        try {
          fs.rmSync(authDir, { recursive: true, force: true })
        } catch {}
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          startBot()
        }, 1000)
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0
      clearLastQr()
      setConnectionState('open')
      sseSend('wa.status', { connection: 'open' })
    }
  })

  sock.ev.on('presence.update', (update) => {
    const presences = update.presences || {}
    Object.keys(presences).forEach(jid => {
      const p = presences[jid] || {}
      const raw = p.lastKnownPresence || p.presence || 'offline'
      let status = 'offline'
      if (raw === 'available') status = 'online'
      else if (raw === 'composing') status = 'digitando'
      else if (raw === 'recording') status = 'gravando'
      sseSend('presence', { jid, status })
    })
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    const from = msg.key.remoteJid
    if (!msg.message || from === 'status@broadcast') return

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const pushName = msg.pushName || ''
    saveChat(from, pushName)

    if (msg.message?.audioMessage) {
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'audio',
        body: '',
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      try{
        const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        const fileName = `audio-${id}.${extFromMime(msg.message.audioMessage.mimetype)}`
        const relPath = path.join('uploads', fileName)
        const absPath = path.join(assetsDir, relPath)
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.writeFileSync(absPath, buffer)
        await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`)
      }catch{}
      sseSend('message', { id, jid: from })
      return
    }

    if (msg.message?.imageMessage) {
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'image',
        body: msg.message.imageMessage.caption || '',
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      try{
        const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        const fileName = `image-${id}.${extFromMime(msg.message.imageMessage.mimetype)}`
        const relPath = path.join('uploads', fileName)
        const absPath = path.join(assetsDir, relPath)
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.writeFileSync(absPath, buffer)
        await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`)
      }catch{}
      sseSend('message', { id, jid: from })
      return
    }

    if (msg.message?.videoMessage) {
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'video',
        body: msg.message.videoMessage.caption || '',
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      try{
        const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        const fileName = `video-${id}.${extFromMime(msg.message.videoMessage.mimetype)}`
        const relPath = path.join('uploads', fileName)
        const absPath = path.join(assetsDir, relPath)
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.writeFileSync(absPath, buffer)
        await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`)
      }catch{}
      sseSend('message', { id, jid: from })
      return
    }

    if (msg.message?.documentMessage) {
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'document',
        body: msg.message.documentMessage.fileName || '',
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      try{
        const stream = await downloadContentFromMessage(msg.message.documentMessage, 'document')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        const fileName = msg.message.documentMessage.fileName || `doc-${id}.${extFromMime(msg.message.documentMessage.mimetype)}`
        const relPath = path.join('uploads', fileName)
        const absPath = path.join(assetsDir, relPath)
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.writeFileSync(absPath, buffer)
        await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`)
      }catch{}
      sseSend('message', { id, jid: from })
      return
    }

    if (msg.message?.buttonsResponseMessage || msg.message?.templateButtonReplyMessage) {
      const selectedId = msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.templateButtonReplyMessage?.selectedId
      const selectedText = msg.message?.buttonsResponseMessage?.selectedDisplayText || msg.message?.templateButtonReplyMessage?.selectedDisplayText
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'quick_reply',
        body: selectedText || selectedId || '',
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      sseSend('message', { id, jid: from })
    } else {
      const id = await saveMessage({
        jid: from,
        from_jid: msg.key.participant || from,
        timestamp: Number(msg.messageTimestamp || Date.now()),
        type: 'text',
        body,
        media_path: '',
        raw_json: msg.message,
        key_id: msg.key?.id || null
      })
      sseSend('message', { id, jid: from })
    }

    if (msg.message?.buttonsResponseMessage || msg.message?.templateButtonReplyMessage) {
      const selected = msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.templateButtonReplyMessage?.selectedId
      if (selected) {
        const handled = await continueFromQuickReply(from, selected)
        if (handled) return
      }
    }
  })
}

async function startWhatsApp() {
  if (started) return sock
  started = true
  await startBot()
  return sock
}

module.exports = { startWhatsApp }
