"use strict";

function playUndoSound() {

}

class Highlight {
	constructor(board, x, y) {
		this.game = board.game;
		this.board = board;
		this.x = x;
		this.y = y;
		this.el = document.createElement("chess-highlight");
		this.el.style.setProperty("--x", x);
		this.el.style.setProperty("--y", y);
	}
	pos(incrL) {
		return new Vec4(this.x, this.y, this.board.l, incrL ? this.board.t + 1 : this.board.t);
	}
}
class HoverHighlight extends Highlight {
	constructor(board, x, y) {
		super(board, x, y);
		game.highlights.push(this);
		this.el.onclick = e => this.clicked(e);
		this.el.onmouseenter = e => this.hover(e);
		this.el.onmouseleave = e => this.game.removeGhostPiece();
		board.hoverHighlightEl.append(this.el);
		for (let marker of board.markers)
			if(marker.x == x && marker.y == y)
				marker.el.style.setProperty("display", "none");
	}
	clicked(e) {
		if (this.game.lastMouseWasDrag || !this.game.selectedPiece)
			return;
		if (this.game.selectedPiece.type == "Pawn" &&
			this.x == (this.game.selectedPiece.side ? 0 : 7) &&
			this.game.selectedPiece.side == this.game.turn &&
			this.game.localPlayer[this.game.turn]) {
			this.board.createPromotionSelector(this);
		} else
			this.game.move(this);
	}
	hover(e) {
		const inPlacePiece = this.board.pieces[this.x][this.y];
		if (inPlacePiece == this.game.selectedPiece || !this.game.ghostPiece)
			return;
		this.game.ghostPiece.move(this.board, this.x, this.y);
	}
}
class MoveMarker extends Highlight {
	constructor(board, x, y) {
		super(board, x, y);
		board.markers.push(this);
		board.markerHighlightEl.append(this.el);
	}
}


class ArrowOverlayPiece extends ClientBasePiece {
	constructor(piece, arrow) {
		super(piece.game, piece.board, piece.side, arrow.offsetX, arrow.offsetY);
		this.coverPiece = piece;
		this.coverPiece.el.setAttribute("covered", "");
		this.arrow = arrow;
		this.el.setAttribute("arrow-overlay", "");
		this.initType(piece.constructor.name);
		this.el.style.setProperty("z-index", arrow.zIndex);
		arrow.board.arrowEl.append(this.el);
	}
	update() {
		this.el.style.setProperty("--x", this.arrow.offsetX);
		this.el.style.setProperty("--y", this.arrow.offsetY);
		this.x = this.arrow.offsetX;
		this.y = this.arrow.offsetY;
	}
	remove() {
		this.coverPiece.el.removeAttribute("covered");
	}
}

class GhostPiece extends ClientBasePiece {
	constructor(piece) {
		super(piece.game, undefined, piece.side, undefined, undefined);
		this.initType(piece.constructor.name);
		this.board = undefined;
		this.el.setAttribute("ghost", "");
		this.hiddenBelow = undefined;
		this.detach();
	}
	revealBelow() {
		if (!this.hiddenBelow)
			return;
		this.el.removeAttribute("taking");
		// this.hiddenBelow.el.style.removeProperty("display");
		this.hiddenBelow = undefined;
	}
	detach() {
		this.revealBelow();
		this.el.setAttribute("default", "");
		if (this.game.localPlayer[this.game.turn])
			this.setPosition(this.game.selectedPiece.board, this.game.selectedPiece.x, this.game.selectedPiece.y);
		else {
			this.el.remove();
			this.board = undefined;
			this.x = undefined;
			this.y = undefined;
		}
	}
	move(board, x, y) {
		this.el.removeAttribute("default");
		this.revealBelow();
		this.hiddenBelow = board.pieces[x][y];
		if (this.hiddenBelow)
			this.el.setAttribute("taking", "");
			//this.hiddenBelow.el.style.setProperty("display", "none");
		this.setPosition(board, x, y);
	}
	setPosition(board, x, y) {
		this.board = board;
		this.x = x;
		this.y = y;
		this.el.style.setProperty("--x", x);
		this.el.style.setProperty("--y", y);
		board.piecesEl.append(this.el);
	}
	remove() {
		this.el.remove();
		// this.board = undefined;
		// this.x = undefined;
		// this.y = undefined;
	}
}



class Arrow {
	constructor(board, fromPiece, from, to, isCheck) {
		this.side = fromPiece.side;
		this.outlineEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
		const color = this.side ? "white" : "black";
		this.outlineEl.classList.add("outline", isCheck ? "check" : "nocheck", color);
		this.outlineEl.setAttribute("marker-end", "url(#arrow-head-" + color + (isCheck ? "-check" : "") + ")");
		this.outlineEl.style.setProperty("z-index", this.zIndex);
		this.fillEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.fillEl.classList.add("fill", isCheck ? "check" : "nocheck", color);
		this.fillEl.style.setProperty("z-index", this.zIndex);
		this.board = board;
		this.game = board.game;
		this.from = from;
		this.to = to;
		this.zIndex = ++board.game.arrowCount;
		board.arrowEl.append(this.outlineEl);
		board.arrowEl.append(this.fillEl);
		this.overlayPiece = new ArrowOverlayPiece(fromPiece, this);
		this.update();
		board.arrows.push(this);
	}
	update() {
		//TODO: fix
		const flipPos = x => this.game.flipped ? 7 - x : x;
		const flipL = l => this.game.flipped ? -l : l;
		const SCALE = 360 / 8;
		this.offsetX = flipPos(this.from.x) + flipL(this.from.l - this.board.l) * 9;
		this.offsetY = flipPos(this.from.y) + (this.from.t - this.board.t) * 9;
		const fromX = this.offsetX + 0.5;
		const fromY = this.offsetY + 0.5;
		let toX = flipPos(this.to.x) + 0.5 + flipL(this.to.l - this.board.l) * 9;
		let toY = flipPos(this.to.y) + 0.5 + (this.to.t - this.board.t) * 9;
		const straightLength = Math.sqrt((toX - fromX)**2 + (toY - fromY)**2);
		const curve = 3 / straightLength * Math.sign(toY - .01 - fromY);
		const midX = (fromX + toX) / 2 - curve * (toY - fromY) / 2;
		const midY = (fromY + toY) / 2 + curve * (toX - fromX) / 2;
		const shiftScale = -.3 / straightLength;
		toX += (toX - fromX) * shiftScale;
		toY += (toY - fromY) * shiftScale;
		const path = `M${fromY*SCALE},${fromX*SCALE} Q${midY*SCALE},${midX*SCALE} ${toY*SCALE},${toX*SCALE}`;
		this.outlineEl.setAttribute("d", path);
		this.fillEl.setAttribute("d", path);
		this.overlayPiece.update();
	}
	remove() {
		this.overlayPiece.remove();
	}
}





