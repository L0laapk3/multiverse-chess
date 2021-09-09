"use strict";


class Menu {
	constructor(socket) {
		this.socket = socket;
		this.connected = false;
		this.el = document.querySelector("chess-menu-container");
		this.el.onwheel = e => e.preventDefault();
		this.tabEls = {
			join: this.el.querySelector("chess-menu-tab[menu-page='join']"),
			create: this.el.querySelector("chess-menu-tab[menu-page='create']"),
			spectate: this.el.querySelector("chess-menu-tab[menu-page='spectate']"),
			ranked: this.el.querySelector("chess-menu-tab[menu-page='ranked']"),
			settings: this.el.querySelector("chess-menu-tab[menu-page='settings']"),
		};
		this.menuEls = {
			join: this.el.querySelector("chess-menu-join"),
			create: this.el.querySelector("chess-menu-create"),
			settings: this.el.querySelector("chess-menu-settings"),
		};
		this.gameList = this.menuEls.join.querySelector("chess-menu-games");
		this.shortCodeInputEl = this.menuEls.join.querySelector("input[type='text']");
		this.hasInteractedWithMenu = false;
		this.el.onmousedown = e => this.hasInteractedWithMenu = true;
		this.subscribed = false;
		this.selectedTab = undefined;
		this.openHandlers = {};
		this.openPage = undefined;
		for (let tab of Object.values(this.tabEls))
			tab.onclick = e => {
				if (tab.hasAttribute("inactive") || this.selectedTab == tab)
					return;
				if (this.selectedTab) {
					this.selectedTab.removeAttribute("selected");
					this.openPage.onclose(this.selectedTab.getAttribute("menu-page"));
				}
				tab.setAttribute("selected", "");
				this.selectedTab = tab;
				const pageName = tab.getAttribute("menu-page");
				this.el.setAttribute("selected", pageName);
				this.openPage = this.openHandlers[pageName];
				this.openPage.onopen(pageName);
			};
		this.initJoinMenu();
		this.initCreateMenu();
		this.initSettingsMenu();
		this.tabEls.join.click();
		setTimeout(_ => {
			if (!this.hasInteractedWithMenu && !this.connected)
				this.tabEls.create.click();
		}, 1000);

		socket.on("matchmaking-join-error", e => {
			if (window.location.pathname != "/") {
				if (document.referrer.replace(/\/$/, '') == window.location.origin.replace(/\/$/, ''))
					window.history.back();
				else
					window.history.replaceState("", "", "/");
			}
			console.error("joining failed:\n" + e);
			window.alert("Failed to join game:\n" + e);
		});
	}
	connectedOnline() {
		this.connected = true;
		this.tabEls.join.removeAttribute("disabled");
		// this.tabEls.spectate.removeAttribute("disabled");
		// this.tabEls.ranked.removeAttribute("disabled");
		this.menuEls.create.querySelector("chess-button.create-button[game-type='public']").removeAttribute("disabled");
		this.menuEls.create.querySelector("chess-button.create-button[game-type='private']").removeAttribute("disabled");
		let gameLaunch = false;
		if (!this.hasConnectedBefore) {
			const shortCode = window.location.pathname.substring(1, 4);
			if (shortCode.length == 3) {
				gameLaunch = true;
				this.tabEls.join.click();
				this.shortCodeInputEl.value = shortCode;
				this.submitShortCode();
				this.hasConnectedBefore = true; 
			}
		}
		if (this.selectedTab == this.tabEls.join) {
			this.menuEls.join.removeAttribute("connecting");
			this.shortCodeInputEl.focus();
			if (!gameLaunch)
				this.subscribeMatchList();
		}
		if (!this.hasInteractedWithMenu && !gameLaunch)
			this.tabEls.join.click();
	}
	disconnectedOnline() {
		this.connected = false;
		this.tabEls.join.setAttribute("disabled", "");
		this.tabEls.spectate.setAttribute("disabled", "");
		if (this.selectedTab == this.tabEls.join) {
			this.subscribed = false;
			this.gameList.innerHTML = "";
			this.menuEls.join.setAttribute("connecting", "");
			this.menuEls.join.setAttribute("loading", "");
			this.shortCodeInputEl.blur();
		}
		this.menuEls.create.querySelector("chess-button.create-button[game-type='public']").setAttribute("disabled", "");
		this.menuEls.create.querySelector("chess-button.create-button[game-type='private']").setAttribute("disabled", "");
	}
	subscribeMatchList() {
		if (this.subscribed || !this.connected)
			return;
		this.subscribed = true;
		this.socket.emit("matchmaking-subscribe");
	}
	initJoinMenu() {
		this.openHandlers.join = {
			onopen: _ => {
				this.subscribeMatchList();
				this.gameList.innerHTML = "";
				this.menuEls.join.setAttribute("loading", "");
				if (this.connected)
					this.shortCodeInputEl.focus();
			},
			onclose: _ => {
				if (this.subscribed) {
					this.socket.emit("matchmaking-unsubscribe");
					this.subscribed = false;
				}
			},
		};
		this.socket.on("matchmaking-update", (matches, hostedIndex) => {
			this.menuEls.join.removeAttribute("loading");
			this.gameList.innerHTML = "";
			const displayGameRow = (i, ownedGame) => {
				const game = matches[i];
				const el = document.createElement("chess-menu-game");
				const modeEl = document.createElement("chess-menu-game-mode");
				modeEl.innerText = game.mode;
				el.append(modeEl);
				const timeEl = document.createElement("chess-menu-game-time");
				if (game.time.start[0] == -1)
					timeEl.innerText = "unlimited time";
				else {
					let timeStr = "";
					const formatF = x => x < 1000 ? "." + x/100 : x / 1000 % 60 == 0 ? x/60000 + "m" : x/1000;
					const andSign = "+";
					const scaleSign = "N";
					if (game.time.incr)
						timeStr += andSign + formatF(game.time.incr);
					if (game.time.incrScale)
						timeStr += andSign + formatF(game.time.incrScale) + scaleSign;
					if (game.time.grace || game.time.graceScale) {
						if (game.time.grace && game.time.graceScale)
							timeStr += andSign + "(" + formatF(game.time.grace) + andSign + formatF(game.time.graceScale) + scaleSign + ")";
						else
							timeStr += andSign + "(" + formatF(game.time.grace || game.time.graceScale) + (game.time.graceScale ? scaleSign : "") + ")";
					}
					if (!timeStr.length)
						timeStr = andSign + "0";
					timeStr = (game.time.start[0] / 60000 % 60 == 0 ? game.time.start[0]/60/60/1000 + "h" : game.time.start[0] / 1000 % 60 == 0 ? game.time.start[0]/60/1000 : game.time.start[0]/1000 + "s") + timeStr; 
					timeEl.innerText = "time: " + timeStr;
				}
				el.append(timeEl);

				if (ownedGame) {
					el.setAttribute("owned", "");
					const shortCodeEl = document.createElement("chess-menu-game-code");
					let cooldown = false;
					shortCodeEl.onclick = _ => {
						if (cooldown)
							return;
						cooldown = true;
						setTimeout(_ => cooldown = false, 4000);
						copyToClipboard(window.location.origin + "/" + game.shortCode, "Invite link copied to clipboard");
					}
					shortCodeEl.innerText = game.shortCode;
					el.append(shortCodeEl);
				} else {
					const opponentEl = document.createElement("chess-menu-game-opponent");
					opponentEl.innerText = game.opponent.name;
					el.append(opponentEl);
					el.onclick = e => socket.emit("matchmaking-join", game.shortCode);
				}
				this.gameList.append(el);
			};
			if (hostedIndex >= 0) {
				displayGameRow(hostedIndex, true);
				// TODO: display spacer
			}
			for (let i = 0; i < matches.length; i++)
				if (i != hostedIndex)
					displayGameRow(i, false);
			if (!matches.length) {
				const emptyEl = document.createElement("chess-menu-games-empty");
				const createLinkEl = document.createElement("chess-menu-games-empty-link");
				createLinkEl.onclick = e => this.tabEls.create.click();
				emptyEl.append(createLinkEl);
				this.gameList.append(emptyEl);
			}
		});
		this.shortCodeInputEl.onkeydown = e => {
			if (e.which == 13)
				this.submitShortCode();
		}
		this.menuEls.join.querySelector("chess-menu-join-code-enter").onclick = e => this.submitShortCode();
	}
	submitShortCode() {
		if (this.shortCodeInputEl.value.length < 3)
			return;
		socket.emit("matchmaking-join", this.shortCodeInputEl.value);
		this.shortCodeInputEl.value = "";
	};
	initCreateMenu() {
		if (localStorage["createGameTime_start"] === undefined)
			localStorage["createGameTime_start"] = 45;
		if (localStorage["createGameTime_incrScale"] === undefined)
			localStorage["createGameTime_incrScale"] = 5;
		const timeControlsContainerEl = this.menuEls.create.querySelector("chess-menu-time-controls");
		// TODO: gamemode
		// TODO: color
		const timeEnableEl = this.menuEls.create.querySelector('input[type="checkbox"]');
		timeEnableEl.checked = localStorage["createGameTime_enabled"] === "1";
		if (!timeEnableEl.checked)
			timeControlsContainerEl.setAttribute("disabled", "");
		timeEnableEl.oninput = e => {
			localStorage["createGameTime_enabled"] = timeEnableEl.checked ? "1" : "0";
			if (timeEnableEl.checked)
				timeControlsContainerEl.removeAttribute("disabled");
			else
				timeControlsContainerEl.setAttribute("disabled", "");
		};
		let timeOptions = {};
		const bindSlider = (name, includeMinutes) => {
			const el = this.menuEls.create.querySelector('input[type="range"][name="' + name + '"]');
			const spanEl = el.parentElement.querySelector('span');
			el.value = localStorage["createGameTime_" + name] || 0;
			el.oninput = (e, bypass) => {
				if (!bypass) {
					timeEnableEl.checked = true;
					timeEnableEl.oninput();
					localStorage["createGameTime_" + name] = el.value;
				}
				let value;
				if (el.value <= 10)
					value = parseInt(el.value);
				else if (el.value <= 20)
					value = (el.value - 10) * 5 + 10;
				else if (el.value <= 36)
					value = (el.value - 20) * 15 + 60;
				else if (el.value <= 41)
					value = (el.value - 36) * 60 + 300;
				else if (el.value <= 51)
					value = (el.value - 41) * 300 + 600;
				else if (el.value <= 71)
					value = (el.value - 51) * 900 + 3600;
				else
					value = (el.value - 71) * 3600 + 18000;
				if (includeMinutes && value >= 3600)
					spanEl.innerText = Math.floor(value / 3600) + "h" + (value / 60 % 60 ? value / 60 % 60 + "m" : "");
				else
					spanEl.innerText = value >= 60 ? Math.floor(value / 60) + "m" + (value % 60 ? value % 60 + "s" : "") : value + "s";
				timeOptions[name] = value * 1000;
			};
			el.oninput(undefined, true);
		};
		bindSlider("start", true);
		bindSlider("incr", false);
		bindSlider("incrScale", false);
		bindSlider("grace", false);
		bindSlider("graceScale", false);
		let createdGameId, createMenuOpened = false;
		this.openHandlers.create = {
			onopen: _ => {
				createMenuOpened = true;
				if (createdGameId)
					destroyGame();
			},
			onclose: _ => {
				createMenuOpened = false;
			},
		};
		const createGame = (onlineGame, publicGame) => {
			const options = { 
				public: publicGame,
				time: {},
			};
			if (timeEnableEl.checked)
				Object.assign(options.time, timeOptions);
			else
				options.time.start = -1;
			if (!onlineGame) {
				options.time.start = [ options.time.start, options.time.start ];
				options.players = [{name: "you", side: 0}, {name: "you", side: 1}];
				startGame(options);
			} else {
				socket.emit("matchmaking-create", options, (gameId, shortCode) => {
					createdGameId = gameId;
					if (createMenuOpened)
						destroyGame();
					else if (!publicGame)
						copyToClipboard(window.location.origin + "/" + shortCode, "Invite link copied to clipboard");
				});
				this.subscribed = true;
				this.tabEls.join.click();
			}
		};
		const destroyGame = _ => {
			if (!createdGameId)
				return;
			this.socket.emit("matchmaking-destroy", createdGameId);
			createdGameId = undefined;
		};
		this.menuEls.create.querySelector("chess-button.create-button[game-type='public']").onclick = e => createGame(true, true);
		this.menuEls.create.querySelector("chess-button.create-button[game-type='private']").onclick = e => createGame(true, false);
		this.menuEls.create.querySelector("chess-button.create-button[game-type='local']").onclick = e => createGame(false);
	}
	initSettingsMenu() {
		this.openHandlers.settings = {
			onopen: _ => {},
			onclose: _ => {},
		};
	}
}


function copyToClipboard(value, message) {
	const copyBox = document.getElementById("copyTextBox");
	copyBox.value = value;
	copyBox.focus();
	copyBox.select();
	let successful = false;
	try {
		successful = document.execCommand('copy');
	} catch (err) { }
	if (successful)
		displayToast(message);
}

const toastQueue = [];
function displayToast(message) {
	const displayNextToast = _ => {
		const el = document.createElement("toast-notification");
		el.innerText = toastQueue[0];
		document.body.append(el);
		window.requestAnimationFrame(_ => {
			const next = _ => {
				toastQueue.shift();
				if (toastQueue.length)
					displayNextToast();
				el.removeAttribute("visible", "");
				window.requestAnimationFrame(_ => setTimeout(_ => el.remove(), 500));
			};
			el.setAttribute("visible", "");
			const timer = setTimeout(next, 4000);
			el.onclick = _ => {
				clearTimeout(timer);
				next();
			};
		});
	};
	if (toastQueue.push(message) == 1)
		displayNextToast();
}