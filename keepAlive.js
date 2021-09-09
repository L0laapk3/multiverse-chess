// keepAlive.js

const cron = require('cron');
const fetch = require('node-fetch');

// globals
new cron.CronJob('0 */25 * * * *', () => {
	fetch("https://multiversechess.com")
		.then(res => console.log(`response-ok: ${res.ok}, status: ${res.status}`))
		.catch(err => {});
}).start();