class ClientBoard extends Board {
	constructor(game, l, t, turn, initialBoard, fastForward) {
		super(game, l, t, turn, initialBoard, fastForward);

		this.checkEl.onclick = e => {
			game.applyMove(game.instantiateMove(this));
			game.undoButton.removeAttribute("disabled");
			if (game.localPlayer[game.turn])
				game.send("move", game.currentTurnMoves);
		}
		this.promotionSelector = undefined;
		this.promotionSelectorHighlight = undefined;
		this.markers = [];
		this.immediateChecks = [];

		this.el.setAttribute("turn", this.turn ? "white" : "black");

		this.el.style.setProperty("--left", this.t - this.timeline.start);
		this.timeline.el.append(this.el);
		this.game.updateDimensions();
		if (!initialBoard) {
			this.el.setAttribute("unsubmitted", "");
			if (fastForward)
				this.el.setAttribute("animated", "")
			else {
				this.el.setAttribute("animate-start", "");
				window.requestAnimationFrame(_ => {
					this.el.removeAttribute("animate-start");
					window.requestAnimationFrame(_ => setTimeout(_ => this.el.setAttribute("animated", ""), 500));
				});
			}
		}

		if (this.game.hoveredPiece) {
			const hoveredPiece = this.game.hoveredPiece;
			this.game.removeHighlights();
			hoveredPiece.hover();
		}
	}
	init() {
		super.init();
		this.el = document.createElement("chess-board");
		this.markerHighlightEl = document.createElement("chess-board-highlight-marker");
		this.hoverHighlightEl = document.createElement("chess-board-highlight-hover");
		this.piecesEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.piecesEl.classList.add("chess-board-pieces");
		const chessBackgroundRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		chessBackgroundRect.setAttribute("fill", "url(#chess-background)");
		chessBackgroundRect.setAttribute("width", "360");
		chessBackgroundRect.setAttribute("height", "360");
		const chessBackground = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		chessBackground.setAttribute("viewBox", "0 0 360 360");
		chessBackground.append(chessBackgroundRect);
		this.piecesEl.setAttribute("viewBox", "0 0 360 360");
		this.arrowEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.arrowEl.classList.add("chess-arrows");
		this.arrowEl.setAttribute("viewBox", "0 0 360 360");
		this.arrows = [];
		this.checkEl = document.createElement("chess-board-check");
		this.el.append(chessBackground);
		this.el.append(this.markerHighlightEl);
		this.el.append(this.hoverHighlightEl);
		this.el.append(this.piecesEl);
		this.el.append(this.checkEl);
		this.el.append(this.arrowEl);
	}

	hasImminentChecks() {
		super.hasImminentChecks();
		if (this.imminentCheck)
			this.el.setAttribute("check-imminent", "");
		else
			this.el.removeAttribute("check-imminent");
		return this.imminentCheck;
	}
	updateImmediateChecks() {
		this.immediateChecks = [];
		for (let timelineDirection of this.game.timelines)
			for (let timeline of timelineDirection) {
				const board = timeline.boards[timeline.boards.length - 1];
				if (board.turn == this.turn)
					for (let row of board.pieces)
						for (let piece of row)
							if (piece && piece.side == this.turn) {
								nextCheckLoop:
								for (let enemyTakePos of piece.enumerateMoves()) {
									const takePiece = this.game.getPiece(enemyTakePos);
									if (takePiece && takePiece.side != this.turn && takePiece.type == "King") {
										for (let existingCheck of this.game.displayedChecks)
											if (existingCheck[0].equals(piece.pos()) && existingCheck[1].equals(takePiece.pos()))
												continue nextCheckLoop;
										this.immediateChecks.push([piece, takePiece]);
									}
								}
							}
				}
		if (this.immediateChecks.length == 0)
			return;
		for (let check of this.immediateChecks) {
			const sourcePiece = check[0];
			const targetPiece = check[1];
			const from = sourcePiece.pos();
			const to = targetPiece.pos();
			this.game.displayedChecks.push([from, to]);
			new Arrow(this, sourcePiece, from, to, true);
		}
	}
	updateImmediateChecksAfter() {
		let hasCheckFromToBoard = false;
		checkLoop:
		for (let check of this.game.displayedChecks)
			for (let checkPos of check) {
				if (checkPos.l == this.l && checkPos.t == this.t) {
					hasCheckFromToBoard = true;
					break checkLoop;
				}
			}
		if (hasCheckFromToBoard)
			this.el.setAttribute("check-immediate", "");
		else
			this.el.removeAttribute("check-immediate");
	}

