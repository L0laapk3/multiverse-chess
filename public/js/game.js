"use strict";


class Vec4 {
	// Note that the y coordinate increases horizontally (with the file)
	// x coordinate increases with decreasing rank
	// (white pieces begin at x coordinates 6 and 7, black pieces at 0 and 1)
	// White Queen starts at (x=7,y=3), white King at (x=7,y=4)
	// t coordinates increase by 1 each half turn
	constructor(x, y, l, t) {
		if (x.x !== undefined) {
			y = x.y;
			l = x.l;
			t = x.t;
			x = x.x;
		}
		this.x = x;
		this.y = y;
		this.l = l;
		this.t = t;
	}
	add(v) {
		return new Vec4(this.x + v.x, this.y + v.y, this.l + v.l, this.t + v.t);
	}
	sub(v) {
		return new Vec4(this.x - v.x, this.y - v.y, this.l - v.l, this.t - v.t);
	}
	equals(v) {
		return v && this.x == v.x && this.y == v.y && this.l == v.l && this.t == v.t;
	}
}


class Player {
	constructor(game, side) {
		this.game = game;
		this.side = side;
		this.lastStartTime = undefined;
		this.lastTurnTime = 0;
		this.timeRunning = false;
		this.lastGrace = (this.game.options.time.grace || 0) + (this.game.options.time.graceScale || 0);
		this.lastIncr = (this.game.options.time.incr || 0) + (this.game.options.time.incrScale || 0);
		this.init();
		this.updateTime(this.game.options.time.start[this.side]);
	}
	init() { };
	updateTime(time, fromStop) {
		if (this.game.options.time.start[this.side] == -1)
			return;
		if (time < 0)
			time = 0;
		if (!fromStop && time == 0)
			this.stopTime();
		return time;
	}
	startTime(skipGraceAmount, skipAmount) {
		this.turnStartTime = performance.now();
		if (skipAmount)
			this.turnStartTime -= skipAmount;
		if (this.game.options.time.start[this.side] == -1)
			return;
		this.timeRunning = true;

		this.lastGrace = this.game.options.time.grace || 0;
		this.lastIncr = this.game.options.time.incr || 0;
		for (let l = -Math.min(this.game.timelineCount[0], this.game.timelineCount[1] + 1); l <= Math.min(this.game.timelineCount[0] + 1, this.game.timelineCount[1]); l++)
			if (this.game.getTimeline(l).end == this.game.present) {
				this.lastGrace += this.game.options.time.graceScale || 0;
				this.lastIncr += this.game.options.time.incrScale || 0;
			}
		this.startClock(skipGraceAmount, skipAmount);
	}
	stopTime(fromFlag) {
		this.stopClock();
		let timeTaken = Math.max(Math.round(performance.now() - this.turnStartTime) - this.lastGrace, 0);
		if (this.game.options.time.start[this.side] == -1)
			return undefined;
		if (!this.timeRunning)
			return 0;
		this.timeRunning = false;
		if (!fromFlag) {
			if (this.game.timeRemaining[this.side] <= timeTaken) {
				this.flag(true);
				timeTaken = this.game.timeRemaining[this.side];
			} else
				timeTaken -= this.lastIncr;
		} else
			timeTaken = this.game.timeRemaining[this.side];
		this.lastTurnTime = timeTaken;
		this.game.timeRemaining[this.side] -= timeTaken;
		this.updateTime(this.game.timeRemaining[this.side], true);
		return timeTaken;
	}
	startClock(skipGraceAmount, skipAmount) {
		this.alarm = setTimeout(_ => this.flag(), this.game.timeRemaining[this.side] + this.lastGrace);
	}
	stopClock() {
		clearTimeout(this.alarm);
	}
	flag(fromStop) {
		if (!fromStop)
			this.stopTime(true);
		this.game.end(1 - this.side, this.side, "timeout");
	}
	setWinner() { }
}


