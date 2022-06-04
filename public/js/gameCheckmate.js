"use strict";


// When this project was still in active development, the idea here was that this had be run only on the clients since it can sometimes be very expensive.
// It would be ran in a background worker task, as to not lag the interface.
// If the client were to tamper with this file and disable it, at best it could cause the client to not report a checkmate, but since there are no legal moves the only option would be for said client to time out.
// Not sure if this idea is solid enough for real world. It can always be ran on the server too just in case, probably best to do this with a timelimit.

self.importScripts("/js/gamePieces.js" + self.location.search
                  ,"/js/game.js" + self.location.search
                  ,"/js/hcuboid.js" + self.location.search
                  ,"./hcuboid-interface.js" + self.location.search )


function c2v(c){
	return new Vec4(c[2],c[3],c[0],c[1]);
}
function mkMoves (ms){
	let result = []
	for (let m of ms) result.push({from:c2v(m.start), to:c2v(m.end)})
	return result
}

class WorkerPlayer extends Player {
	startClock(skipGraceAmount, skipAmount) { }
	stopClock() { }
}
class WorkerGame extends Game {
	instantiatePlayer(side) {
		return new WorkerPlayer(this, side);
	}
	startMateSearch() {
		this.findChecks();
		const gen = this.searchMate();
		const loop = _ => {
			const stopTime = performance.now() + 100;
			do {
				const r = gen.next();
				if (r.done || r.value)
					return postMessage(r.value);
			} while (performance.now() < stopTime);
			this.searchTimeout = setTimeout(loop, 0);
		};
		loop();
	}
	stopMateSearch() {
		clearTimeout(this.searchTimeout);
	}
	*searchMate() {
		for(let c of search(this)){
			if(!c) yield c
			else{
				yield mkMoves(c)
			}
		}
	};
}

onmessage = function(options) {
	const game = new WorkerGame(options.data, [true, true]);
	game.startMateSearch();

	onmessage = function(move) {
		game.stopMateSearch();
		if (move.data != "stop") {
			game.executeMove("submit", move.data);
			game.startMateSearch();
		}
	}
}