	makeInactive() {
		super.makeInactive();
		this.el.setAttribute("inactive", "");
	}
	makeActive() {
		super.makeActive();
		this.el.setAttribute("merging", "");
		this.el.removeAttribute("inactive");
		return _ => {
			this.el.removeAttribute("merging");
		};
	}
	remove(animationEndCb) {
		const timelineAnimationEndCb = super.remove();
		if (this.immediateChecks.length) {
			const firstPos = this.game.displayedChecks.findIndex(e => e[0].equals(this.immediateChecks[0][0].pos()) && e[1].equals(this.immediateChecks[0][1].pos()));
			this.game.displayedChecks.splice(firstPos, this.immediateChecks.length);
		}
		this.game.updateImmediateChecksAfter();
		this.game.updateDimensions();

		for (let arrow of this.arrows)
			arrow.remove();

		this.el.removeAttribute("unsubmitted");
		this.el.setAttribute("deleting", "");
		this.el.setAttribute("animate-start", "");
		window.requestAnimationFrame(_ => setTimeout(_ => {
			timelineAnimationEndCb();
			this.el.remove();
			animationEndCb();
		}, 500));
		this.game.startPanAnimation(this);
	}
	createPromotionSelector(piece) {
		this.destroyPromotionSelector();
		this.game.promotionSelector = document.createElement("chess-promotion-selector");
		this.game.promotionSelector.style.setProperty("--y", piece.y);
		this.game.promotionSelector.setAttribute("color", this.game.selectedPiece.side ? "white" : "black");
		const promotionPiecesEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		promotionPiecesEl.setAttribute("viewBox", "0 0 45 180");
		const pieces = ["Queen", "Knight", "Rook", "Bishop"];
		const piecesNum = [1, 2, 3, 4];
		if (!this.game.selectedPiece.side) {
			pieces.reverse();
			piecesNum.reverse();
		}
		promotionPiecesEl.onmouseleave = e => this.game.promotionSelector.style.removeProperty("--selection");
		for (let i = 0; i < pieces.length; i++) {
			const pieceEl = document.createElementNS("http://www.w3.org/2000/svg", "use");
			const color = this.game.selectedPiece.side ? "white" : "black";
			pieceEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + pieces[i].toLowerCase() + "-" + color)
			pieceEl.setAttribute("color", color);
			pieceEl.style.setProperty("--x", i);
			pieceEl.style.setProperty("--y", 0);
			pieceEl.onmouseenter = e => this.game.promotionSelector.style.setProperty("--selection", i + 1);
			pieceEl.onclick = e => {
				this.destroyPromotionSelector();
				this.game.move(piece, piecesNum[i]);
			};
			promotionPiecesEl.append(pieceEl);
		}
		this.game.promotionSelector.onclick = e => this.destroyPromotionSelector();
		this.game.promotionSelector.append(promotionPiecesEl);
		this.el.append(this.game.promotionSelector);
	}
	destroyPromotionSelector() {
		if (!this.game.promotionSelector)
			return;
		this.game.promotionSelector.remove();
		this.game.promotionSelector = undefined;
		this.game.promotionSelectorHighlight = undefined;
		// this.game.removeGhostPiece();
	}
}

class ClientTimeline extends Timeline {
	constructor(game, l, t, sourceL, fastForward) {
		super(game, l, t, sourceL, fastForward);

		this.el = document.createElement("chess-timeline");
		this.el.append(document.createElement("chess-timeline-arrow-start"));
		this.arrowEndEl = document.createElement("chess-timeline-arrow-end");
		this.el.style.setProperty("--start-time", t);
		this.el.style.setProperty("--timeline-number", l);
		if (sourceL !== undefined)
			this.el.setAttribute("parent-timeline", sourceL - l);
		if (Math.abs(this.l) > this.game.timelineCount[1 - this.side] + 1)
			this.el.setAttribute("inactive", "");
		if (l < 0)
			game.timelinesEl.prepend(this.el);
		else
			game.timelinesEl.append(this.el);
		this.game.updateDimensions();
	}
	setBoard(t, board) {
		if (t > this.end) {
			this.el.style.setProperty("--boards-on-timeline", t - this.start + 1);
			board.el.append(this.arrowEndEl);
		}
		super.setBoard(t, board);
	}
	pop() {
		const oldBoard = super.pop();
		this.el.style.setProperty("--boards-on-timeline", this.end - this.start + 1);
		return _ => {
			if (this.arrowEndEl.parentElement == oldBoard.el && this.boards.length)
				this.boards[this.boards.length - 1].el.append(this.arrowEndEl);
		};
	}
	remove() {
		super.remove();
		this.el.remove();
		this.game.updateDimensions();
	}
	activate() {
		super.activate();
		this.el.removeAttribute("inactive");
	}
	deactivate() {
		super.deactivate();
		this.el.setAttribute("inactive", "");
	}
	isSubmitReady() {
		return super.isSubmitReady() && !this.boards[this.boards.length - 1].immediateChecks.length;
	}
}

let shiftHeld = false;
let ctrlHeld = false;
window.addEventListener("keydown", e => {
	if (e.keyCode == 16)
		shiftHeld = true;
	if (e.keyCode == 17)
		ctrlHeld = true;
});
window.addEventListener("keyup", e => {
	if (e.keyCode == 16)
		shiftHeld = false;
	if (e.keyCode == 17)
		ctrlHeld = false;
});
document.addEventListener("mouseleave", e => {
	ctrlHeld = shiftHeld = false;
});



class ClientMove extends Move {
	constructor(game, sourcePiece, targetPos, promotionTo, remoteMove, fastForward) {
		super(game, sourcePiece, targetPos, promotionTo, remoteMove, fastForward);

		if (!this.nullMove) {
			if (this.isInterDimensionalMove)
				new Arrow(this.targetBoard, sourcePiece, sourcePiece.pos(), targetPos);

			new MoveMarker(this.sourceBoard, sourcePiece.x, sourcePiece.y);
			new MoveMarker(this.targetBoard, targetPos.x, targetPos.y);
		}

		game.updateImmediateChecks(this.createdBoards);
		game.startPanAnimation(this.sourceBoard);
	}
}

