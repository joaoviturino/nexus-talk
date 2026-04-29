let _sock = null
let _connection = 'unknown'
let _lastQr = null
let _lastQrAt = 0

function setSock(s) {
  _sock = s
}

function getSock() {
  return _sock
}

function setConnectionState(state) {
  _connection = state || 'unknown'
}

function getConnectionState() {
  return _connection
}

function setLastQr(qr) {
  _lastQr = qr || null
  _lastQrAt = _lastQr ? Date.now() : 0
}

function clearLastQr() {
  _lastQr = null
  _lastQrAt = 0
}

function getLastQr() {
  return _lastQr
}

function getLastQrAt() {
  return _lastQrAt
}

module.exports = {
  setSock,
  getSock,
  setConnectionState,
  getConnectionState,
  setLastQr,
  clearLastQr,
  getLastQr,
  getLastQrAt
}
