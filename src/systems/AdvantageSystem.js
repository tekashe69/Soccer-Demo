import { C } from '../utils/constants.js';
import { Vector } from '../utils/math.js';
import { logEvent } from '../utils/helpers.js';

export class AdvantageSystem {
  constructor() {
    this.pendingCards = [];
    this.advantageActive = false;
    this.advantageTimer = 0;
    this.advantageTeam = -1;
  }

  evaluate(fouledTeam, fouledPos, engine) {
    let att = engine.getActivePlayers(fouledTeam);
    let oppGoalX = fouledTeam === 0 ? C.PITCH_W : 0;
    let nearGoal = att.some(p => p.pos.dist(new Vector(oppGoalX, C.PITCH_H / 2)) < 250);
    let ballNear = att.some(p => p.pos.dist(engine.ball.pos) < 60 && p !== engine.ball.lastTouch);

    let prob = 0;
    if (nearGoal && ballNear) prob = 0.55;
    else if (nearGoal) prob = 0.25;
    else if (ballNear) prob = 0.15;

    return Math.random() < prob;
  }

  update() {
    if (this.advantageActive) {
      this.advantageTimer--;
      if (this.advantageTimer <= 0) this.advantageActive = false;
    }
  }

  onStoppage(engine) {
    this.pendingCards.forEach(({ player, card, reason }) => {
      let tk = player.team === 0 ? 'home' : 'away';
      if (card === 'YELLOW') {
        player.yellowCards++;
        player.cardFlash = { type: 'YELLOW', timer: 90 };
        engine.referee.showCard('YELLOW');
        engine.stats[tk].yellows++;
        logEvent(`⏳ Delayed 🟨 for #${player.number} (${reason})`, 'card');
        if (player.yellowCards >= 2) {
          player.redCard = true; player.sentOff = true;
          player.cardFlash = { type: 'RED', timer: 120 };
          engine.referee.showCard('RED');
          engine.stats[tk].reds++;
          logEvent(`🟥 SECOND YELLOW! #${player.number} SENT OFF!`, 'red');
        }
      } else if (card === 'RED') {
        player.redCard = true; player.sentOff = true;
        player.cardFlash = { type: 'RED', timer: 120 };
        engine.referee.showCard('RED');
        engine.stats[tk].reds++;
        logEvent(`⏳ Delayed 🟥 for #${player.number} (${reason})`, 'red');
      }
    });
    this.pendingCards = [];
    this.advantageActive = false;
  }
}