class Chat {
	constructor(game, online) {
		this.game = game;
		this.online = online;
		this.inputLines = 1;
		this.el = document.createElement("form");
		this.el.classList.add("chess-chat");

		this.chats = {};
		this.historyEl = document.createElement("chess-chat-history");
		this.historyEl.onmousedown = e => {
			if (e.target != this.historyEl)
				return;
			this.historyEl.style.setProperty("pointer-events", "none");
			document.elementFromPoint(e.clientX, e.clientY).dispatchEvent(new e.constructor(e.type, e));
		}
		window.addEventListener("mouseup", _ => this.historyEl.style.removeProperty("pointer-events"));
		document.addEventListener("mouseleave", _ => this.historyEl.style.removeProperty("pointer-events"));
		window.addEventListener("resize", _ => this.checkScrollbar());

		if (online) {
			const submitEl = document.createElement("input");
			submitEl.setAttribute("type", "submit");
			this.el.onsubmit = e => {
				e.preventDefault();
				this.send();
			}
			this.el.append(submitEl);

			this.inputEl = document.createElement("textarea");
			this.inputEl.setAttribute("placeholder", game.options.player == -1 ? "Send a message" : "Send a message to your opponent");
			this.inputEl.setAttribute("wrap", "soft");
			this.inputEl.setAttribute("maxlength", "255");
			this.inputEl.setAttribute("enterkeyhint", "send");
			this.inputEl.onkeydown = e => {
				e.stopPropagation();
				this.send(e);
				this.resizeText(e);
			};
			this.inputEl.oncut = e => this.resizeText(e);
			this.inputEl.onpaste = e => this.resizeText(e);
			window.addEventListener("resize", e => this.resizeText(e));
			this.el.append(this.inputEl);
			game.socket.on("game-chat", this.receive.bind(this));
		}
		this.el.append(this.historyEl);

		game.sideBarEl.append(this.el);

		for (let m of game.options.messages || [])
			this.createMessage(m.playerInfo, m.message, m.system, undefined, true);
	}
	resizeText(e) {
		const chatScrollAmount = this.historyEl.scrollTop + this.historyEl.offsetHeight;
		window.requestAnimationFrame(_ => {
			this.inputEl.style.setProperty("--lines", 1);
			const linesAmount = Math.floor(this.inputEl.scrollHeight / parseFloat(window.getComputedStyle(this.inputEl).lineHeight));
			this.inputEl.style.setProperty("--lines", linesAmount);
			if (linesAmount != this.inputLines)
				this.historyEl.scrollTop = chatScrollAmount - this.historyEl.offsetHeight;
			this.inputLines = linesAmount;
		});
	}
	send(e) {
		if (e && (e.key != "Enter" || e.shiftKey) || !this.online)
			return;
		e.preventDefault();
		const message = this.inputEl.value.trim();
		if (message) {
			const chatNr = localStorage.chatCount = parseInt(localStorage.chatCount) + 1 || 1;
			const chatId = Math.floor(performance.now()) + chatNr;
			this.game.socket.emit("game-chat", this.game.options.id, chatId, message);
			this.createMessage(game.me, message, false, chatId)
		}
		this.inputEl.value = "";
		this.inputLines = 1;
	}
	receive(gameId, playerInfo, message, systemMessage, chatId) {
		if (gameId != this.game.options.id)
			return;
		if (chatId)
			this.chats[chatId].removeAttribute("transit");
		else
			this.createMessage(playerInfo, message, systemMessage);
	}
	createMessage(playerInfo, message, systemMessage, chatId, restoring) {
		const el = document.createElement("chess-chat-message");
		if (systemMessage)
			el.setAttribute("system", "");
		if (playerInfo.side === 0)
			el.setAttribute("color", "black");
		else if (playerInfo.side === 1)
			el.setAttribute("color", "white");
		if (chatId) {
			el.setAttribute("transit", "");
			this.chats[chatId] = el;
		}
		const avatarEl = document.createElement("chess-chat-message-picture");
		const imgEl = document.createElement("img");
		if (playerInfo.avatar)
			imgEl.src = playerInfo.avatar;
		avatarEl.append(imgEl);
		el.append(avatarEl);
		const nameEl = document.createElement("chess-chat-message-name");
		nameEl.innerText = playerInfo.name;
		el.append(nameEl);
		const textEl = document.createElement("chess-chat-message-text");
		textEl.innerText = message;
		el.append(textEl);
		const stickToBottom = this.historyEl.scrollTop > this.historyEl.scrollHeight - this.historyEl.offsetHeight - 50;
		this.historyEl.append(el);

		if (systemMessage) {
			switch (message) {
				case "disconnected":
					this.game.players[playerInfo.side].el.setAttribute("disconnected", "");
					break;
				case "reconnected":
					this.game.players[playerInfo.side].el.removeAttribute("disconnected");
					break;
			}
		}

		this.checkScrollbar(stickToBottom);
		if (!restoring && this.online)
			this.game.options.messages.push({ playerInfo: playerInfo, message: message, system: systemMessage, chatId: chatId });
	}
	checkScrollbar(stickToBottom) {
		if (this.animationFrameRequested)
			return;
		this.animationFrameRequested = true;
		window.requestAnimationFrame(_ => {
			this.animationFrameRequested = false;
			if (stickToBottom)
				this.historyEl.scrollTop = this.historyEl.scrollHeight - this.historyEl.offsetHeight;
			if (this.historyEl.scrollHeight > this.historyEl.clientHeight)
				this.historyEl.setAttribute("scrollable", "");
			else
				this.historyEl.removeAttribute("sccrollable");
		});
	}
}

