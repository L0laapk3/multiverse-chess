"use strict";

class BasePiece {
	constructor(game, board, side, x, y) {
		if (side instanceof BasePiece) {
			x = side.x;
			y = side.y;
			side = side.side;
		}
		this.side = side;
		this.x = x;
		this.y = y;
		this.board = board;
		this.game = game;
	}
	initType(type) {
		this.type = type;
	}
	changePosition(x, y) {
		this.x = x;
		this.y = y;
	}
	pos(incrL) {
		return new Vec4(this.x, this.y, this.board.l, incrL ? this.board.t + 1 : this.board.t);
	}
}

const Piece = BasePiece => class extends BasePiece {
	constructor(board, side, x, y) {
		super(board.game, board, side, x, y);
		if (this.board.pieces[this.x][this.y])
			throw new Error("square occupied");
		this.initType(this.constructor.name);
		this.board.pieces[this.x][this.y] = this;
	}
	remove() {
		this.board.pieces[this.x][this.y] = undefined;
	}
	cloneToBoard(board) {
		return new this.constructor(board, this);
	}
	changePosition(targetBoard, x, y, sourceBoard, sourcePiece) {
		this.board.pieces[this.x][this.y] = undefined;
		super.changePosition(x, y);
		if (targetBoard != this.board)
			this.board = targetBoard;
		targetBoard.pieces[x][y] = this;
	}
	isViableMove(pos, incrBoardNum) {
		const piece = this.game.getPiece(pos, incrBoardNum);
		if (piece === false)
			return 0;
			
		if (piece)
			return piece.side == this.side ? 0 : 2;
		return 1;
	}
	static maxMoveSteps() { return -1 };
    static *enumerateDirections() {
		throw new Error("abstract method.");
    }
    *enumerateMoves(incrBoardNum) {
		for (let dir of this.constructor.enumerateDirections()) {
			let newPos = this.pos(incrBoardNum === this.board.l);
			for (let i = 0; i != this.constructor.maxMoveSteps(); i++) {
				newPos = newPos.add(dir);
				const isViable = this.isViableMove(newPos, incrBoardNum);
				if (isViable)
					yield newPos;
				if (isViable != 1)
					break;
			}
		}
	}
}

