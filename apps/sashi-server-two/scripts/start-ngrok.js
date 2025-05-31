const ngrok = require('ngrok');
const port = process.env.PORT || 5002;

(async function () {
    try {
        console.log('Connecting to ngrok...', process.env.NGROK_AUTH_TOKEN);
        const url = await ngrok.connect({
            addr: port,
            hostname: 'lib.sashi.ngrok.app',
            authtoken: process.env.NGROK_AUTH_TOKEN
        });
        console.log('Ngrok tunnel is running!');
        console.log('Your public URL is:', url);
        console.log('Use this URL to access your hub from anywhere');
    } catch (err) {
        console.error('Error while connecting to ngrok:', err);
        process.exit(1);
    }
})(); 