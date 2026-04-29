const { startServer } = require('./server')
const { startWhatsApp } = require('./whatsapp')

function start() {
  startServer()
  startWhatsApp().catch((e) => {
    console.error('FATAL: WhatsApp failed to start:', e)
    process.exitCode = 1
  })
}

start()