function MakePieces(MPiece) {
class Pawn extends MPiece {
	constructor(board, side, x, y) {
		super(board, side, x, y);
		if (side.type == "Pawn")
			this.hasMoved = side.hasMoved;
		else
			this.hasMoved = false;
	}
	*enumerateMoves(incrBoardNum) {
		if (incrBoardNum === undefined) {
			const noTakeGroup = [
				new Vec4(this.side ? -1 : 1, 0, 0, 0),
				new Vec4(0, 0, this.side ? -1 : 1, 0),
			];
			const maxSteps = this.hasMoved ? 1 : 2;
			for (let dir of noTakeGroup) {
				let newPos = this.pos(incrBoardNum === this.board.l);
				for (let i = 0; i < maxSteps; i++) {
					newPos = newPos.add(dir);
					if (this.isViableMove(newPos, incrBoardNum) == 1) {
						yield newPos;
					} else
						break;
				}
			}
		}
		const takeGroup = [
			new Vec4(this.side ? -1 : 1, -1, 0, 0),
			new Vec4(this.side ? -1 : 1, 1, 0, 0),
			new Vec4(0, 0, this.side ? -1 : 1, -1),
			new Vec4(0, 0, this.side ? -1 : 1, 1),
		];
		for (let dir of takeGroup) {
			const newPos = this.pos(incrBoardNum === this.board.l).add(dir);
			const isViable = this.isViableMove(newPos, incrBoardNum);
			if (isViable == 2)
				yield newPos;
		}
		if (this.board.enPassantPawn && this.side == this.board.enPassantPawn.side)
			return;
		if (this.board.enPassantPawn && (this.board.enPassantPawn.board.l != this.board.l || this.board.enPassantPawn.board.t != this.board.t))
			throw new Error("en passant pawn is not on the same board");
		if (this.board.enPassantPawn && this.board.enPassantPawn.x == this.x && Math.abs(this.board.enPassantPawn.y - this.y) == 1) {
			const target = new Vec4(this.x + (this.side ? -1 : 1), this.board.enPassantPawn.y, this.board.l, this.board.t);
			//console.log("en passant available", target);
			yield target;
		}
		// TODO: time dimension en passant?
	}
	changePosition(targetBoard, x, y, sourceBoard, sourcePawn) {
		super.changePosition(targetBoard, x, y, sourceBoard, sourcePawn);
		this.hasMoved = true;
		if (Math.abs(x - sourcePawn.x) == 2 || Math.abs(targetBoard.l - sourcePawn.board.l) == 2) {
			targetBoard.enPassantPawn = this;
		}

		if (sourceBoard.enPassantPawn && sourcePawn.x == sourceBoard.enPassantPawn.x && y == sourceBoard.enPassantPawn.y)
			targetBoard.pieces[sourceBoard.enPassantPawn.x][sourceBoard.enPassantPawn.y].remove();
	}
}
class King extends MPiece {
	static maxMoveSteps() { return 1 };
	static *enumerateDirections() {
		yield* Queen.enumerateDirections();
	}
	changePosition(targetBoard, x, y, sourceBoard, sourceKing) {
		const yDiff = y - this.y;
		super.changePosition(targetBoard, x, y, sourceBoard, sourceKing);
		const bit = 3 << (2 * this.side);
		this.board.castleAvailable &= ~bit;

		if (Math.abs(yDiff) == 2) {
			let rookY = this.y;
			let rook;
			do {
				rookY += Math.sign(yDiff);
				rook = this.board.pieces[this.x][rookY];
			} while (!rook);
			if (!(rook.type == "Rook"))
				throw new Error("castled but no direct rook in line");
			rook.changePosition(this.board, this.x, this.y - Math.sign(yDiff));
		}
	}
	*enumerateMoves(incrBoardNum) {
		yield* super.enumerateMoves(incrBoardNum);
		if (incrBoardNum !== undefined)
			return;
		if (this.board.imminentCheck)
			return;
		const bits = this.board.castleAvailable >> (2 * this.side);
		let castleMoves = [];
		if (bits & 1)
			castleMoves.push(-2);
		if (bits & 2)
			castleMoves.push(2);
		let checkCheckGroups = [], castlePositions = [];
		castleLoop:
		for (let amount of castleMoves) {
			let pos = this.pos(incrBoardNum === this.board.l);
			let possibleCheckPositions = [];
			for (let i = 1; i <= 2; i++) {
				pos.y += Math.sign(amount);
				if (pos.y < 0 || pos.y >= 8)
					continue castleLoop;
				if (this.board.pieces[pos.x][pos.y])
					continue castleLoop;
				possibleCheckPositions.push(new Vec4(pos.x, pos.y, pos.l, pos.t + 1));
			}
			let rookY = pos.y;
			let rook;
			do {
				rookY += Math.sign(amount);
				rook = this.board.pieces[pos.x][rookY];
			} while (rookY >= 0 && rookY < 8 && !rook)
			if (rook.type == "Rook") {
				checkCheckGroups.push(possibleCheckPositions);
				castlePositions.push(pos);
			}
		}
		const checkResults = this.game.checkChecks(checkCheckGroups, this.board);
		for (let i = 0; i < checkResults.length; i++)
			if (!checkResults[i])
				yield castlePositions[i];
	}
}
// before you start facepalming, These lists are generated with python. (still not great tho)
// See moves.py
// the fourth dimension, time, is multiplied by two as to skip opponent boards, since you can only move to your own boards.
class Rook extends MPiece {
	changePosition(targetBoard, x, y, sourceBoard, sourceRook) {
		const bit = (this.y == 0 || this.y == 7) && (this.x == 0 || this.x == 7) ? 1 << ((!!this.y) + 2 * this.side) : 0;
		super.changePosition(targetBoard, x, y, sourceBoard, sourceRook);
		this.board.castleAvailable &= ~bit;
	}
	static *enumerateDirections() {
		yield new Vec4(-1, 0, 0, 0);
		yield new Vec4( 1, 0, 0, 0);
		yield new Vec4( 0,-1, 0, 0);
		yield new Vec4( 0, 1, 0, 0);
		yield new Vec4( 0, 0,-1, 0);
		yield new Vec4( 0, 0, 1, 0);
		yield new Vec4( 0, 0, 0,-2);
		yield new Vec4( 0, 0, 0, 2);
	}
}
class Knight extends MPiece {
	static maxMoveSteps() { return 1 };
	static *enumerateDirections() {
		yield new Vec4( 2, 1, 0, 0);
		yield new Vec4( 2, 0, 1, 0);
		yield new Vec4( 2, 0, 0, 2);
		yield new Vec4( 1, 2, 0, 0);
		yield new Vec4( 1, 0, 2, 0);
		yield new Vec4( 1, 0, 0, 4);
		yield new Vec4( 0, 2, 1, 0);
		yield new Vec4( 0, 2, 0, 2);
		yield new Vec4( 0, 1, 2, 0);
		yield new Vec4( 0, 1, 0, 4);
		yield new Vec4( 0, 0, 2, 2);
		yield new Vec4( 0, 0, 1, 4);
		yield new Vec4(-2, 1, 0, 0);
		yield new Vec4(-2, 0, 1, 0);
		yield new Vec4(-2, 0, 0, 2);
		yield new Vec4( 1,-2, 0, 0);
		yield new Vec4( 1, 0,-2, 0);
		yield new Vec4( 1, 0, 0,-4);
		yield new Vec4( 0,-2, 1, 0);
		yield new Vec4( 0,-2, 0, 2);
		yield new Vec4( 0, 1,-2, 0);
		yield new Vec4( 0, 1, 0,-4);
		yield new Vec4( 0, 0,-2, 2);
		yield new Vec4( 0, 0, 1,-4);
		yield new Vec4( 2,-1, 0, 0);
		yield new Vec4( 2, 0,-1, 0);
		yield new Vec4( 2, 0, 0,-2);
		yield new Vec4(-1, 2, 0, 0);
		yield new Vec4(-1, 0, 2, 0);
		yield new Vec4(-1, 0, 0, 4);
		yield new Vec4( 0, 2,-1, 0);
		yield new Vec4( 0, 2, 0,-2);
		yield new Vec4( 0,-1, 2, 0);
		yield new Vec4( 0,-1, 0, 4);
		yield new Vec4( 0, 0, 2,-2);
		yield new Vec4( 0, 0,-1, 4);
		yield new Vec4(-2,-1, 0, 0);
		yield new Vec4(-2, 0,-1, 0);
		yield new Vec4(-2, 0, 0,-2);
		yield new Vec4(-1,-2, 0, 0);
		yield new Vec4(-1, 0,-2, 0);
		yield new Vec4(-1, 0, 0,-4);
		yield new Vec4( 0,-2,-1, 0);
		yield new Vec4( 0,-2, 0,-2);
		yield new Vec4( 0,-1,-2, 0);
		yield new Vec4( 0,-1, 0,-4);
		yield new Vec4( 0, 0,-2,-2);
		yield new Vec4( 0, 0,-1,-4);
	}
}
class Bishop extends MPiece {
	static *enumerateDirections() {
		yield new Vec4( 1, 1, 0, 0);
		yield new Vec4( 1, 0, 1, 0);
		yield new Vec4( 1, 0, 0, 2);
		yield new Vec4( 0, 1, 1, 0);
		yield new Vec4( 0, 1, 0, 2);
		yield new Vec4( 0, 0, 1, 2);
		yield new Vec4( 1,-1, 0, 0);
		yield new Vec4( 1, 0,-1, 0);
		yield new Vec4( 1, 0, 0,-2);
		yield new Vec4(-1, 1, 0, 0);
		yield new Vec4(-1, 0, 1, 0);
		yield new Vec4(-1, 0, 0, 2);
		yield new Vec4( 0, 1,-1, 0);
		yield new Vec4( 0, 1, 0,-2);
		yield new Vec4( 0,-1, 1, 0);
		yield new Vec4( 0,-1, 0, 2);
		yield new Vec4( 0, 0, 1,-2);
		yield new Vec4( 0, 0,-1, 2);
		yield new Vec4(-1,-1, 0, 0);
		yield new Vec4(-1, 0,-1, 0);
		yield new Vec4(-1, 0, 0,-2);
		yield new Vec4( 0,-1,-1, 0);
		yield new Vec4( 0,-1, 0,-2);
		yield new Vec4( 0, 0,-1,-2);
	}
}
class Queen extends MPiece {
	static *enumerateDirections() {
		yield* Rook.enumerateDirections();
		yield* Bishop.enumerateDirections();
		yield new Vec4( 1, 1, 1, 0);
		yield new Vec4( 1, 1, 0, 2);
		yield new Vec4( 1, 0, 1, 2);
		yield new Vec4( 0, 1, 1, 2);
		yield new Vec4( 1, 1,-1, 0);
		yield new Vec4( 1, 1, 0,-2);
		yield new Vec4( 1,-1, 1, 0);
		yield new Vec4( 1,-1, 0, 2);
		yield new Vec4( 1, 0, 1,-2);
		yield new Vec4( 1, 0,-1, 2);
		yield new Vec4(-1, 1, 1, 0);
		yield new Vec4(-1, 1, 0, 2);
		yield new Vec4(-1, 0, 1, 2);
		yield new Vec4( 0, 1, 1,-2);
		yield new Vec4( 0, 1,-1, 2);
		yield new Vec4( 0,-1, 1, 2);
		yield new Vec4( 1,-1,-1, 0);
		yield new Vec4( 1,-1, 0,-2);
		yield new Vec4( 1, 0,-1,-2);
		yield new Vec4(-1, 1,-1, 0);
		yield new Vec4(-1, 1, 0,-2);
		yield new Vec4(-1,-1, 1, 0);
		yield new Vec4(-1,-1, 0, 2);
		yield new Vec4(-1, 0, 1,-2);
		yield new Vec4(-1, 0,-1, 2);
		yield new Vec4( 0, 1,-1,-2);
		yield new Vec4( 0,-1, 1,-2);
		yield new Vec4( 0,-1,-1, 2);
		yield new Vec4(-1,-1,-1, 0);
		yield new Vec4(-1,-1, 0,-2);
		yield new Vec4(-1, 0,-1,-2);
		yield new Vec4( 0,-1,-1,-2);
		yield new Vec4( 1, 1, 1, 2);
		yield new Vec4( 1, 1, 1,-2);
		yield new Vec4( 1, 1,-1, 2);
		yield new Vec4( 1, 1,-1,-2);
		yield new Vec4( 1,-1, 1, 2);
		yield new Vec4( 1,-1, 1,-2);
		yield new Vec4( 1,-1,-1, 2);
		yield new Vec4( 1,-1,-1,-2);
		yield new Vec4(-1, 1, 1, 2);
		yield new Vec4(-1, 1, 1,-2);
		yield new Vec4(-1, 1,-1, 2);
		yield new Vec4(-1, 1,-1,-2);
		yield new Vec4(-1,-1, 1, 2);
		yield new Vec4(-1,-1, 1,-2);
		yield new Vec4(-1,-1,-1, 2);
		yield new Vec4(-1,-1,-1,-2);
	}
}

	return {
		Pawn: Pawn,
		King: King,
		Rook: Rook,
		Knight: Knight,
		Bishop: Bishop,
		Queen: Queen,
	};
}