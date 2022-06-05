// hypercuboid search algorithm by penteract


const TSp = 1; // timeline spacing
function* search(state) {
    let [wholeHC, hcs] = buildHCs(state);
    let sgn = getNewL(state) > 0 ? 1 : -1;
    while (hcs.length) {
        let hc = hcs.pop();
        let p = takePoint(hc);
        if (p) {
            let problem = findProblem(state, p, wholeHC);
            if (problem) {
                hcs.push(...removeSlice(hc, problem));
                yield false;
            }
            else {
                yield toAction(p, sgn);
                hcs.push(...removePoint(hc, p));
            }
        }
    }
}
function toAction(p, sgn) {
    let ls = Object.keys(p); // yes, they're still strings, but it works
    ls.sort((a, b) => a * sgn - b * sgn); // put new timelines at the end (this means that branches are created in the right order)
    let res = [];
    for (let l of ls) {
        ;
        let [n, loc] = p[l];
        if (loc.type == "physical" || loc.type == "arrive") {
            res.push(loc.move);
        }
    }
    return res;
}
function buildHCs(state) {
    let nonBranches = {};
    let arrivals = [{ type: "pass", lt: null }];
    for (let l of getPlayableTimelines(state)) {
        nonBranches[l] = [{ type: "pass", lt: [l, getEndT(state, l)] }];
    }
    for (let l of getPlayableTimelines(state)) {
        let lastLeave = undefined;
        let lastLeaveIdx = undefined;
        for (let mv of movesFrom(state, l)) {
            // Assume that movesFrom returns moves by each piece in turn
            let s = getStart(mv);
            let e = getEnd(mv);
            let nbs = getNewBoards(mv);
            if (lt(e) + "" == lt(s) + "") {
                nonBranches[l].push({ type: "physical", move: mv, board: nbs[s[0]] });
                continue;
            }
            if (s + "" != lastLeave + "") {
                nonBranches[l].push({ type: "leave", source: s, board: nbs[s[0]] });
                lastLeaveIdx = nonBranches[l].length - 1;
                lastLeave = s;
            }
            let otherBoard = Object.keys(nbs).filter(x => x != s[0] + "");
            if (otherBoard.length != 1) {
                throw "there should have been exactly 2 boards created";
            }
            arrivals.push({ type: "arrive", move: mv, board: nbs[otherBoard[0]], idx: lastLeaveIdx });
            if (nonBranches[e[0]] && getEndT(state, e[0]) == e[1]) { // isPlayable(state,lt(e))){
                nonBranches[e[0]].push(arrivals[arrivals.length - 1]);
            }
        }
    }
    let maxBranches = 0;
    for (let l in nonBranches)
        for (let loc of nonBranches[l])
            if (loc.type == "leave") {
                maxBranches += 1;
                break;
            }
    let axes = nonBranches;
    let newL = getNewL(state);
    let hcs = [];
    // We now split into maxBranches+1 hypercuboids to ensure that
    // we don't consider actions where there is an uncreated timeline closer to
    // the center than some created timeline
    //
    // alternative: split into ceil((maxBranches+1)/2) hcs where some of the axes have both moves and passes
    //TODO: confirm that sharing references doesn't break things
    //(there may be parts that could be sped up by not sharing references)
    let newArrs = {};
    for (let i = 1; i < arrivals.length; i++)
        newArrs[i] = arrivals[i];
    for (let numActive = maxBranches; numActive >= 0; numActive--) {
        let l = newL;
        for (let i = 0; i < maxBranches; i++) {
            axes[l] = (i >= numActive) ? [arrivals[0]] : newArrs;
            l += newL > 0 ? 1 : -1;
        }
        let cur = Object.assign({}, axes);
        hcs.push(cur);
    }
    let l = newL;
    for (let i = 0; i < maxBranches; i++) {
        axes[l] = arrivals;
        l += newL > 0 ? TSp : -TSp;
    }
    return [axes, hcs];
}
/*
type HC = Record<LIndex,Record<number,AxisLoc>>
type Point = Record<LIndex,[number,AxisLoc]>
type Slice = Record<LIndex,number[]>*/
// The meat of the search - where we find why there is a problem
//  (e.g. why an action results in check)
function findProblem(state, p, hc) {
    return jumpOrderConsistent(state, p, hc) || testPresent(state, p, hc) || findChecks(state, p, hc);
}
// test whether there's a branch to a pass or a pair of branches that are created in the wrong order (implying a jump to a board that hasn't yet been played on, which cannot create a branch)
function jumpOrderConsistent(state, p, hc) {
    let newL = getNewL(state);
    let sgn = newL > 0 ? 1 : -1;
    let jumpMap = {}; // jumpMap["l1,t1"]==l2 means that p[l2] is a jump to the 2D board at [l1,t1]
    for (let l = newL; l in p && p[l][1].type == "arrive"; l += TSp * sgn) {
        let [_, branchLoc] = p[l];
        if (branchLoc.type == "arrive") { // branch
            let cloned = lt(getEnd(branchLoc.move));
            if ((cloned[0] in p)) {
                let [n, targetLoc] = p[cloned[0]];
                if (targetLoc.type == "pass" && targetLoc.lt[1] == cloned[1]) {
                    // branch involves moving to a pass. Ban any branches to the same place intersecting with a pass
                    let result = {};
                    result[cloned[0]] = [n];
                    result[l] = [];
                    for (let m in hc[l]) {
                        let loc = hc[l][m];
                        if (loc.type == "arrive" && getEnd(loc.move).slice(0, 2).every((e, ix) => e == cloned[ix])) {
                            result[l].push(m);
                        }
                    }
                    return result;
                }
            }
            let source = lt(getStart(branchLoc.move));
            if (source.toString() in jumpMap) {
                //some earlier branch jumped to the source of this one before that board had been played on
                let result = {};
                result[l] = [];
                for (let n in hc[l]) {
                    let loc = hc[l][n];
                    if (loc.type == "arrive") {
                        let nstart = getStart(loc.move);
                        if (source.every((e, ix) => nstart[ix] == e))
                            result[l].push(n);
                    }
                }
                let prevBranch = jumpMap[source.toString()];
                result[prevBranch] = [];
                for (let n in hc[prevBranch]) {
                    let loc = hc[prevBranch][n];
                    if (loc.type == "arrive") {
                        let nEnd = getEnd(loc.move);
                        if (source.every((e, ix) => nEnd[ix] == e))
                            result[prevBranch].push(n);
                    }
                }
                return result;
            }
            jumpMap[cloned.toString()] = l;
        }
    }
    return null;
}
function testPresent(state, p, hc) {
    const newL = getNewL(state);
    const sgn = newL > 0 ? 1 : -1;
    // the L-index of the timeline most recently created by the opponent
    const minL = getOpL(state);
    // the L-index timeline most recently created by the player
    const maxL = sgn * Math.max(sgn * (newL - sgn * TSp), ...Object.keys(p).filter(k => p[k][1].type != "pass").map(l => +l * sgn));
    const active = Math.min(Math.abs(minL), Math.abs(maxL)) + TSp;
    let minT = Infinity;
    let minTl = undefined;
    for (let l = sgn * Math.max(sgn * minL, -active); sgn * l <= Math.min(sgn * maxL, active); l += sgn * TSp) {
        let t;
        if (sgn * l >= sgn * newL) {
            let lt = getLTFromLoc(p[l][1]);
            t = lt == null ? Infinity : lt[1];
        }
        else
            t = getEndT(state, l);
        if (l in p && p[l][1].type != "pass") {
            t += 1;
        }
        if (t < minT) {
            minT = t;
            minTl = l;
        }
    }
    if (minTl in p && p[minTl][1].type == "pass") { // The given action does not move the present to the opponent
        if (minTl * sgn >= newL * sgn)
            throw "The definition of maxl should exclude minTl being a pass and a new branch";
        // return a slice saying that minTl can't be pass if it is active and
        let result = {};
        result[minTl] = [p[minTl][0]];
        // only remove points where minTl is active
        if (minTl * sgn < -newL * sgn) {
            // minTl
            let nonPassL = -minTl - sgn * TSp;
            result[nonPassL] = Object.keys(hc[nonPassL]).filter(ix => ix != "pass");
        }
        // Only remove points where there isn't an active branch further back
        for (let l = newL; sgn * l < Math.abs(minL) + TSp; l += sgn * TSp) {
            if (!(l in hc))
                break;
            if (!(l in result))
                result[l] = Object.keys(hc[l]);
            result[l] = result[l].filter((ix) => doesNotMoveT(hc[l][ix], minT));
        }
        return result;
    }
    else { // The given action does move the present to the opponent
        return null;
    }
}
function doesNotMoveT(loc, minT) {
    return loc.type == "pass" || getLTFromLoc(loc)[1] >= minT;
}
function findChecks(state, p, hc) {
    //We could use a bit of mutability here and undo before returning
    let check = withMoves(state, toAction(p, getNewL(state) > 0 ? 1 : -1), getCheckPath);
    //let changedState = applyPoint(state,p)
    //let check = getCheckPath(changedState)
    if (check) {
        let result = {};
        for (let [pos, piece] of check) { // We rely on the fact that any path crosses each timeline at most once
            if (!posExists(state, pos)) { // The position is added by some newly created board
                //let piece = getFromState(changedState,pos) // get the piece or space involved in the check
                if (pos[0] in result) {
                    let newRow = [];
                    for (let ix of result[pos[0]]) {
                        let loc = hc[pos[0]][ix];
                        if (loc.type != "pass" && getFrom2D(loc.board, [pos[2], pos[3]]) == piece) {
                            newRow.push(+ix);
                        }
                    }
                    result[pos[0]] = newRow;
                }
                else {
                    result[pos[0]] = [];
                    let row = hc[pos[0]];
                    for (let ix in row) {
                        let loc = row[ix];
                        if (loc.type != "pass")
                            if (getFrom2D(loc.board, [pos[2], pos[3]]) == piece)
                                result[pos[0]].push(+ix);
                    }
                }
            }
        }
        return result;
    }
    else
        return null;
}
/*function applyPoint(state:GameState, p:Point) : GameState{
  let sgn = getNewL(state)>0?1:-1
  return applyMoves(state, toAction(p,sgn))
}*/
function takePoint(hc) {
    let sameboard = {};
    let graph = {};
    let mustInclude = [];
    for (let l in hc) {
        graph[l] = {};
        for (let ix in hc[l]) {
            let loc = hc[l][ix];
            if (loc.type == "physical" || loc.type == "pass") {
                sameboard[l] = [+ix, loc];
                break;
            }
        }
        if (!sameboard[l])
            mustInclude.push(l);
    }
    for (let l in hc) {
        for (let ix in hc[l]) {
            let loc = hc[l][ix];
            if (loc.type == "arrive") {
                let srcL = getStart(loc.move)[0];
                // I think that checking that hc[srcL][loc.idx] exists is done by 'sanity' in the Haskell code
                if (hc[srcL][loc.idx] && !graph[l][srcL]) {
                    graph[l][srcL] = [+ix, loc];
                    graph[srcL][l] = [loc.idx, hc[srcL][loc.idx]];
                    // this assumes that the corresponding leave is actually part of the hypercuboid
                }
            }
        }
    }
    let matching = findMatching(graph, mustInclude);
    if (matching === null)
        return null;
    return Object.assign(sameboard, matching);
}
//Split a hypercuboid into pieces with a slice removed
function removeSlice(hc, slice) {
    //  to understand this read removePoint first, and think of a cube
    let res = [];
    let altSlice = {}; // will describe the subset of slice that intersects hc
    for (let l in hc) {
        if (l in slice) {
            let altSliceL = {};
            for (let n of slice[l]) {
                if (n in hc[l])
                    altSliceL[n] = hc[l][n];
            }
            let x = Object.assign({}, hc, altSlice);
            x[l] = {}; // set row L of the current piece to be the complement of slice[l]
            for (let n in hc[l]) {
                if (!(n in altSliceL))
                    x[l][n] = hc[l][n];
            }
            res.push(x);
            altSlice[l] = altSliceL; // future pieces
        }
        else
            altSlice[l] = hc[l];
    }
    return res;
}
//Split a hypercuboid into pieces with a point removed
function removePoint(hc, point) {
    // Think of a cube with a small cube in the lower front left corner removed.
    // We can cut this shape into 3 cuboids -
    // First we take a large cuboid off the top (leaving a fairly flat shape)
    // Then we take a rectange from the back
    // What remains is a long cuboid to the right of the removed cube
    let res = [];
    let pt = {};
    for (let l in point) {
        let x = Object.assign({}, hc, pt);
        x[l] = { ...hc[l] };
        delete x[l][point[l][0]];
        res.push(x);
        pt[l] = Object.fromEntries([point[l]]);
    }
    // put the larger pieces at the front to reduce memory usage
    return res;
}
//utility functions
function lt(c) {
    return [c[0], c[1]];
}
function getLTFromLoc(loc) {
    switch (loc.type) {
        case "physical":
            return lt(getStart(loc.move));
        case "arrive":
            return lt(getEnd(loc.move));
        case "leave":
            return lt(loc.source);
        case "pass":
            return loc.lt;
    }
}
// Given a graph, if a matching including all edges in `include` exists, return one.
//  If no such matching exists, return null
// Because we know the set of nodes that must be included, we just need to repeatedly search for
// augmenting paths. If we don't find such a path, there is no acceptable matching,
// if we do find one, we can include the node.
// https://en.wikipedia.org/wiki/Berge%27s_theorem applies here, adapted appropriately
function findMatching(g, include) {
    let ns = Object.keys(g);
    let mustInc = {}; // Set of nodes that must be included
    for (let n of include) {
        mustInc[n] = true;
    }
    let mtch = {};
    for (let n of include) { // make sure the matching includes all of these by finding augmenting paths
        if (n in mtch)
            continue;
        let seen = {}; //nodes seen at an odd distance from n (and n itself)
        seen[n] = true;
        let ms = Object.keys(g[n]);
        for (let m of ms)
            seen[m] = true;
        let cur = ms.map(m => ({ pair: [n, m], next: null }));
        let augment = null;
        find_augment: while (cur.length != 0) {
            let next = []; // next depth of bfs
            for (let p of cur) {
                let u = p.pair[1];
                let n = mtch[u];
                if (n) {
                    if (mustInc[n]) {
                        let ms = Object.keys(g[n]).filter(m => !seen[m]);
                        for (let m of ms)
                            seen[m] = true;
                        ms.map(m => next.push({ pair: [n, m], next: p }));
                    }
                    else {
                        augment = { path: p, drop: n };
                        break find_augment;
                    }
                }
                else {
                    augment = { path: p };
                    break find_augment;
                }
            }
            cur = next;
        }
        if (augment === null) {
            return null;
        }
        else {
            if (augment.drop)
                delete mtch[augment.drop];
            let p = augment.path;
            while (p !== null) {
                mtch[p.pair[0]] = p.pair[1];
                mtch[p.pair[1]] = p.pair[0];
                p = p.next;
            }
        }
    }
    let result = {};
    for (let n in mtch) {
        result[n] = g[n][mtch[n]];
    }
    return result;
}
function sh(p) {
    let res = [];
    while (p !== null) {
        res.push(p.pair);
        p = p.next;
    }
    return res;
}