class Board {
	constructor(game, l, t, turn, initialBoard, fastForward) {
		this.init();
		this.deleted = false;
		this.game = game;
		let prevBoard;
		if (l instanceof Board) {
			prevBoard = l;
			const isBranch = t;
			if (isBranch)
				l = turn;
			else
				l = l.l;
			t = prevBoard.t + 1;
			turn = 1 - prevBoard.turn;
			this.castleAvailable = prevBoard.castleAvailable;
		} else {
			this.castleAvailable = 15;
		}
		this.imminentCheck = false;
		this.l = l;
		this.t = t;
		this.turn = turn;
		this.enPassantPawn = undefined;

		if (prevBoard) {
			this.pieces = new Array(prevBoard.pieces.length);
			for (let x = 0; x < this.pieces.length; x++) {
				this.pieces[x] = new Array(prevBoard.pieces[x].length);

				for (let y = 0; y < prevBoard.pieces[x].length; y++) {
					const piece = prevBoard.pieces[x][y];
					if (piece)
						piece.cloneToBoard(this);
				}
			}
		} else {
			this.pieces = new Array(8);
			for (let i = 0; i < 8; i++)
				this.pieces[i] = new Array(8);

			// initialize new board
			for (let side = 0; side < 2; side++) {
				for (let y = 0; y < 8; y++)
					new game.Pieces.Pawn(this, side, side ? 6 : 1, y);
				const x = side ? 7 : 0;
				new game.Pieces.Rook(this, side, x, 0);
				new game.Pieces.Knight(this, side, x, 1);
				new game.Pieces.Bishop(this, side, x, 2);
				new game.Pieces.Queen(this, side, x, 3);
				new game.Pieces.King(this, side, x, 4);
				new game.Pieces.Bishop(this, side, x, 5);
				new game.Pieces.Knight(this, side, x, 6);
				new game.Pieces.Rook(this, side, x, 7);
			}
		}

		this.active = true;
		this.timeline = this.game.getTimeline(l);
		if (this.timeline.getBoard(t))
			throw new Error("time-line slot already occupied when creating new board.");
		this.timeline.setBoard(t, this);
	}
	init() { }

	hasImminentChecks() {
		this.imminentCheck = false;
		if (this.t == this.game.present)
			checkLoop:
			for (let timelineDirection of this.game.timelines)
				for (let timeline of timelineDirection) {
					const board = timeline.boards[timeline.boards.length - 1];
					if (board.turn != this.turn || board == this)
						for (let row of board.pieces)
							for (let piece of row)
								if (piece && piece.side != this.turn) {
									nextCheckLoop:
									for (let enemyTakePos of piece.enumerateMoves(this.l)) {
										const takePiece = this.game.getPiece(enemyTakePos, this.l);
										if (takePiece && takePiece.side == this.turn && takePiece.type == "King") {
											for (let existingCheck of this.game.displayedChecks)
												if (existingCheck[0].equals(piece.pos()) && existingCheck[1].equals(takePiece.pos()))
													continue nextCheckLoop;
											this.imminentCheck = true;
											break checkLoop;
										}
									}
								}
					}
		return this.imminentCheck;
	}

	makeInactive() {
		this.active = false;
	}
	makeActive() {
		this.active = true;
	}

	remove() {
		this.deleted = true;
		//assumes it is the last board on the timeline
		const timelineAnimationEndCb = this.timeline.pop();
		if (this.timeline.boards.length == 0)
			this.timeline.remove();
		return timelineAnimationEndCb;
	}
}



class Timeline {
	constructor(game, l, t, sourceL, fastForward) {
		this.game = game;
		this.l = l;
		this.start = t;
		this.end = t - 1;
		this.side = this.l >= 0 ? 1 : 0;
		this.game.timelines[this.side].push(this);
		const counterTimeline = this.game.getTimeline(-this.l + (this.side ? -1 : 1));
		if (counterTimeline)
			counterTimeline.activate();
		if (!fastForward)
			game.movePresent(fastForward);
		this.boards = [];
	}
	getBoard(t) {
		return this.boards[t - this.start];
	}
	setBoard(t, board) {
		this.boards[t - this.start] = board;
		if (t > this.end)
			this.end = t;
	}
	pop() {
		const oldBoard = this.boards.pop();
		this.end--;
		return oldBoard;
	}
	remove() {
		this.game.timelines[this.side].pop();
		--this.game.timelineCount[this.side];
		const counterTimeline = this.game.getTimeline(-this.l + (this.side ? -1 : 1));
		if (counterTimeline)
			counterTimeline.deactivate();
	}
	activate() { }
	deactivate() { }
	isSubmitReady() {
		return this.end >= this.game.present;
	}
}