class ClientPlayer extends Player {
	constructor(game, side) {
		super(game, side);
		window.requestAnimationFrame(_ => {
			const nameWidthBefore = this.nameEl.clientWidth;
			this.nameEl.innerText = game.options.players[side].name;
			this.nameEl.style.setProperty("--font-scale", Math.max(0.5, nameWidthBefore / this.nameEl.clientWidth));
		});
		this.pastTimes = [];
		this.showHours = false;
		this.lastDelay = undefined;
	}
	init() {
		super.init()
		this.el = document.createElement("chess-sidebar-player");
		this.el.setAttribute("side", this.side ? "white" : "black");
		this.avatarEl = document.createElement("chess-sidebar-player-picture");
		const imgEl = document.createElement("img");
		if (this.game.options.players[this.side].avatar)
			imgEl.src = this.game.options.players[this.side].avatar;
		this.avatarEl.append(imgEl);
		this.el.append(this.avatarEl);
		this.nameEl = document.createElement("chess-sidebar-player-name");
		this.el.append(this.nameEl);
		const bottomEl = document.createElement("chess-sidebar-player-bottom");
		this.timeEl = document.createElement("chess-sidebar-player-time");
		bottomEl.append(this.timeEl);
		if (this.game.options.time.start[this.side] == -1)
			this.el.setAttribute("noTimeControls", "");
		if (this.game.localPlayer[this.side]) {
			const drawEl = document.createElement("chess-sidebar-player-draw");
			//if (!this.socket)
				drawEl.setAttribute("disabled", "");
			this.bindClickAction(drawEl, "draw");
			bottomEl.append(drawEl);
			const resignEl = document.createElement("chess-sidebar-player-resign");
			this.bindClickAction(resignEl, "resign");
			bottomEl.append(resignEl);
			this.selectedAction = undefined;
			this.el.onclick = e => this.deselectAction();
			let lastTimer;
			this.el.onmouseleave = e => lastTimer = setTimeout(_ => this.deselectAction(), 1000);
			this.el.onmouseenter = e => clearTimeout(lastTimer);
		}
		this.el.append(bottomEl);
		this.game.sideBarEl.append(this.el);
	}
	bindClickAction(buttonEl, action) {
		buttonEl.onclick = e => {
			if (!this.selectedAction) {
				this.selectedAction = buttonEl;
				this.el.setAttribute("action-selected", "");
				buttonEl.setAttribute("selected", "");
				e.stopPropagation();
			} else if (this.selectedAction == buttonEl) {
				if (this.game.socket)
					this.game.socket.emit("game-action", this.game.options.id, action, "user");
				else {
					if (action == "resign")
						this.game.end(1 - this.side, this.side, action);
				}
			}
		};
	}
	deselectAction() {
		if (!this.selectedAction)
			return;
		this.el.removeAttribute("action-selected");
		this.selectedAction.removeAttribute("selected");
		this.selectedAction = undefined;
	}
	updateTime(time, fromStop) {
		if (this.game.options.time.start[this.side] == -1)
			return;
		time = super.updateTime(time, fromStop);
		let seconds = Math.floor((time + 999) / 1000);
		const hours = Math.floor(seconds / 60 / 60);
		const minutes = Math.floor(seconds / 60 % 60);
		seconds = seconds % 60;
		let s = minutes + (seconds > 9 ? ":" : ":0") + seconds;
		if (this.showHours || hours > 0) {
			this.showHours = true;
			if (minutes < 10)
				s = "0" + s;
			s = ":" + s;
			if (hours > 0)
				s = hours + s;
			else
				s = "0" + s;
		}
		if (this.game.localPlayer[this.side]) {
			if (hours > 9)
				this.timeEl.style.setProperty("--font-scale", .102);
			else if (this.showHours)
				this.timeEl.style.setProperty("--font-scale", .12);
			else
				this.timeEl.style.removeProperty("--font-scale");
		}
		this.timeEl.innerText = s;
	}
	startTime(skipGraceAmount, skipAmount) {
		super.startTime(skipGraceAmount, skipAmount);
		if (!skipGraceAmount)
			skipGraceAmount = 0;
		if (this.game.options.time.grace > 0 || this.game.options.time.graceScale > 0) {
			this.timeEl.style.setProperty("--grace-start", skipGraceAmount / this.lastGrace);
			this.timeEl.style.setProperty("--grace-time", this.lastGrace - skipGraceAmount);
		}
		let instantRender = skipAmount > skipGraceAmount;
		const tick = _ => {
			const now = performance.now();
			if (!this.timeRunning)
				return;
			let time = this.turnStartTime - now + this.lastGrace;
			let millis;
			if (time <= 0) {
				time += this.game.timeRemaining[this.side];
				millis = time % 1000;
			} else {
				millis = time + (this.game.timeRemaining[this.side] % 1000);
				time += this.game.timeRemaining[this.side];
			}
			if (instantRender) {
				instantRender = false;
				this.updateTime(time);
			}
			this.lastDelay = setTimeout(_ => {
				this.updateTime(time - millis);
				tick();
			}, millis + 1);
		};
		tick();
		this.timeEl.setAttribute("active", "");
	}
	stopTime(fromFlag) {
		clearTimeout(this.lastDelay);
		clearInterval(this.lastDelay);
		if (this.game.options.time.start[this.side] == -1)
			return undefined;
		if (!this.timeRunning)
			return 0;
		const timeTaken = super.stopTime(fromFlag);
		this.pastTimes.push(timeTaken);
		this.timeEl.removeAttribute("active", "");
		return timeTaken;
	}
	startClock(skipGraceAmount, skipAmount) { }
	stopClock() { }
	flag(fromStop) {
		if (this.game.socket) // for online games, wait for server to tell us we flagged
			return;
		super.flag(fromStop);
	}
	setWinner() {
		this.el.setAttribute("winner", "");
	}
}

