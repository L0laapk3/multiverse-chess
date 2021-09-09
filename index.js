require("./keepAlive")

const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;

const VERSION = process.env.HEROKU_RELEASE_VERSION || ("dev-" + Date.now());

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'favicon')));
app.use(function forceLiveDomain(req, res, next) {
	if (req.get('Host') === 'multiverse-chess.herokuapp.com')
		return res.redirect(301, 'https://multiversechess.com' + req.originalUrl);
	return next();
  });
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

require("./socket")(server, VERSION);

  