require("./keepAlive")

const express = require('express');
const path = require('path');
const IS_DEV = !process.env.HEROKU_RELEASE_VERSION;
const PORT = IS_DEV ? 5000 : process.env.PORT;
const VERSION = IS_DEV ? "dev-" + Date.now() : process.env.HEROKU_RELEASE_VERSION;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'favicon')));
// app.use(function forceLiveDomain(req, res, next) {
// 	if (req.get('Host') !== 'multiversechess.com')
// 		return res.redirect(301, 'https://multiversechess.com' + req.originalUrl);
// 	return next();
//   });
app.use(function (req, res, next) {
	res.locals = {
		VERSION: VERSION
	};
	next();
});
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => res.render('pages/index'));
app.get('/[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRTUVWXYZ2346789]{3}', (req, res) => res.render('pages/index'));
const server = app.listen(PORT, () => console.log(`Listening on ${ PORT }`));

require("./socket")(server, VERSION, IS_DEV);

