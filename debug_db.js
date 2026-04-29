const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'chats.db');
console.log('Checking DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        return;
    }
    console.log('DB connected.');
});

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('Error listing tables:', err);
            return;
        }
        console.log('Tables:', tables);
        
        if (tables.find(t => t.name === 'chats')) {
            db.all("SELECT * FROM chats", [], (err, rows) => {
                console.log('Chats count:', rows ? rows.length : 0);
                console.log('Chats rows:', rows);
            });
        }
        if (tables.find(t => t.name === 'messages')) {
             db.all("SELECT count(*) as count FROM messages", [], (err, rows) => {
                console.log('Messages count:', rows[0].count);
            });
        }
    });
});
