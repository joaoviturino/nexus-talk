const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, 'chats.db')
const db = new sqlite3.Database(dbPath)

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS chats (
    jid TEXT PRIMARY KEY,
    name TEXT
  )`, (err) => {
    if (err) console.error('Error creating chats table:', err)
  })
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT,
    from_jid TEXT,
    timestamp INTEGER,
    type TEXT,
    body TEXT,
    media_path TEXT,
    raw_json TEXT,
    key_id TEXT
  )`, (err) => {
    if (err) console.error('Error creating messages table:', err)
  })
  // Migration for existing tables
  db.run(`ALTER TABLE messages ADD COLUMN key_id TEXT`, () => {})
})

function saveChat(jid, name) {
  db.run(`INSERT OR REPLACE INTO chats (jid, name) VALUES (?, COALESCE(?, (SELECT name FROM chats WHERE jid = ?)))`, [jid, name || null, jid])
}

function saveMessage({ jid, from_jid, timestamp, type, body, media_path, raw_json, key_id }) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO messages (jid, from_jid, timestamp, type, body, media_path, raw_json, key_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jid, from_jid, timestamp, type, body || '', media_path || '', raw_json ? JSON.stringify(raw_json) : '', key_id || null],
      function (err) {
        if (err) return reject(err)
        resolve(this.lastID)
      })
  })
}

function updateMessageMedia(id, media_path) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE messages SET media_path = ? WHERE id = ?`, [media_path, id], function (err) {
      if (err) return reject(err)
      resolve(this.changes)
    })
  })
}

function listChats() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT c.jid, COALESCE(c.name, SUBSTR(c.jid, 1, INSTR(c.jid, '@')-1)) as name,
             (SELECT MAX(timestamp) FROM messages m WHERE m.jid = c.jid) as last_ts
      FROM chats c
      ORDER BY last_ts DESC NULLS LAST
    `, [], (err, rows) => err ? reject(err) : resolve(rows))
  })
}

function listMessages(jid, limit = 50, before = Number.MAX_SAFE_INTEGER) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT id, jid, from_jid, timestamp, type, body, media_path
      FROM messages
      WHERE jid = ? AND timestamp < ?
      ORDER BY id DESC
      LIMIT ?
    `, [jid, before, limit], (err, rows) => err ? reject(err) : resolve(rows))
  })
}

function getMessage(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM messages WHERE id = ?`, [id], (err, row) => err ? reject(err) : resolve(row))
  })
}

function getMessageByKey(keyId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT raw_json FROM messages WHERE key_id = ?`, [keyId], (err, row) => {
      if (err) return reject(err)
      if (!row || !row.raw_json) return resolve(null)
      try {
        resolve(JSON.parse(row.raw_json))
      } catch {
        resolve(null)
      }
    })
  })
}

module.exports = { saveChat, saveMessage, listChats, listMessages, getMessage, updateMessageMedia, getMessageByKey } 
