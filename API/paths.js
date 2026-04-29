const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const assetsDir = path.join(PROJECT_ROOT, 'assets')
const publicDir = path.join(PROJECT_ROOT, 'client', 'dist')
const dataDir = path.join(PROJECT_ROOT, 'data')
const authDir = path.join(PROJECT_ROOT, 'QR', 'WSKSYSTEM')

module.exports = { PROJECT_ROOT, assetsDir, publicDir, dataDir, authDir }