class Move {
	constructor(game, sourcePiece, targetPos, promotionTo, remoteMove, fastForward) {
		this.sourceBoard = undefined;
		this.targetBoard = undefined;
		this.isInterDimensionalMove = false;
		this.game = game;
		this.nullMove = false;
		this.remoteMove = remoteMove;
		this.promote = promotionTo;
		this.from = undefined;
		this.to = undefined;
		this.l = undefined;

		if (sourcePiece instanceof Board) {
			// null move
			this.usedBoards = [sourcePiece];
			this.sourceBoard = game.instantiateBoard(sourcePiece, undefined, undefined, undefined, fastForward);
			this.createdBoards = [this.sourceBoard];
			this.nullMove = true;
			this.l = sourcePiece.l;
		} else {
			this.isInterDimensionalMove = true;
			this.from = sourcePiece.pos();
			this.to = targetPos;
			const targetOriginBoard = game.getTimeline(targetPos.l).getBoard(targetPos.t);
			this.usedBoards = [sourcePiece.board];
			if (!targetOriginBoard.active) {
				console.log("create new timeline");
				this.sourceBoard = game.instantiateBoard(sourcePiece.board, undefined, undefined, undefined, fastForward);
				const newL = ++game.timelineCount[targetOriginBoard.turn] * (targetOriginBoard.turn ? 1 : -1);
				game.instantiateTimeline(newL, targetOriginBoard.t + 1, this.sourceBoard.l, fastForward);
				this.targetBoard = game.instantiateBoard(targetOriginBoard, true, newL);
			} else if (sourcePiece.board != targetOriginBoard) {
				console.log("move across timelines");
				this.sourceBoard = game.instantiateBoard(sourcePiece.board, undefined, undefined, undefined, fastForward);
				this.targetBoard = game.instantiateBoard(targetOriginBoard, undefined, undefined, undefined, fastForward);
				this.usedBoards.push(targetOriginBoard);
			} else {
				console.log("move on a single board");
				this.sourceBoard = this.targetBoard = game.instantiateBoard(targetOriginBoard, undefined, undefined, undefined, fastForward);
				this.isInterDimensionalMove = false;
			}
			this.createdBoards = [this.sourceBoard];
			if (this.isInterDimensionalMove)
				this.createdBoards.push(this.targetBoard);

			const takePiece = this.targetBoard.pieces[targetPos.x][targetPos.y];
			if (takePiece)
				takePiece.remove();
			if (promotionTo) {
				const oldPiece = this.sourceBoard.pieces[sourcePiece.x][sourcePiece.y];
				const promotionPiece = [game.Pieces.Queen, game.Pieces.Knight, game.Pieces.Rook, game.Pieces.Bishop][promotionTo - 1];
				new (promotionPiece)(this.targetBoard, oldPiece.side, targetPos.x, targetPos.y);
				oldPiece.remove();
			} else
				this.sourceBoard.pieces[sourcePiece.x][sourcePiece.y].changePosition(this.targetBoard, targetPos.x, targetPos.y, sourcePiece.board, sourcePiece);
		}
		for (let board of this.usedBoards)
			board.makeInactive();
	}
	undo() {
		for (let i = 0; i < this.createdBoards.length; i++)
			this.createdBoards[i].remove(i < this.usedBoards.length ? this.usedBoards[i].makeActive() : _ => {});
	}
	serialize() {
		return this.nullMove ? { l: this.l } : {
			from: this.from,
			to: this.to,
			promote: this.promote,
		};
	}
}