class ClientGame extends Game {
	constructor(root, options, socket, me) {
		super(options, socket);
		this.socket = socket;
		this.me = me;

		this.presentEl.style.setProperty("--t", this.present);

		this.panEl.onclick = e => {
			if ((this.dragging || this.lastMouseWasDrag) && (e.button != 2))
				return;
			if (this.selectedPiece && !this.promotionSelector)
				this.deselectPiece();
		};
		this.panEl.oncontextmenu = e => {
			e.preventDefault();
			this.panEl.onclick(e);
		};
		this.panEl.append(this.el);
		this.containerEl.append(this.panEl);
		root.append(this.containerEl);


		if (options.moves && options.moves.length && this.localPlayer[this.turn] && options.moves[options.moves.length - 1].length)
			this.undoButton.removeAttribute("disabled");

		// https://stackblitz.com/edit/multi-touch-trackpad-gesture?file=index.js
		this.gestureStartScale = 0;
		this.zoom = 1;
		this.slowZoom = 1;
		this.scrollX = 0;
		this.scrollY = 0;
		this.scrollYOffset = 0;
		this.manualScroll = false;
		this.resetOOB = true;
		this.OOBScrollX = 0;
		this.OOBScrollY = 0;
		this.scrollYFlip = 0;
		this.recentScrolls = 0;
		this.lastScrollEvent = undefined;
		this.animateZoom = false;
		this.lastAnimationEnd = 0;
		this.lastTouchDistance = undefined;
		this.slowZoomTimer = undefined;
		this.panEl.onwheel = e => {
			e.preventDefault();
			let deltaZ, zoomCenterX, zoomCenterY;
			let zooming = true;
			const scale = e.deltaMode != WheelEvent.DOM_DELTA_PIXEL ? e.deltaMode == WheelEvent.DOM_DELTA_PAGE ? 100 : 100/3 : 1;
			const deltaX = e.deltaX * scale;
			const deltaY = e.deltaY * scale;
			const containerCenterX = this.panEl.offsetLeft + this.panEl.offsetWidth / 2;
			const containerCenterY = this.panEl.offsetTop + this.panEl.offsetHeight / 2;
			if (shiftHeld || ctrlHeld) {
				// assume its a mouse scrolling, shift/ctrl + scroll = pan
				if (ctrlHeld)
					this.scrollY += deltaY;
				else
					this.scrollX += deltaY;
				zooming = false;
			}
			if (!e.ctrlKey) {
				clearTimeout(this.lastScrollEvent);
				this.lastScrollEvent = setTimeout(_ => this.recentScrolls = 0, 20);
				++this.recentScrolls;
				if (Math.abs(deltaY) < Math.min(120, 30 * this.recentScrolls)) {
					// touchpad panning
					this.scrollX += deltaX;
					this.scrollY += deltaY;
					zooming = false;
				} else {
					deltaZ = 5 * Math.sign(deltaY); // adjust for mouse wheel
					this.animateZoom = true;
					zoomCenterX = e.pageX;
					zoomCenterY = e.pageY;
				}
			} else {
				// touchpad zooming
				deltaZ = deltaY;
				zoomCenterX = containerCenterX;
				zoomCenterY = containerCenterY;
			}
			if (zooming) {
				const newZoom = Math.min(2 * 8 / 9, Math.max(.025, this.zoom * .96**(deltaZ)));
				this.scrollX += (containerCenterX - zoomCenterX - this.scrollX) * (1 - newZoom / this.zoom);
				this.scrollY += (containerCenterY - zoomCenterY - this.scrollY) * (1 - newZoom / this.zoom);
				this.zoom = newZoom;
			}
			this.lastAnimationEnd = 0;
			this.render();
		};
		this.dragging = false;
		let dragLocX, dragLocY;
		this.lastMouseWasDrag = false;
		this.lastMouseDownTime;
		this.panEl.onscroll = e => {
			if (this.manualScroll)
				return;
			this.scrollX = this.panEl.scrollLeft;
			this.scrollY = this.panEl.scrollTop;
			this.render();
		}
		this.panEl.onmousedown = e => {
			if (e.buttons & 1) {
				this.dragging = true;
				dragLocX = -e.pageX - this.scrollX;
				dragLocY = -e.pageY - this.scrollY;
				this.lastMouseWasDrag = false;
				this.lastMouseDownTime = performance.now();
			}
			if (e.buttons & 4)
				e.preventDefault();
		};
		window.addEventListener("mousemove", e => {
			if (!this.dragging)
				return;
			if (e.pageX < 0 || e.pageY < 0 || e.pageX >= window.innerWidth || e.pageY >= window.innerHeight) {
				e.stopPropagation();
				document.dispatchEvent(new MouseEvent("mouseleave"));
				return;
			}
			this.scrollX = -e.pageX - dragLocX;
			this.scrollY = -e.pageY - dragLocY;
			this.render();
		});
		let dragRelease = e => {
			if (!this.dragging)
				return;
			this.lastMouseWasDrag = performance.now() - this.lastMouseDownTime > 150;
			this.dragging = false;
		};
		window.addEventListener("mouseup", dragRelease);
		document.addEventListener("mouseleave", dragRelease);
		window.addEventListener("dragstart", e => {
			dragRelease(e);
			e.preventDefault();
			return false;
		});
		this.panEl.ontouchstart = e => {
			if (e.touches.length == 2)
				this.lastTouchDistance = Math.sqrt((e.touches[0].pageX - e.touches[1].pageX)**2 + (e.touches[0].pageY - e.touches[1].pageY)**2);
		};
		this.panEl.ontouchmove = e => {
			if (e.touches.length != 2)
				return;
			const touchDistance = Math.sqrt((e.touches[0].pageX - e.touches[1].pageX)**2 + (e.touches[0].pageY - e.touches[1].pageY)**2);
			const containerCenterX = this.panEl.offsetLeft + this.panEl.offsetWidth / 2;
			const containerCenterY = this.panEl.offsetTop + this.panEl.offsetHeight / 2;
			const zoomCenterX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
			const zoomCenterY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
			const newZoom = Math.min(2 * 8 / 9, Math.max(.025, this.zoom * touchDistance / this.lastTouchDistance));
			this.scrollX += (containerCenterX - zoomCenterX - this.scrollX) * (1 - newZoom / this.zoom);
			this.scrollY += (containerCenterY - zoomCenterY - this.scrollY) * (1 - newZoom / this.zoom);
			this.zoom = newZoom;
			this.lastTouchDistance = touchDistance;
			this.render();
		};
		window.addEventListener("resize", _ => {
			this.resetOOB = true;
			this.render();
		});

		this.lastAnimationEnd = 0;
		this.anchorBoard = undefined;
		this.lastAnchorBoardX = undefined;

		this.PanAnimationFrameRequested = false;
		this.animationFrameRequested = false;
		this.render();

		if (window.CSS.registerProperty) {
			try {
				window.CSS.registerProperty({
					name: '--grace-pos',
					syntax: '<length-percentage>',
					initialValue: '0%',
					inherits: true
				});
			} catch (_) {}
		}
		this.containerEl.append(this.sideBarEl);


		if (this.socket) {
			this.socket.on("game-time", (gameId, timeIndex, time) => {
				if (gameId != this.options.id)
					return;
				this.timeRemaining[this.options.player] += this.players[this.options.player].pastTimes[timeIndex] - time;
				this.players[this.options.player].updateTime(this.timeRemaining[this.options.player]);
			});
			this.socket.on("game-action", (gameId, action, newCurrentMoves, timeTaken) => {
				if (gameId != this.options.id)
					return;
				this.executeMove(action, newCurrentMoves, timeTaken, false)
			});
			this.socket.on("game-end", (gameId, winner, cause, reason) => {
				if (gameId != this.options.id)
					return;
				this.end(winner, cause, reason);
			})
		}

		this.worker = new Worker("/js/gameCheckmate.js?" + localStorage.version);
		this.worker.onmessage = hasWayOut => {
			if (!hasWayOut.data) {
				if (this.findChecks()) {
					if (this.socket)
						this.socket.emit("game-action", this.options.id, "checkmate", "user");
					else
						this.end(1 - this.turn, this.turn, "checkmate");
				} else {
					// todo: some checking, currently any player can report a stalemate and draw any game
					if (this.socket)
						this.socket.emit("game-action", this.options.id, "stalemate", "user");
					else
						this.end(-1, this.turn, "stalemate");
				}
			}
		};
		this.worker.postMessage(options);
	}
	instantiateMove(sourcePiece, targetPos, promotionTo, remoteMove, fastForward) {
		return new ClientMove(this, sourcePiece, targetPos, promotionTo, remoteMove, fastForward);
	}
	instantiateTimeline(l, t, sourceL, fastForward) {
		return new ClientTimeline(this, l, t, sourceL, fastForward);
	}
	instantiateBoard(l, t, turn, initialBoard, fastForward) {
		return new ClientBoard(this, l, t, turn, initialBoard, fastForward);
	}
	instantiatePlayer(side) {
		return new ClientPlayer(this, side);
	}
	instantiatePieceTypes() {
		this.Pieces = MakePieces(ClientPiece(Piece(ClientBasePiece)));
	}

