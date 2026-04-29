let _sock = null

function setSock(s) {
  _sock = s
}

function getSock() {
  return _sock
}

module.exports = { setSock, getSock }