class Game {
	constructor(options, localPlayer) {
		this.instantiatePieceTypes();
		this.options = options;
		this.timeRemaining = [ this.options.time.start[0], this.options.time.start[1] ];
		this.displayedChecks = [];
		this.highlights = [];
		this.hoveredPiece = undefined;
		this.selectedPiece = undefined;
		this.ghostPiece = undefined;

		this.turn = 1;
		this.localPlayer = localPlayer;
		this.currentTurnMoves = [];
		this.canSubmit = false;

		this.preInit();
		this.players = [this.instantiatePlayer(0), this.instantiatePlayer(1)];
		this.init();

		if (options.finished)
			this.end(options.winner, options.winCause, options.winReason, true);
		else
			this.finished = false;

		this.present = 2;
		this.timelines = [ [], [] ];
		this.timelineCount = [0, 0];
		this.lastTimelineCount = [0, 0];
		this.instantiateTimeline(0, 1, undefined, true); // timeline starts at board 1

		// hack to add turn zero variant
		this.getTimeline(0).setBoard(1, this.instantiateBoard(0, 1, !this.turn, true));
		this.getTimeline(0).setBoard(2, this.instantiateBoard(0, 2, this.turn, true)); // even moves must be for white and t cannot be negative so start at 1

		this.arrowCount = 0;

		if (options.moves) {
			for (let i = 0; i < options.moves.length - 1; i++) {
				this.executeMove("submit", options.moves[i], 0, true);
			}
			if (options.moves.length) {
				this.executeMove("move", options.moves[options.moves.length - 1], 0, false);
				// TODO: fix clocks
				this.checkSubmitAvailable();
			}
		}
		this.findChecks();

		if (options.runningClocks)
			this.players[this.turn].startTime(options.runningClockGraceTime, options.runningClockTime);
	}
	instantiateMove(sourcePiece, targetPos, promotionTo, remoteMove, fastForward) {
		return new Move(this, sourcePiece, targetPos, promotionTo, remoteMove, fastForward);
	}
	instantiateTimeline(l, t, sourceL, fastForward) {
		return new Timeline(this, l, t, sourceL, fastForward);
	}
	instantiateBoard(l, t, turn, initialBoard, fastForward) {
		return new Board(this, l, t, turn, initialBoard, fastForward);
	}
	instantiatePlayer(side) {
		return new Player(this, side);
	}
	instantiatePieceTypes() {
		this.Pieces = MakePieces(Piece(BasePiece));
	}

	preInit() { }
	init() { }

	end(winner, cause, reason, inPast) {
		this.players[0].stopTime();
		this.players[1].stopTime();
		this.finished = true;
		if (winner >= 0)
			this.players[winner].setWinner();
		this.checkSubmitAvailable();
	}

	executeMove(action, newCurrentMoves, timeTaken, fastForward) {
		// console.log("game-action", action, newCurrentMoves);

		newCurrentMoves = newCurrentMoves.map(m => (m.l !== undefined ? m : { from: new Vec4(m.from), to: new Vec4(m.to), promote: m.promote }));
		const existingMoves = new Array(newCurrentMoves.length).fill(false);
		const deletedMoves = [];
		nextExistingMove:
		for (let j = 0; j < this.currentTurnMoves.length; j++) {
			const move = this.currentTurnMoves[j];
			for (let i = 0; i < newCurrentMoves.length; i++) {
				const newMove = newCurrentMoves[i];
				if (move.l === undefined ? move.from.equals(newMove.from) && move.to.equals(newMove.to) : move.l === newMove.l) {
					existingMoves[i] = move;
					continue nextExistingMove;
				}
			}
			deletedMoves.push(move);
		}
		for (let i = 0; i < newCurrentMoves.length; i++) {
			if (!existingMoves[i]) {
				const move = newCurrentMoves[i];
				if (move.from) {
					const sourcePiece = this.getPiece(move.from);
					existingMoves[i] = this.instantiateMove(sourcePiece, move.to, move.promote, true, fastForward);
				} else {
					const timeline = this.getTimeline(move.l);
					existingMoves[i] = this.instantiateMove(timeline.boards[timeline.boards.length - 1], undefined, undefined, true, fastForward);
				}
				this.applyMove(existingMoves[i], fastForward);
			}
		}
		for (let move of deletedMoves)
			move.undo();
		this.movePresent(fastForward);

		this.currentTurnMoves = existingMoves;

		if (action == "submit") {
			const player = this.turn;
			this.submit(true, fastForward, fastForward);
			if (!fastForward) {
				this.timeRemaining[player] += this.players[player].lastTurnTime - timeTaken;
				this.players[player].updateTime(this.timeRemaining[player]);
			}
		}

		return deletedMoves;
	}

	destroy() {
		this.players[0].stopTime();
		this.players[1].stopTime();
	}
	undo() {
		if (this.currentTurnMoves.length == 0)
			return;
		let lastMove;
		if (this.localPlayer[this.turn])
			lastMove = this.currentTurnMoves.pop();
		else {
			for (let i = this.currentTurnMoves.length; i--> 0;) {
				const move = this.currentTurnMoves[i];
				if (move.nullMove && !move.remoteMove)
					lastMove = this.currentTurnMoves.splice(i, 1)[0];
					break;
			}
			if (!lastMove)
				return;
		}
		lastMove.undo();
		if (this.currentTurnMoves.length == 0)
			this.movePresent();

		this.findChecks();
		this.checkSubmitAvailable();
	}

