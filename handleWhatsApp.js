const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const sendMessage = (msg) => {

    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-gpu'],
        },
        webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html' }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        const chatId = `${process.env.WPP_NUM}@c.us`;
        client.sendMessage(chatId, msg).then(response => {
            console.log('Message sent:', response);

        }).catch(err => {
            console.error('Error when sending message:', err);

            client.destroy();
        });
    });

    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
    });

    client.initialize();
}

module.exports = sendMessage;
