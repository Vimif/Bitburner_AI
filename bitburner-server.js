/**
 * Bitburner Remote File API Server
 * 
 * Ce serveur WebSocket permet de synchroniser vos scripts avec Bitburner.
 * 
 * Usage:
 *   node bitburner-server.js
 * 
 * Dans Bitburner:
 *   1. Allez dans Remote API
 *   2. Hostname: 127.0.0.1, Port: 1324
 *   3. Cliquez sur "Connect"
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Configuration
const PORT = 1324;
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const SERVER_NAME = 'home'; // Serveur destination dans Bitburner

// Stockage de la connexion Bitburner
let bitburnerSocket = null;
let messageId = 1;

// Créer le serveur WebSocket
const wss = new WebSocket.Server({ port: PORT });

console.log(`\n🎮 Bitburner Remote File API Server`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📡 Serveur WebSocket démarré sur ws://127.0.0.1:${PORT}`);
console.log(`📁 Dossier surveillé: ${SCRIPTS_DIR}`);
console.log(`\n⏳ En attente de connexion de Bitburner...`);
console.log(`   → Dans Bitburner: Remote API → Connect\n`);

// Gérer les connexions
wss.on('connection', (ws) => {
    console.log(`✅ Bitburner connecté!`);
    bitburnerSocket = ws;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Reçu:`, message);

            // Répondre aux messages si nécessaire
            if (message.id !== undefined && message.result) {
                console.log(`✓ Réponse reçue pour message #${message.id}`);
            }
            if (message.error) {
                console.error(`❌ Erreur:`, message.error);
            }
        } catch (e) {
            console.log(`📨 Message brut:`, data.toString());
        }
    });

    ws.on('close', () => {
        console.log(`⚠️  Bitburner déconnecté`);
        bitburnerSocket = null;
    });

    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket:`, error.message);
    });

    // Envoyer tous les scripts existants à la connexion
    console.log(`\n📤 Envoi des scripts existants...`);
    pushAllFiles();
});

// Fonction pour envoyer un fichier à Bitburner
function pushFile(filePath) {
    if (!bitburnerSocket || bitburnerSocket.readyState !== WebSocket.OPEN) {
        console.log(`⚠️  Bitburner non connecté, impossible d'envoyer ${path.basename(filePath)}`);
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(SCRIPTS_DIR, filePath).replace(/\\/g, '/');

        const message = {
            jsonrpc: '2.0',
            method: 'pushFile',
            params: {
                filename: relativePath,
                content: content,
                server: SERVER_NAME
            },
            id: messageId++
        };

        bitburnerSocket.send(JSON.stringify(message));
        console.log(`📤 Envoyé: ${relativePath} → ${SERVER_NAME}`);
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi de ${filePath}:`, error.message);
    }
}

// Fonction pour envoyer tous les fichiers
function pushAllFiles() {
    if (!fs.existsSync(SCRIPTS_DIR)) {
        console.log(`⚠️  Dossier scripts/ non trouvé`);
        return;
    }

    const files = getFilesRecursively(SCRIPTS_DIR);
    const scriptFiles = files.filter(f =>
        f.endsWith('.js') || f.endsWith('.ns') || f.endsWith('.script') || f.endsWith('.txt')
    );

    console.log(`📁 ${scriptFiles.length} fichier(s) trouvé(s)`);
    scriptFiles.forEach(file => pushFile(file));
}

// Récupérer tous les fichiers récursivement
function getFilesRecursively(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...getFilesRecursively(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

// Surveiller les changements de fichiers
console.log(`👀 Surveillance des fichiers activée...`);
const watcher = chokidar.watch(SCRIPTS_DIR, {
    ignored: /(^|[\/\\])\../, // Ignorer les fichiers cachés
    persistent: true,
    ignoreInitial: true
});

watcher.on('add', (filePath) => {
    if (isScriptFile(filePath)) {
        console.log(`\n📄 Nouveau fichier: ${path.basename(filePath)}`);
        pushFile(filePath);
    }
});

watcher.on('change', (filePath) => {
    if (isScriptFile(filePath)) {
        console.log(`\n✏️  Fichier modifié: ${path.basename(filePath)}`);
        pushFile(filePath);
    }
});

watcher.on('unlink', (filePath) => {
    if (isScriptFile(filePath)) {
        console.log(`\n🗑️  Fichier supprimé: ${path.basename(filePath)}`);
        // Note: L'API Bitburner supporte deleteFile si nécessaire
    }
});

function isScriptFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.ns', '.script', '.txt'].includes(ext);
}

// Gérer l'arrêt propre
process.on('SIGINT', () => {
    console.log(`\n\n👋 Arrêt du serveur...`);
    wss.close();
    process.exit(0);
});

console.log(`\n💡 Conseils:`);
console.log(`   • Sauvegardez un fichier .js dans scripts/ pour le synchroniser`);
console.log(`   • Appuyez sur Ctrl+C pour arrêter le serveur\n`);
