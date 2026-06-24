import { C } from '../utils/constants.js';
import { Vector } from '../utils/math.js';
import { logEvent, isInPenaltyBox } from '../utils/helpers.js';

export class FoulSystem {
  constructor(referee) { this.referee = referee; }

  evaluateTackle(tackler, carrier, engine) {
    let aggrFactor = (tackler.attr.aggression / 20) * 12;
    let discFactor = ((20 - tackler.attr.discipline) / 20) * 5;
    let rndFactor = Math.random() * 10;

    let fromBehind = Math.random() < 0.04 ? 20 : 0;
    let twoFooted = Math.random() < 0.01 ? 30 : 0;
    let lateTackle = Math.random() < 0.08 ? 15 : 0;
    let strDiff = (carrier.attr.strength - tackler.attr.strength) / 20 * 10;

    let severity = aggrFactor + discFactor + fromBehind + twoFooted + lateTackle + rndFactor + strDiff;
    severity -= this.referee.thresholdMod;
    severity = Math.max(0, Math.min(100, severity));

    let result = {
      isFoul: false, tackleSuccess: false, severity,
      card: null, isPenalty: false, isDOGSO: false, reason: ''
    };

    if (severity <= 55) {
      let tackleScore = tackler.tacklingAbility; 
      let dribbleScore = carrier.attr.dribbling * 3 + carrier.attr.strength * 2; 
      let successChance = Math.max(15, Math.min(95, tackleScore - dribbleScore * 0.4 + 45));
      result.tackleSuccess = Math.random() * 100 < successChance;
      return result;
    }

    result.isFoul = true;
    let defTeam = carrier.team === 0 ? 1 : 0;
    result.isPenalty = isInPenaltyBox(carrier.pos, defTeam);
    result.isDOGSO = this.isDOGSO(carrier, engine);

    if (severity > 85 || twoFooted > 0) {
      result.card = Math.random() < 0.8 ? 'RED' : 'YELLOW';
      result.reason = twoFooted ? 'Two-footed tackle' : 'Violent conduct';
    } else if (severity > 65) {
      if (result.isDOGSO && !result.isPenalty) {
        result.card = 'RED'; result.reason = 'DOGSO';
      } else if (result.isDOGSO && result.isPenalty) {
        result.card = 'YELLOW'; result.reason = 'DOGSO (pen area)';
      } else if (fromBehind > 0) {
        result.card = 'YELLOW'; result.reason = 'Tackle from behind';
      } else {
        result.card = Math.random() < 0.6 ? 'YELLOW' : null;
        result.reason = 'Reckless challenge';
      }
    } else if (severity > 40) {
      if (this.isCounterAttack(carrier, engine)) {
        result.card = 'YELLOW'; result.reason = 'Tactical foul';
      } else if (tackler.foulCount >= 3 && tackler.yellowCards === 0) {
        result.card = 'YELLOW'; result.reason = 'Persistent fouling';
      } else {
        result.card = Math.random() < 0.1 ? 'YELLOW' : null;
        result.reason = 'Foul';
      }
    } else {
      result.reason = 'Minor foul';
    }

    if (result.isDOGSO && !result.isPenalty && result.card !== 'RED') {
      result.card = 'RED'; result.reason = 'DOGSO';
    }
    return result;
  }

  isDOGSO(carrier, engine) {
    let oppGoalX = carrier.team === 0 ? C.PITCH_W : 0;
    let distGoal = carrier.pos.dist(new Vector(oppGoalX, C.PITCH_H / 2));
    if (distGoal > 250) return false;

    let oppOut = engine.getActivePlayers(carrier.team === 0 ? 1 : 0).filter(p => p.role !== 'GK');
    let closer = oppOut.filter(p => p.pos.dist(new Vector(oppGoalX, C.PITCH_H / 2)) < distGoal);
    return closer.length <= 0;
  }

  isCounterAttack(carrier, engine) {
    let oppGoalX = carrier.team === 0 ? C.PITCH_W : 0;
    let dist = carrier.pos.dist(new Vector(oppGoalX, C.PITCH_H / 2));
    let fwd = carrier.team === 0 ? carrier.vel.x > 0.5 : carrier.vel.x < -0.5;
    return dist < 350 && fwd;
  }

  evaluateHandball(player, ballVel) {
    let myGoalX = player.team === 0 ? 0 : C.PITCH_W;
    let distOwn = player.pos.dist(new Vector(myGoalX, C.PITCH_H / 2));
    let preventing = distOwn < 100 && ballVel.mag() > 5;
    let armSpread = Math.random() < 0.3;
    let r = { isFoul: false, card: null, isPenalty: false, reason: '' };

    if (preventing) {
      r.isFoul = true; r.card = 'RED'; r.reason = 'Handball preventing goal';
      r.isPenalty = isInPenaltyBox(player.pos, player.team);
    } else if (armSpread) {
      r.isFoul = true; r.card = 'YELLOW'; r.reason = 'Deliberate handball';
      r.isPenalty = isInPenaltyBox(player.pos, player.team);
    } else {
      r.isFoul = Math.random() < 0.3; r.reason = 'Accidental handball';
      if (r.isFoul) r.isPenalty = isInPenaltyBox(player.pos, player.team);
    }
    return r;
  }
}