	preInit() {
		super.preInit();

		this.socket = this.localPlayer;
		this.localPlayer = this.socket ? [this.options.player == 0, this.options.player == 1] : [true, true];
		this.containerEl = document.createElement("chess-game-container");
		this.panEl = document.createElement("chess-game-pan-container");
		this.controlsEl = document.createElement("chess-controls");
		this.timelinesEl = document.createElement("chess-game-timelines");
		this.el = document.createElement("chess-game");

		this.el.setAttribute("turn", this.turn ? "white" : "black");

		this.presentEl = document.createElement("chess-game-present");
		this.presentBlackMarker = document.createElement("chess-game-present-marker");
		this.presentBlackMarker.setAttribute("side", "black");
		this.presentEl.append(this.presentBlackMarker);
		this.presentWhiteMarker = document.createElement("chess-game-present-marker");
		this.presentWhiteMarker.setAttribute("side", "white");
		this.presentEl.append(this.presentWhiteMarker);
		this.el.append(this.presentEl);
		this.el.append(this.timelinesEl);

		this.undoButton = document.createElement("chess-button");
		this.undoButton.setAttribute("type", "undo");
		this.undoButton.setAttribute("disabled", "");
		this.undoButton.onclick = e => this.undo(e);
		this.controlsEl.append(this.undoButton);
		this.submitButton = document.createElement("chess-button");
		this.submitButton.setAttribute("type", "submit");
		this.submitButton.setAttribute("disabled", "");
		this.submitButton.onclick = e => this.submit();
		this.controlsEl.append(this.submitButton);
		this.containerEl.append(this.controlsEl);
		this.sideBarEl = document.createElement("chess-sidebar");

		this.containerEl.onmousedown = e => {
			window.lastInteractedGame = this;
		};
		window.addEventListener("keydown", e => {
			if (window.lastInteractedGame != this)
				return;
			if (e.code == "KeyF")
				this.submit();
		})

		this.flipped = !this.localPlayer[1];

		if (this.flipped)
			this.containerEl.setAttribute("flipped", "");
	}
	init() {
		super.init();
		this.chat = new Chat(this, !!this.socket);
	}

