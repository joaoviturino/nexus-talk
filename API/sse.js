const clients = new Set()

function addClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders && res.flushHeaders()
  res.write('retry: 2000\n\n')
  clients.add(res)
  req.on('close', () => {
    clients.delete(res)
    try { res.end() } catch {}
  })
}

function send(event, payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const res of clients) {
    res.write(`event: ${event}\n`)
    res.write(`data: ${data}\n\n`)
  }
}

module.exports = { addClient, send }
