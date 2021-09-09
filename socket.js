module.exports = function (server, VERSION) {

const UUID = require('uuid');
const io = require("socket.io")(server);
const {
	performance
} = require('perf_hooks');
const discord = require('./discordBridge');

const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');

const fs = require('fs');
const vm = require('vm');
global.performance = performance;
vm.runInThisContext(fs.readFileSync("public/js/gamePieces.js", "utf8"));
vm.runInThisContext(fs.readFileSync("public/js/game.js", "utf8"));

const shortCodeLetters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRTUVWXYZ2346789";
const games = {};
const subscribers = [];

class ServerGame extends Game {
	constructor(wrapper, options) {
		super(options, wrapper);
	}
	preInit() {
		super.preInit();
		this.wrapper = this.localPlayer;
		this.localPlayer = [true, true];
	}
	testMoves(moveSet, isSubmit, playedBy) {
		if (this.turn != playedBy)
			return { success: false };
		let isValid = false;
		try {
			validTest:
			while (true) {
				for (let move of moveSet) {
					if (move.from) {
						const sourcePiece = this.getPiece(move.from);
						if (!sourcePiece || sourcePiece.side != this.turn)
							break validTest; // sourcePiece doesn't exist or is owned by opponent
						moveFoundTest:
						while (true) {
							for (let pos of sourcePiece.enumerateMoves())
								if (pos.equals(move.to))
									break moveFoundTest;
							break validTest; // sourcePiece cannot move to destination
						}
						if (move.promote) {
							if (sourcePiece.type != "Pawn")
								break validTest; // piece is not a pawn
							if (move.to.x != sourcePiece.side ? 0 : 7)
								break validTest; // pawn is not moving to last rank
						}
						this.applyMove(this.instantiateMove(sourcePiece, move.to, move.promote, true, true), true);

					} else if (move.l !== undefined) { // null move
						if (isSubmit || !this.getTimeline(move.l))
							break validTest; // null move with invalid timeline or during submit
					} else
						break validTest; // unknown move type
				}
				isValid = true;
				break;
			}
		} catch (ex) {
			console.error(ex);
			isValid = false;
		}
		let elapsedTime, timeGainedCap;
		if (isSubmit) {
			if (isValid)
				isValid = this.checkSubmitAvailable();
			if (isValid) {
				const result = this.submit(true, true, false);
				isValid = result.submitted;
				elapsedTime = result.elapsedTime;
				timeGainedCap = result.timeGainedCap;
			}
		}
		if (!isValid || !isSubmit) {
			for (let move of this.currentTurnMoves)
				move.undo();
			this.currentTurnMoves = [];
		}
		return { success: isValid, elapsedTime: elapsedTime, timeGainedCap };
	}
	end(winner, cause, reason, inPast) {
		super.end(winner, cause, reason, inPast);
		if (!inPast)
			this.wrapper.endHook(winner, cause, reason);
	}
}

class Wrapper {
	constructor(playerOneSocket, options) {
		options = options || {};
		do {
			this.id = UUID.v4();
		} while (games[this.id]);
		this._playerOneColor = (options.fixedPlayerColors ? options.playerOneColor === true : Math.random() > .5) ? 1 : 0;
		this._playerUuids = [undefined, undefined];
		this._playerUuids[this._playerOneColor] = playerOneSocket.uuid;
		this.players = [undefined, undefined];
		this.players[this._playerOneColor] = this.serializePlayer(playerOneSocket);
		this._sockets = [undefined, undefined];
		this._sockets[this._playerOneColor] = playerOneSocket;
		playerOneSocket.connectedGames.push(this);
		this.drawBy = -1;
		this.winner = -2;
		this.winReason = undefined;
		this.moves = [[]];
		this.messages = [];
		this._timeIndexes = [-1, -1];
		this._lastSubmitTime = undefined;
		this.mode = "standard";
		this.public = options.public === true;
		this.started = false;
		this.runningClocks = false;
		this.finished = false;
		const roundF = x => !Number.isInteger(x) || x < 0 ? 0 : x < 1000 ? 100 * Math.round(x / 100) : 1000 * Math.round(x / 1000);
		this.time = options.time && Number.isInteger(options.time.start) && options.time.start >= 0 ? {
			start: new Array(2).fill(options.time.start < 0 ? 0 : options.time.start < 60*1000 ? Math.round(options.time.start / 1000) * 1000 : Math.round(options.time.start / (60*1000))*60*1000),
			incr: roundF(options.time.incr || 0),
			incrScale: roundF(options.time.incrScale || 0),
			grace: roundF(options.time.grace || 0),
			graceScale: roundF(options.time.graceScale || 0),
		} : { start: [ -1, -1 ], incr: 0, grace: 0, incrScale: 0, graceScale: 0 };
		do {
			this.shortCode = "";
			for (let i = 0; i < 3; i++)
				this.shortCode += shortCodeLetters[Math.floor(Math.random() * shortCodeLetters.length)];
		} while (Object.values(games).some(g => g.shortCode == this.shortCode));
		
		this._gameObj = new ServerGame(this, this.serialize());
		games[this.id] = this;
	}
	launch(playerTwoSocket) {
		this._sockets[1 - this._playerOneColor] = playerTwoSocket;
		playerTwoSocket.connectedGames.push(this);
		this._playerUuids[1 - this._playerOneColor] = playerTwoSocket.uuid;
		this.players[1 - this._playerOneColor] = this.serializePlayer(playerTwoSocket);
		this._sockets[this._playerOneColor].hostedGame = undefined;
		this.started = true;
		const gameForClient = this.serialize();
		for (let i = 2; i < this._sockets.length; i++)
			this._sockets[i].emit("game-launch", gameForClient);
		gameForClient.player = 0;
		this._sockets[0].emit("game-launch", gameForClient);
		gameForClient.player = 1;
		this._sockets[1].emit("game-launch", gameForClient);
	}
	rejoin(socket) {
		clearTimeout(this.destroyTimer);
		if (!this.finished)
			this.registerMessage(-1, socket, "reconnected");
		const gameForClient = this.serialize();
		gameForClient.player = socket.uuid == this._playerUuids[1] ? 1 : 0;
		this._sockets[gameForClient.player] = socket;
		socket.connectedGames.push(this);
		if (this._timeIndexes[gameForClient.player] > 0)
			this._timeIndexes[gameForClient.player] = 0;
		socket.emit("game-launch", gameForClient);
	}
	disconnect(socket) {
		const gameIndex = socket.connectedGames.indexOf(this);
		if (gameIndex == -1)
			throw Error("player not connected to game", socket, this);
		socket.connectedGames.splice(gameIndex, 1);
		let i = 0;
		for (; i < this._sockets.length; i++)
			if (this._sockets[i] && this._sockets[i].uuid == socket.uuid)
				break;
		if (i >= this._sockets.length)
			console.error("player not found in game?!", socket, this);
		else {
			if (i < 2)
				this._sockets[i] = undefined;
			else
				this._sockets.splice(i, 1);
		}
		if (!this.finished)
			this.registerMessage(-1, socket, "disconnected");
		if (!this.runningClocks) {
			let anyConnectionsRemaining = false;
			for (let socket of this._sockets)
				if (socket) {
					anyConnectionsRemaining = true;
					break;
				}
			if (!anyConnectionsRemaining)
				this.destroyTimer = setTimeout(_ => this.destroy(), 30000);
		}
	}
	endHook(winner, cause, reason) {
		switch (reason) {
			case "timeout":
			case "checkmate":
				this.end(reason, cause, this._sockets[cause]);
				break;
		}
	}
	end(reason, player, socket) {
		if (this.finished)
			return;
		let message, winner, cause = player;
		let playerName = socket.name; // TODO: could be disconnected
		if (this.finished)
			return;
		switch (reason) {
			case "resign":
				message = playerName + " resigned";
				winner = 1 - player;
				break;
			case "draw":
				message = playerName + " accepted the draw";
				winner = -1;
				break;
			case "draw":
				message = "Game ended in a stalemate.";
				winner = -1;
				break;
			case "checkmate":
				message = playerName + " was checkmated";
				winner = 1 - player;
				break;
			case "timeout":
				message = playerName + " ran out of time";
				winner = 1 - player;
				break;
			default:
				throw Error("unknown game end reason");
		}
		this.finished = true;
		this.winner = winner;
		this.winCause = player;
		this.winReason = reason;
		this.registerMessage(-1, socket, message, undefined, true);
		for (let socket of this._sockets)
			if (socket)
				socket.emit("game-end", this.id, winner, cause, reason);
	}
	destroy() {
		this.started = true;
		this.finished = true;
		delete games[this.id];
		if (this.public)
			updateSubscribers(false);
		for (let socket of this._sockets)
			if (socket)
				this.disconnect(socket);
	}
	// spectate(socket) {
	// 	this._spectators.push(socket);
	// 	this._sockets[0].emit("game-launch", this.serialize());
	// 	// TODO
	// }
	serialize() {
		const result = { };
		for (const [k, v] of Object.entries(this))
			if (k[0] != '_')
				result[k] = v;
		if (this._gameObj)
			result.time.start = this._gameObj.timeRemaining;
		if (this.runningClocks) {
			result.runningClockTime = performance.now() - this._gameObj.players[this._gameObj.turn].turnStartTime;
			result.runningClockGraceTime = Math.min(result.runningClockTime, this._gameObj.players[this._gameObj.turn].lastGrace);
		}
		return result;
	}
	serializePlayer(socket) {
		const obj = {
			name: socket.name,
			avatar: socket.avatar,
			side: -1,
		};
		if (socket.uuid == this._playerUuids[1])
			obj.side = 1;
		else if (socket.uuid == this._playerUuids[0])
			obj.side = 0;
		return obj;
	}
	list() {
		return {
			opponent: this.players[this._playerOneColor],
			id: this.id,
			shortCode: this.shortCode,
			time: this.time,
			mode: this.mode,
		}
	}
	registerMessage(playerIndex, socket, message, chatId, dontSend) {
		const playerInfo = this.serializePlayer(socket);
		const systemMessage = playerIndex == -1;
		const messageObject = { playerInfo: playerInfo, message: message };
		if (systemMessage)
			messageObject.system = true;
		this.messages.push(messageObject);
		if (!dontSend)
			for (let i = 0; i < this._sockets.length; i++)
				if (this._sockets[i])
					this._sockets[i].emit("game-chat", this.id, playerInfo, message, systemMessage, i == playerIndex ? chatId : undefined);
	}
}

function listGames() {
	return Object.values(games).filter(g => g.public && !g.started).map(g => g.list());
}
function sendGamesList(list, socket) {
	let hostedIndex = -1;
	if (socket.hostedGame && !socket.hostedGame.started) {
		if (socket.hostedGame.public) {
			hostedIndex = list.findIndex(g => g.id == socket.hostedGame.id);
		} else
			hostedIndex = list.push(socket.hostedGame.list()) - 1;
	}
	socket.emit("matchmaking-update", list, hostedIndex);
	if (socket.hostedGame && !socket.hostedGame.started)
		if (!socket.hostedGame.public)
			list.pop();
}
function updateSubscribers(created) {
	const list = listGames();
	discord.update(list, created);
	for (let socket of subscribers)
		sendGamesList(list, socket);
}



io.on("connection", socket => {
	socket.name = socket.uuid = undefined;
	socket.connectedGames = [];
	socket.on("uuid", uuid => {
		socket.uuid = uuid;
		socket.name = socket.uuid == "647775f8-3b8f-4a47-9744-f24bb24fbdfb" ? "L0laapk3" : uniqueNamesGenerator({ dictionaries: [adjectives, animals], seed: parseInt(socket.uuid, 16) });
		socket.avatar = uuid == "647775f8-3b8f-4a47-9744-f24bb24fbdfb" ? "https://cdn.discordapp.com/avatars/180017294657716225/675f55c8176dccb649bb98fe10b3eaf4.png" : undefined;
		if (!checkUuid())
			return;
		socket.emit("uuid-ok");
	});
	function newUuid() {
		socket.uuid = UUID.v4();
		socket.name = socket.uuid == "647775f8-3b8f-4a47-9744-f24bb24fbdfb" ? "L0laapk3" : uniqueNamesGenerator({ dictionaries: [adjectives, animals], seed: parseInt(socket.uuid, 16) });
		socket.emit("uuid-new", socket.uuid);
	}
	function checkUuid() {
		if (socket.uuid)
			return true;
		newUuid();
		return false;
	}



	function subscribe(socket) {
		if (subscribers.indexOf(socket) == -1)
			subscribers.push(socket);
		sendGamesList(listGames(), socket);
	}
	function unsubscribe(socket) {
		const i = subscribers.indexOf(socket);
		if (i != -1)
			subscribers.splice(i, 1);
	}
	socket.on("matchmaking-subscribe", _ => {
		if (!checkUuid())
			return;
		subscribe(socket);
	});
	socket.on("matchmaking-unsubscribe", _ => {
		if (!checkUuid())
			return;
		unsubscribe(socket);
	});
	socket.on('disconnect', _ => {
		unsubscribe(socket);
		if (socket.hostedGame && !socket.hostedGame.started)
			socket.hostedGame.destroy();
		while (socket.connectedGames.length)
			socket.connectedGames[0].disconnect(socket);
	});

	socket.on("matchmaking-create", (options, cb) => {
		if (!checkUuid())
			return;
		let game;
		try {
			game = new Wrapper(socket, options);
		} catch (ex) {
			console.warn(ex);
			socket.emit("generic-error", ex);
		}
		if (game) {
			socket.hostedGame = game;
			cb(game.id, game.shortCode);
			if (game.public)
				updateSubscribers(true);
			subscribe(socket);
		}
	});
	socket.on("matchmaking-destroy", gameId => {
		if (!checkUuid())
			return;
		const game = games[gameId];
		if (!game || game.started || game._playerUuids[game._playerOneColor] != socket.uuid)
			return;
		game.destroy();
	});
	socket.on("matchmaking-join", shortCode => {
		if (!checkUuid())
			return;
		let game;
		for (let g of Object.values(games))
			if (g.shortCode == shortCode) {
				game = g;
				break;
			}

		if (!game)
			socket.emit("matchmaking-join-error", "Game doesn't exist.");
		else if (!game.started) {
			if (game._playerUuids[0] == socket.uuid)
				socket.emit("matchmaking-join-error", "Cannot join your own game.");
			else
				game.launch(socket);
		} else {
			if (game._playerUuids.indexOf(socket.uuid) > -1) {
				game.rejoin(socket);
			} else {
				// todo: spectate
				socket.emit("matchmaking-join-error", "Game is full.");
			}
		}
	});

	socket.on("game-action", (gameId, action, currentTurnMoves, timeTaken) => {
		if (!checkUuid())
			return;
		const game = games[gameId];
		if (!game)
			return socket.emit("generic-error", "game doesn't exist.");
		if (game.finished)
			return socket.emit("generic-error", "game finished.");

		const player = game._sockets[1].uuid == socket.uuid ? 1 : 0;
		// todo: verify currentTurnMoves

		let isMove = false, isSubmit = false, timeTakenServer, maxTimeGained;
		let message;
		switch (action) {
			case "submit":
				isSubmit = true;
			case "move":
			case "undo":
				isMove = true;
				const { success, elapsedTime, timeGainedCap } = game._gameObj.testMoves(currentTurnMoves, isSubmit, player);
				if(!success)
					return socket.emit("generic-error", "Bad moveset.");
				timeTakenServer = elapsedTime;
				maxTimeGained = timeGainedCap;
				break;
			case "draw":
				if (game.drawBy == player)
					return socket.emit("generic-error", "cannot offer draw so fast.");
				if (game.drawBy == -1) {
					game.registerMessage(-1, socket, socket.name + " has offered a draw");
					game.drawBy = player;
					break;
				} else
				break;
			case "resign":
			case "checkmate":
				game.end(action, player, socket);
				break;
			default:
				return socket.emit("generic-error", "action doesn't exist.");
		}
		if (isMove) {
			game.moves[game.moves.length-1] = currentTurnMoves;
			if (isSubmit) {
				game.moves.push([]);
				game.runningClocks = game.moves.length > 2;
				if (game._timeIndexes[player] > -1) {
					timeTaken = Math.max(-maxTimeGained, Math.max(timeTakenServer - 200, Math.min(timeTakenServer, timeTaken)));
					game._sockets[player].emit("game-time", gameId, game._timeIndexes[player], timeTaken);
				} else
					timeTaken = 0;
				game._timeIndexes[player]++;
			} else
				timeTaken = undefined;
		}

		for (let i = 0; i < game._sockets.length; i++)
			if (i != player && game._sockets[i])
				game._sockets[i].emit("game-action", gameId, action, currentTurnMoves, timeTaken);
	});
	socket.on("game-chat", (gameId, chatId, message) => {
		if (!checkUuid())
			return;
		const game = games[gameId];
		if (!game)
			return socket.emit("generic-error", "game doesn't exist.");

		if (message != message.trim() || message.length > 255)
			return;
			
		const playerIndex = game._sockets.findIndex(s => s && s.uuid == socket.uuid);
		if (playerIndex == -1)
			throw Error("player not found in game somehow", playerIndex, game);

		game.registerMessage(playerIndex, socket, message, chatId);
	});

	socket.emit("ready", VERSION);
});

}