	end(winner, cause, reason, inPast) {
		super.end(winner, cause, reason, inPast);
		// todo: rethink this and how the socket interacts with this
		if (this.worker)
			this.worker.postMessage("stop");
		let message;
		const loserInfo = this.options.players[1 - winner];
		const causeInfo = this.options.players[cause];
		switch (reason) {
			case "resign":
				message = loserInfo.name + " resigned";
				break;
			case "draw":
				message = causeInfo.name + " accepted the draw";
				break;
			case "stalemate":
				message = "Game ended in a stalemate";
				break;
			case "checkmate":
				message = loserInfo.name + " was checkmated";
				break;
			case "timeout":
				message = loserInfo.name + " ran out of time";
				break;
			default:
				throw Error("unknown win reason");
		}
		if (!inPast)
			this.chat.createMessage(causeInfo, message, true);
		this.containerEl.setAttribute("finished", "")
		window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => window.alert("game end " + reason)));
	}

	executeMove(action, newCurrentMoves, timeTaken, fastForward) {
		let forcedUndo = false;
		for (let i = this.currentTurnMoves.length; i--> 0;) {
			const move = this.currentTurnMoves[i];
			if (move.nullMove && !move.remoteMove) {
				move.undo();
				this.currentTurnMoves.splice(i, 1);
				forcedUndo = true;
			}
		}
		const deletedMoves = super.executeMove(action, newCurrentMoves, timeTaken, fastForward);
		// console.log("game-action", action, newCurrentMoves);
		if (deletedMoves.length && !fastForward)
		playUndoSound();
		if (!fastForward) {
			if (forcedUndo && this.currentTurnMoves.every(m => m.remoteMove))
				this.undoButton.setAttribute("disabled", "");

			this.findChecks();
		}
	}

	render() {
		if (this.animationFrameRequested)
			return;
		const boardSize = Math.min(this.panEl.offsetHeight / 2, this.panEl.offsetWidth / 2) * 9/8 * this.zoom;
		let scrollXMin = boardSize * .5;
		let scrollXMax = scrollXMin + (this.boardsX - 1) * boardSize;
		let scrollYMin = boardSize * .5;
		let scrollYMax = scrollYMin + (this.boardsY - 1) * boardSize;
		if (this.scrollYFlip) {
			const center = 2 * (.5 + this.timelineCount[this.flipped ? 1 : 0]) * boardSize
			this.scrollY = center - this.scrollY;
			this.OOBScrollY = center - this.OOBScrollY;
			this.scrollYFlip = 0;
		}
		if (this.resetOOB)
			this.resetOOB = false;
		else {
			this.OOBScrollX *= this.zoom;
			this.OOBScrollY *= this.zoom;
			scrollXMax = Math.max(scrollXMax, this.OOBScrollX);
			scrollXMin = Math.min(scrollXMin, this.OOBScrollX);
			scrollYMax = Math.max(scrollYMax, this.OOBScrollY);
			scrollYMin = Math.min(scrollYMin, this.OOBScrollY);
		}
		this.scrollX = Math.min(scrollXMax, Math.max(scrollXMin, this.scrollX));
		this.scrollY = Math.min(scrollYMax, Math.max(scrollYMin, this.scrollY + this.scrollYOffset * boardSize));
		this.scrollYOffset = 0;
		this.OOBScrollX = this.scrollX / this.zoom;
		this.OOBScrollY = this.scrollY / this.zoom;
		//translate(${this.scrollX}px,${this.scrollY}px)
		this.el.style.setProperty("--zoom", this.zoom / this.slowZoom);
		this.manualScroll = true;
		this.panEl.scrollTo(this.scrollX, this.scrollY);
		this.animationFrameRequested = true;
		window.requestAnimationFrame(_ => {
			this.manualScroll = false;
			this.animationFrameRequested = false;
			// if (navigator.userAgent.indexOf("Chrome") > -1) {
			// 	clearTimeout(this.slowZoomTimer);
			// 	this.slowZoomTimer = setTimeout(_ => {
			// 		this.el.style.setProperty("--zoom", 1);
			// 		this.el.style.setProperty("--slowzoom", this.zoom);
			// 		this.slowZoom = this.zoom;
			// 	}, 200);
			// }
		});
	}
	startPanAnimation(board) {
		this.lastAnimationEnd = performance.now() + 500;
		this.anchorBoard = board;
		this.lastAnchorBoardX = board.el.offsetLeft * this.zoom - this.scrollX;
		this.panAnimation();
	}
	panAnimation() {
		if (this.PanAnimationFrameRequested)
			return;
		this.PanAnimationFrameRequested = true;
		this.scrollX = (this.anchorBoard.el.offsetLeft * this.zoom - this.lastAnchorBoardX);
		this.render();
		window.requestAnimationFrame(_ => {
			this.PanAnimationFrameRequested = false;
			if (performance.now() < this.lastAnimationEnd)
				this.panAnimation();
		});
	}

	updateDimensions() {
		let maxT = 0;
		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection)
				if (timeline.end > maxT)
					maxT = timeline.end;
		this.boardsXStart = this.getTimeline(0).start;
		this.boardsX = maxT - this.boardsXStart + 1;
		this.boardsY = this.timelineCount[0] + this.timelineCount[1] + 1;
		this.scrollYOffset += this.timelineCount[this.flipped ? 1 : 0] - this.lastTimelineCount[this.flipped ? 1 : 0];
		this.lastTimelineCount[0] = this.timelineCount[0];
		this.lastTimelineCount[1] = this.timelineCount[1];
		this.panEl.style.setProperty("--horizontal-boards", this.boardsX);
		this.panEl.style.setProperty("--boards-black", this.timelineCount[0]);
		this.panEl.style.setProperty("--boards-white", this.timelineCount[1]);
		this.panEl.style.setProperty("--vertical-boards", this.boardsY);
	}

	flip() {
		this.flipped = !this.flipped;
		this.scrollYFlip = 1;
		if (this.flipped)
			this.containerEl.setAttribute("flipped", "");
		else
			this.containerEl.removeAttribute("flipped");
		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection)
				for (let board of timeline.boards)
					for (let arrow of board.arrows)
						arrow.update();
		this.render();
	}

	destroy() {
		// TODO: unbind socket
		super.destroy();
		if (this.worker)
			this.worker.terminate();
		this.containerEl.remove();
	}

	undo() {
		super.undo();
		if (this.currentTurnMoves.length == 0)
			this.undoButton.setAttribute("disabled", "");

		if (this.localPlayer[this.turn])
			this.send("undo", this.currentTurnMoves);
		playUndoSound();
	}
	checkSubmitAvailable() {
		super.checkSubmitAvailable();
		if (this.canSubmit)
			this.submitButton.removeAttribute("disabled");
		else
			this.submitButton.setAttribute("disabled", "");
	}
	submit(remote, fastForward, skipTime) {
		const prevTurnMoves = this.currentTurnMoves;
		const { submitted, elapsedTime } = super.submit(remote, fastForward, skipTime);
		if (!submitted)
			return;
		if (!fastForward) {
			this.undoButton.setAttribute("disabled", "");
			this.submitButton.setAttribute("disabled", "");
			this.el.setAttribute("turn", this.turn ? "white" : "black");
			if (!remote)
				this.send("submit", prevTurnMoves, elapsedTime);
			if (this.worker)
				this.worker.postMessage(prevTurnMoves.map(m => m.serialize()));
		}
		for (let move of prevTurnMoves)
			for (let board of move.createdBoards)
				board.el.removeAttribute("unsubmitted");
	}
	movePresent(fastForward) {
		super.movePresent(fastForward);
		const setAttrs = _ => {
			this.presentWhiteMarker.setAttribute("available", this.timelineCount[0] >= this.timelineCount[1]);
			this.presentBlackMarker.setAttribute("available", this.timelineCount[0] <= this.timelineCount[1]);
			this.presentEl.setAttribute("turn", this.present % 2 == 0 ? "white" : "black");
			this.presentEl.style.setProperty("--t", this.present);
		};
		if (fastForward)
			setAttrs();
		else
			window.requestAnimationFrame(_ => setAttrs());
	}

	selectPiece(piece) {
		this.selectedPiece = piece;
		this.el.setAttribute("piece-selected", "");
		if (this.localPlayer[this.turn])
			piece.el.setAttribute("selected", "");
		this.ghostPiece = new GhostPiece(piece);
	}
	deselectPiece() {
		this.selectedPiece.el.removeAttribute("selected");
		this.el.removeAttribute("piece-selected");
		this.selectedPiece = undefined;
		this.removeHighlights();
	}
	removeHighlights() {
		if(this.selectedPiece || this.promotionSelector)
			return;
		this.hoveredPiece = undefined;
		if (this.ghostPiece) {
			this.ghostPiece.remove();
			this.ghostPiece = undefined;
		}

		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection)
				for (let board of timeline.boards) {
					board.hoverHighlightEl.innerHTML = "";
					for (let marker of board.markers)
						marker.el.style.removeProperty("display");
				}
	}

	removeGhostPiece() {
		if (this.dragging || this.lastMouseWasDrag)
			return;
		if (this.ghostPiece)
			this.ghostPiece.detach();
	}

	move(target, promotionTo) {
		if (!this.selectedPiece)
			return;
		if (this.selectedPiece.pos().equals(target.pos()))
			return;
		if (super.move(target, promotionTo) && this.localPlayer[this.turn]) {
			this.undoButton.removeAttribute("disabled");
			this.send("move", this.currentTurnMoves);
		}
		this.removeHighlights();
	}

	send(action, moves, arg) {
		if (!this.socket || this.finished)
			return;
		this.socket.emit("game-action", this.options.id, action, moves.map(m => m.serialize()), arg);
	}

	updateImmediateChecks(boards) {
		for (let board of boards)
			board.updateImmediateChecks();
		this.updateImmediateChecksAfter();
	}
	updateImmediateChecksAfter() {
		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection) {
				const board = timeline.boards[timeline.boards.length - 1];
				if (board.turn != this.turn)
					board.updateImmediateChecksAfter();
			}
	}
}