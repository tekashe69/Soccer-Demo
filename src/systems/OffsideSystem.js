import { C } from '../utils/constants.js';

export class OffsideSystem {
  check(passer, receiver, engine) {
    let lsp = engine.lastSetPieceType;
    if (lsp === 'THROW_IN' || lsp === 'GOAL_KICK' || lsp === 'CORNER') return { isOffside: false };

    let inOppHalf = passer.team === 0 ? receiver.pos.x > C.PITCH_W / 2 : receiver.pos.x < C.PITCH_W / 2;
    if (!inOppHalf) return { isOffside: false };

    let recToGoal = passer.team === 0 ? C.PITCH_W - receiver.pos.x : receiver.pos.x;
    let ballToGoal = passer.team === 0 ? C.PITCH_W - engine.ball.pos.x : engine.ball.pos.x;
    if (recToGoal >= ballToGoal) return { isOffside: false };

    let opp = engine.getActivePlayers(passer.team === 0 ? 1 : 0);
    if (passer.team === 0) opp.sort((a, b) => b.pos.x - a.pos.x);
    else opp.sort((a, b) => a.pos.x - b.pos.x);

    let sld = opp.length > 1 ? opp[1] : opp[0];
    if (!sld) return { isOffside: false };

    let ol = sld.pos.x;
    let diff = passer.team === 0 ? receiver.pos.x - ol : ol - receiver.pos.x;
    if (diff <= 2) return { isOffside: false };

    return { isOffside: diff > 0, offsideLineX: ol, offsidePos: receiver.pos.copy() };
  }

  getOffsideLine(attackingTeam, engine) {
    let opp = engine.getActivePlayers(attackingTeam === 0 ? 1 : 0);
    if (attackingTeam === 0) opp.sort((a, b) => b.pos.x - a.pos.x);
    else opp.sort((a, b) => a.pos.x - b.pos.x);

    let sld = opp.length > 1 ? opp[1] : opp[0];
    if (!sld) return attackingTeam === 0 ? C.PITCH_W : 0;
    return sld.pos.x;
  }
}

