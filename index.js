const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadContentFromMessage, makeCacheableSignalKeyStore } = require('@itsukichan/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { setSock } = require('./wa');
const { continueFromQuickReply } = require('./flowRuntime');
const { saveChat, saveMessage, updateMessageMedia, getMessageByKey } = require('./chatStore');
const { send: sseSend } = require('./sse');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const extFromMime = (mime) => {
    if (!mime) return 'bin';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('opus')) return 'opus';
    if (mime.includes('mpeg')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('jpeg')) return 'jpg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('pdf')) return 'pdf';
    return 'bin';
};
const AUTH_DIR = './QR/WSKSYSTEM';

const msgRetryCounterCache = new Map();

let sock;
let reconnectTimer = null;
let reconnectAttempts = 0;
let qrShown = false;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    qrShown = false;
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    if (sock && sock.ev) {
        try {
            sock.ev.removeAllListeners('connection.update');
            sock.ev.removeAllListeners('messages.upsert');
            sock.ev.removeAllListeners('creds.update');
        } catch {}
    }

    sock = makeWASocket({
        logger: pino({ level: 'fatal' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: true,
        browser: Browsers.appropriate('Chrome'),
        version,
        connectTimeoutMs: 30000,
        qrTimeout: 60000,
        msgRetryCounterCache,
        getMessage: async (key) => {
            try {
                if (!key.id) return undefined;
                const msg = await getMessageByKey(key.id);
                return msg || undefined;
            } catch {
                return undefined;
            }
        },
        generateHighQualityLinkPreview: true
    });
    setSock(sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrShown = true;
            console.log('🔳 QR gerado. Escaneie com o WhatsApp.');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const message = lastDisconnect?.error?.message || String(lastDisconnect?.error || '');
            if (message) {
                console.log(`⚠️ Desconectado: ${statusCode ?? 'desconhecido'} ${message}`);
            }
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('❌ Sessão finalizada. Escaneie o QR novamente.');
                reconnectAttempts = 0;
                try {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    console.log('🧹 Sessão antiga removida. Gerando novo QR...');
                } catch {}
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        startBot();
                    }, 1000);
                }
                return;
            }

            const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
            reconnectAttempts = Math.min(reconnectAttempts + 1, 10);

            if (!reconnectTimer) {
                console.log(`🔁 Tentando reconectar em ${Math.round(delay / 1000)}s...`);
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    startBot();
                }, delay);
            }

            if (reconnectAttempts >= 3 && !qrShown) {
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                try {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    console.log('🧹 Sessão limpa para novo QR.');
                } catch {}
                reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    startBot();
                }, 1000);
            }
        }

        if (connection === 'open') {
            reconnectAttempts = 0;
            console.log('✅ Bot conectado com sucesso!');
        }
    });

    sock.ev.on('presence.update', (update) => {
        const presences = update.presences || {};
        Object.keys(presences).forEach(jid => {
            const p = presences[jid] || {};
            const raw = p.lastKnownPresence || p.presence || 'offline';
            let status = 'offline';
            if (raw === 'available') status = 'online';
            else if (raw === 'composing') status = 'digitando';
            else if (raw === 'recording') status = 'gravando';
            sseSend('presence', { jid, status });
        });
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        const from = msg.key.remoteJid;
        if (!msg.message || from === 'status@broadcast') return;

        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const pushName = msg.pushName || ''; // Captura o nome do usuário
        saveChat(from, pushName);
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
            });
            try{
                const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);
                const fileName = `audio-${id}.${extFromMime(msg.message.audioMessage.mimetype)}`;
                const relPath = path.join('uploads', fileName);
                const absPath = path.join(assetsDir, relPath);
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
                fs.writeFileSync(absPath, buffer);
                await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`);
            }catch(e){}
            sseSend('message', { id, jid: from });
        } else if (msg.message?.imageMessage) {
            const id = await saveMessage({
                jid: from,
                from_jid: msg.key.participant || from,
                timestamp: Number(msg.messageTimestamp || Date.now()),
                type: 'image',
                body: msg.message.imageMessage.caption || '',
                media_path: '',
                raw_json: msg.message,
                key_id: msg.key?.id || null
            });
            try{
                const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);
                const fileName = `image-${id}.${extFromMime(msg.message.imageMessage.mimetype)}`;
                const relPath = path.join('uploads', fileName);
                const absPath = path.join(assetsDir, relPath);
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
                fs.writeFileSync(absPath, buffer);
                await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`);
            }catch(e){}
            sseSend('message', { id, jid: from });
        } else if (msg.message?.videoMessage) {
            const id = await saveMessage({
                jid: from,
                from_jid: msg.key.participant || from,
                timestamp: Number(msg.messageTimestamp || Date.now()),
                type: 'video',
                body: msg.message.videoMessage.caption || '',
                media_path: '',
                raw_json: msg.message,
                key_id: msg.key?.id || null
            });
            try{
                const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);
                const fileName = `video-${id}.${extFromMime(msg.message.videoMessage.mimetype)}`;
                const relPath = path.join('uploads', fileName);
                const absPath = path.join(assetsDir, relPath);
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
                fs.writeFileSync(absPath, buffer);
                await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`);
            }catch(e){}
            sseSend('message', { id, jid: from });
        } else if (msg.message?.documentMessage) {
            const id = await saveMessage({
                jid: from,
                from_jid: msg.key.participant || from,
                timestamp: Number(msg.messageTimestamp || Date.now()),
                type: 'document',
                body: msg.message.documentMessage.fileName || '',
                media_path: '',
                raw_json: msg.message,
                key_id: msg.key?.id || null
            });
            try{
                const stream = await downloadContentFromMessage(msg.message.documentMessage, 'document');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);
                const fileName = msg.message.documentMessage.fileName || `doc-${id}.${extFromMime(msg.message.documentMessage.mimetype)}`;
                const relPath = path.join('uploads', fileName);
                const absPath = path.join(assetsDir, relPath);
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
                fs.writeFileSync(absPath, buffer);
                await updateMessageMedia(id, `/assets/${relPath.replace(/\\/g,'/')}`);
            }catch(e){}
            sseSend('message', { id, jid: from });
        } else if (msg.message?.buttonsResponseMessage || msg.message?.templateButtonReplyMessage) {
            const selectedId = msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.templateButtonReplyMessage?.selectedId;
            const selectedText = msg.message?.buttonsResponseMessage?.selectedDisplayText || msg.message?.templateButtonReplyMessage?.selectedDisplayText;
            const id = await saveMessage({
                jid: from,
                from_jid: msg.key.participant || from,
                timestamp: Number(msg.messageTimestamp || Date.now()),
                type: 'quick_reply',
                body: selectedText || selectedId || '',
                media_path: '',
                raw_json: msg.message,
                key_id: msg.key?.id || null
            });
            sseSend('message', { id, jid: from });
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
            });
            sseSend('message', { id, jid: from });
        }

        if (body.toLowerCase() === 'menu') {
            await sock.sendMessage(from, {
                text: 'ALISSUWSK',
                buttons: [
                    { buttonId: 'opt1', buttonText: { displayText: 'Opção 1' }, type: 1 },
                    { buttonId: 'opt2', buttonText: { displayText: 'Opção 2' }, type: 1 }
                ],
                headerType: 1
            }, { quoted: msg });
        }

        if (msg.message?.buttonsResponseMessage || msg.message?.templateButtonReplyMessage) {
            const selected = msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.templateButtonReplyMessage?.selectedId;
            if (selected) {
                const handled = await continueFromQuickReply(from, selected);
                if (handled) return;
            }
            if (selected === 'opt1') {
                await sock.sendMessage(from, { text: '✅ Você escolheu a Opção 1' });
            } else if (selected === 'opt2') {
                await sock.sendMessage(from, { text: '✅ Você escolheu a Opção 2' });
            }
        }
    });
}

startBot();
try {
    require('./server')
} catch (e) {
    console.error('FATAL: Failed to start server.js:', e)
}
