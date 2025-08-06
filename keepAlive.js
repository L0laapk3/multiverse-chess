import cron from 'cron';
import fetch from 'node-fetch';

new cron.CronJob('0 */25 * * * *', () => {
	fetch("https://multiversechess.com")
		.then(res => console.log(`response-ok: ${res.ok}, status: ${res.status}`))
		.catch(err => console.error('Keep-alive fetch error:', err));
}).start();