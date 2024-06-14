const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html' }
});

let isAuthenticated = false;

const authenticate = () => {
    return new Promise((resolve, reject) => {
        client.on('qr', qr => {
            qrcode.generate(qr, { small: true });
        });

        client.on('authenticated', () => {
            isAuthenticated = true;
            resolve();
        });

        client.on('auth_failure', (msg) => {
            reject(`Authentication failure: ${msg}`);
        });

        client.on('ready', () => {
            if (isAuthenticated) {
                console.log('Client is ready!');
                resolve();
            }
        });

        client.initialize();
    });
};

const sendMessage = (msg) => {
    return new Promise((resolve, reject) => {
        if (!isAuthenticated) {
            reject('Client is not authenticated.');
            return;
        }

        const chatId = `${process.env.WPP_NUM}@c.us`;
        client.sendMessage(chatId, msg).then(response => {
            resolve(response);
        }).catch(err => {
            console.error('Error when sending message:', err);
            reject(err);
        });
    });
};

module.exports = { authenticate, sendMessage };
