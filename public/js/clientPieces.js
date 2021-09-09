"use strict";


class ClientBasePiece extends BasePiece {
	constructor(game, board, side, x, y) {
		super(game, board, side, x, y);
		this.el = document.createElementNS("http://www.w3.org/2000/svg", "use");
		const color = this.side ? "white" : "black";
		this.el.setAttribute("color", color);
		this.el.style.setProperty("--x", this.x);
		this.el.style.setProperty("--y", this.y);
	}
	initType(type) {
		super.initType(type);
		const color = this.side ? "white" : "black";
		this.el.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + type.toLowerCase() + "-" + color)
	}
	changePosition(x, y) {
		super.changePosition(x, y);
		this.el.style.setProperty("--x", x);
		this.el.style.setProperty("--y", y);
	}
}

const ClientPiece = ClientBasePiece => class extends ClientBasePiece {
	constructor(board, side, x, y) {
		super(board, side, x, y);
		this.el.onmouseenter = e => this.hover();
		this.el.onmouseleave = e => this.game.removeHighlights();
		this.el.onclick = e => this.select(e);
		this.board.piecesEl.append(this.el);
	}
	remove() {
		super.remove();
		this.el.remove();
	}
	changePosition(targetBoard, x, y, sourceBoard, sourcePiece) {
		if (targetBoard != this.board)
			targetBoard.piecesEl.append(this.el);
		super.changePosition(targetBoard, x, y, sourceBoard, sourcePiece);
	}
	hover() {
		if(this.game.selectedPiece)
			return;
		if (this.side != this.board.turn || !this.board.active)
			return;
		this.game.removeHighlights();
		this.game.hoveredPiece = this;
		new HoverHighlight(this.board, this.x, this.y);
		let optionsAvailable = false;
		for (let pos of this.enumerateMoves()) {
			optionsAvailable = true;
			new HoverHighlight(this.game.getTimeline(pos.l).getBoard(pos.t), pos.x, pos.y);
		}
		return optionsAvailable;
	}
	select(e) {
		if (this.game.lastMouseWasDrag)
			return;
		if (this.hover())
			this.game.selectPiece(this);
		e.stopPropagation();
	}
}