	checkSubmitAvailable() {
		if (!this.localPlayer[this.turn] || this.finished)
			return this.canSubmit = false;
		this.canSubmit = this.present % 2 == this.turn;
		if (this.canSubmit)
			for (let l = -Math.min(this.timelineCount[0], this.timelineCount[1] + 1); l <= Math.min(this.timelineCount[0] + 1, this.timelineCount[1]); l++) {
				if (!this.getTimeline(l).isSubmitReady()) {
					this.canSubmit = false;
					break;
				}
			}
		return this.canSubmit;
	}
	submit(remote, fastForward, skipTime) {
		let elapsedTime, timeGainedCap;
		if (!fastForward) {
			if (this.finished)
				return { submitted: false };
			if ((!this.canSubmit || this.loading) && !remote)
				return { submitted: false };
		}
		if (!skipTime) {
			elapsedTime = this.players[this.turn].stopTime();
			timeGainedCap = this.players[this.turn].lastIncr;
		}
		this.currentTurnMoves = [];
		this.movePresent(fastForward);
		this.turn = 1 - this.turn;
		if (!fastForward)
			this.findChecks();
		if (!skipTime && this.getTimeline(0).end > 1)
			this.players[this.turn].startTime();
		this.canSubmit = false;
		return { submitted: true, elapsedTime: elapsedTime, timeGainedCap: timeGainedCap };
	}
	movePresent(fastForward) {
		this.present = Infinity;
		for (let l = -Math.min(this.timelineCount[0], this.timelineCount[1] + 1); l <= Math.min(this.timelineCount[0] + 1, this.timelineCount[1]); l++) {
			const timeline = this.getTimeline(l);
			const t = Math.max(timeline.end, timeline.start);
			if (t < this.present)
				this.present = t;
		}
	}

	getTimeline(l) {
		if (l >= 0)
			return this.timelines[1][l];
		else
			return this.timelines[0][-1 - l];
	}
	findChecks() {
		let checks = false;
		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection) {
				const board = timeline.boards[timeline.boards.length - 1];
				if (board.turn == this.turn)
					checks |= board.hasImminentChecks();
			}
		return checks;
	}

	checkChecks(checkGroups, checkBoard) {
		if (!checkGroups.length)
			return [];

		let results = new Array(checkGroups.length).fill(false);
		for (let timelineDirection of this.timelines)
			for (let timeline of timelineDirection) {
				const board = timeline.boards[timeline.boards.length - 1];
				if (board.turn != checkBoard.turn || board == checkBoard)
					for (let row of board.pieces)
						for (let piece of row)
							if (piece && piece.side != checkBoard.turn)
								for (let enemyTakePos of piece.enumerateMoves(checkBoard.l)) {
									for (let groupI = checkGroups.length; groupI--> 0;) {
										const checkGroup = checkGroups[groupI];
										for (let checkPos of checkGroup) {
											if (checkPos.equals(enemyTakePos)) {
												results[groupI] = true;
												checkGroups.splice(groupI, 1);
												if (!checkGroup.length)
													return results;
											}
										}
									}
								}
			}
		return results;
	}

	applyMove(move, fastForward) {
		this.currentTurnMoves.push(move);
		this.movePresent(fastForward);
		if (!fastForward)
			this.findChecks();
	}

	move(target, promotionTo) {
		if (target.board.turn != this.selectedPiece.side)
			throw Error("tried to make move to opponent side..");
		if ((this.selectedPiece.side == this.turn && this.localPlayer[this.turn])) {
			this.applyMove(this.instantiateMove(this.selectedPiece, target.pos(), promotionTo, false));
			this.checkSubmitAvailable();
			return true;
		}
		return false;
	}

	getPiece(pos, incrBoardNum) {
		if (pos.x < 0 || pos.x >= 8 || pos.y < 0 || pos.y >= 8 || pos.t < 0)
			return false;
		const timeline = this.getTimeline(pos.l);
		if (!timeline)
			return false;
		let board = timeline.getBoard(timeline.l === incrBoardNum && timeline.end < pos.t ? pos.t - 1 : pos.t);
		if (!board)
			return false;
		return board.pieces[pos.x][pos.y];
	}
}