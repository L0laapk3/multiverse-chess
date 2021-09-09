"use strict";


const socket = io(window.location.origin.replace("http", "ws"));
let loaded = false, gameOptions;
window.onload = _ => {
	loaded = true;
	window.menu = new Menu(socket);
	if (!window.chrome)
		displayToast("This website is best viewed in a chromium based browser");
	if (gameOptions)
		startGame(gameOptions);
};

socket.on("ready", version => {
	const refreshNow = localStorage.version && localStorage.version != version;
	localStorage.version = version;
	if (refreshNow) {
		console.warn("browser cache outdated, refreshing");
		window.location.reload(true);
	}
	socket.emit("uuid", localStorage.uuid);
});
socket.on("uuid-new", uuid => {
	localStorage.uuid = uuid;
	loadMatchMaking();
});
socket.on("uuid-ok", _ => {
	loadMatchMaking();
});

function loadMatchMaking() {
	if (!loaded)
		return setTimeout(loadMatchMaking, 20);
	window.menu.connectedOnline();
}
socket.on("disconnect", _ => {
	window.menu.disconnectedOnline();
});

socket.on("game-launch", options => {
	options.isOnline = true;
	startGame(options);
});
function startGame(options) {
	if (!loaded)
		return gameOptions = options || {};
	if (window.game)
		window.game.destroy();
	window.menu.el.setAttribute("hidden", "");
	if (options.isOnline && window.location.pathname != "/" + options.shortCode)
		window.history.pushState(options.shortCode, "", "/" + options.shortCode);
	window.game = new ClientGame(document.body, options, options.isOnline && socket);
}

window.onpopstate = e => location.reload(); // TODO: proper way, this will do for now tho

socket.on("generic-error", error => {
	console.error(error);
	alert(error);
});