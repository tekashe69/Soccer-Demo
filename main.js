// =====================================================================
// 2D FOOTBALL MATCH ENGINE v3.0
// Full realism: Fouls, Cards, Penalties, VAR, Advantage, Stamina
// =====================================================================

// ===== VECTOR =====
class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { let m = this.mag(); if (m > 0) this.mult(1 / m); return this; }
  limit(max) { if (this.magSq() > max * max) { this.normalize(); this.mult(max); } return this; }
  dist(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
  copy() { return new Vector(this.x, this.y); }
  static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
  static add(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y); }
}

// ===== CONSTANTS =====
const C = {
  PITCH_W: 800,
  PITCH_H: 500,
  GOAL_W: 100,
  GOAL_Y: 200,
  BALL_R: 4,
  PLAYER_R: 8,
  FRICTION: 0.97,
  MAX_SPEED: 2.5,
  MAX_BALL_SPEED: 15,
  PENALTY_SPOT: 80,
  PENALTY_BOX_W: 110,
  PENALTY_BOX_H: 220,
  SIX_YARD_W: 40,
  SIX_YARD_H: 130,
  CORNER_ARC_R: 15,
  CENTER_CIRCLE_R: 50,
  TACKLE_RANGE: 20,
  PICKUP_RANGE: 15,
  STAMINA_DRAIN: 0.0018,
  STAMINA_SPRINT_MULT: 3,
};

// ===== PENALTY BOX HELPERS =====
function getPenaltyBox(teamDefending) {
  let hh = C.PENALTY_BOX_H / 2;
  if (teamDefending === 0) {
    return { x1: 0, y1: C.PITCH_H / 2 - hh, x2: C.PENALTY_BOX_W, y2: C.PITCH_H / 2 + hh };
  }
  return { x1: C.PITCH_W - C.PENALTY_BOX_W, y1: C.PITCH_H / 2 - hh, x2: C.PITCH_W, y2: C.PITCH_H / 2 + hh };
}

function isInPenaltyBox(pos, teamDefending) {
  let b = getPenaltyBox(teamDefending);
  return pos.x >= b.x1 && pos.x <= b.x2 && pos.y >= b.y1 && pos.y <= b.y2;
}

// ===== UTILITY =====
function logEvent(msg, type = 'normal') {
  const logDiv = document.getElementById('match-log');
  if (!logDiv) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const timeEl = document.getElementById('match-time');
  entry.innerHTML = `<span class="log-time">[${timeEl ? timeEl.innerText : '??:??'}]</span> ${msg}`;
  logDiv.prepend(entry);
  // Keep log manageable
  while (logDiv.children.length > 200) logDiv.removeChild(logDiv.lastChild);
}

const REFEREE_NAMES = [
  'M. Oliver', 'A. Taylor', 'C. Pawson', 'P. Tierney', 'D. Coote',
  'S. Attwell', 'R. Jones', 'M. Dean', 'A. Marriner', 'J. Moss',
  'B. Kuipers', 'D. Orsato', 'F. Brych', 'C. Turpin', 'S. Marciniak'
];

// ===== ATTRIBUTE GENERATION =====
function generateAttributes(role) {
  let a = {
    finishing:   40 + Math.random() * 35,
    passing:     50 + Math.random() * 30,
    vision:      45 + Math.random() * 30,
    dribbling:   45 + Math.random() * 30,
    pace:        50 + Math.random() * 30,
    strength:    45 + Math.random() * 30,
    aggression:  30 + Math.random() * 40,
    discipline:  50 + Math.random() * 30,
    positioning: 50 + Math.random() * 30,
    composure:   45 + Math.random() * 30,
    stamina:     65 + Math.random() * 25,
    goalkeeping: 5 + Math.random() * 10,
  };

  switch (role) {
    case 'GK':
      a.goalkeeping = 70 + Math.random() * 30;
      a.finishing = 10 + Math.random() * 20;
      a.positioning = 60 + Math.random() * 30;
      a.composure = 60 + Math.random() * 30;
      a.pace = 30 + Math.random() * 30;
      a.dribbling = 15 + Math.random() * 20;
      break;
    case 'DEF':
      a.strength = 60 + Math.random() * 30;
      a.positioning = 60 + Math.random() * 30;
      a.discipline = 55 + Math.random() * 30;
      a.finishing = 20 + Math.random() * 30;
      a.aggression = 40 + Math.random() * 35;
      a.pace = 45 + Math.random() * 30;
      break;
    case 'MID':
      a.passing = 60 + Math.random() * 30;
      a.vision = 55 + Math.random() * 35;
      a.stamina = 70 + Math.random() * 25;
      a.positioning = 55 + Math.random() * 30;
      a.composure = 50 + Math.random() * 30;
      break;
    case 'FWD':
      a.finishing = 65 + Math.random() * 30;
      a.pace = 60 + Math.random() * 30;
      a.composure = 55 + Math.random() * 30;
      a.dribbling = 60 + Math.random() * 30;
      a.positioning = 55 + Math.random() * 30;
      break;
  }

  for (let k in a) a[k] = Math.min(99, Math.max(1, Math.floor(a[k])));
  return a;
}

// ===== BALL =====
class Ball {
  constructor() {
    this.pos = new Vector(C.PITCH_W / 2, C.PITCH_H / 2);
    this.vel = new Vector(0, 0);
    this.owner = null;
    this.lastTouch = null;
  }

  update() {
    if (this.owner) {
      this.lastTouch = this.owner;
      this.pos = this.owner.pos.copy();
      this.pos.x += (this.owner.team === 0 ? 10 : -10);
      this.vel.mult(0);
      return;
    }
    this.pos.add(this.vel);
    this.vel.mult(C.FRICTION);
    if (this.vel.mag() < 0.1) this.vel.mult(0);
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.ellipse(this.pos.x + 2, this.pos.y + 2, C.BALL_R, C.BALL_R * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// ===== PLAYER =====
class Player {
  constructor(team, number, role, startX, startY, color) {
    this.team = team;
    this.number = number;
    this.role = role;
    this.basePos = new Vector(startX, startY);
    this.pos = new Vector(startX, startY);
    this.vel = new Vector(0, 0);
    this.color = color;

    this.attr = generateAttributes(role);
    this.currentStamina = 100;
    this.cooldown = 0;

    // Discipline
    this.yellowCards = 0;
    this.redCard = false;
    this.sentOff = false;
    this.foulCount = 0;

    // Visual flash
    this.cardFlash = null; // { type: 'YELLOW'|'RED', timer }
  }

  get effectiveSpeed() {
    let staminaMod = 0.7 + (this.currentStamina / 100) * 0.3;
    return (this.attr.pace / 100) * C.MAX_SPEED * staminaMod;
  }

  get tacklingAbility() {
    return this.attr.strength * 0.35 + this.attr.positioning * 0.35 + this.attr.composure * 0.3;
  }

  drainStamina(sprinting = false) {
    let drain = C.STAMINA_DRAIN;
    if (sprinting) drain *= C.STAMINA_SPRINT_MULT;
    this.currentStamina = Math.max(0, this.currentStamina - drain);
  }

  update(engine) {
    if (this.sentOff) return;
    if (this.cooldown > 0) this.cooldown--;
    if (this.cardFlash) { this.cardFlash.timer--; if (this.cardFlash.timer <= 0) this.cardFlash = null; }

    let isSprinting = this.vel.mag() > this.effectiveSpeed * 0.7;
    this.drainStamina(isSprinting);

    if (engine.state !== 'PLAYING') {
      this.vel.mult(0.8);
      this.pos.add(this.vel);
      return;
    }

    let ball = engine.ball;
    let target = this.basePos.copy();
    let speedMult = this.effectiveSpeed / C.MAX_SPEED;
    let distToBall = this.pos.dist(ball.pos);

    let myTeam = engine.getActivePlayers(this.team);
    let oppTeam = engine.getActivePlayers(this.team === 0 ? 1 : 0);

    let hasPossession = ball.owner && ball.owner.team === this.team;
    let oppHasPossession = ball.owner && ball.owner.team !== this.team;

    let myTeamDist = [...myTeam].sort((a, b) => a.pos.dist(ball.pos) - b.pos.dist(ball.pos));
    let myRank = myTeamDist.indexOf(this);

    let oppGoalX = this.team === 0 ? C.PITCH_W : 0;
    let myGoalX = this.team === 0 ? 0 : C.PITCH_W;
    let goalY = C.PITCH_H / 2;
    let distToOppGoal = this.pos.dist(new Vector(oppGoalX, goalY));

    // ==================== AI ====================

    if (ball.owner === this) {
      // === I HAVE THE BALL ===

      // SHOOT — composure + finishing driven
      let composureMod = this.attr.composure / 100;
      let shootThreshold = (this.attr.finishing / 400) * composureMod;
      if (distToOppGoal < 300 && Math.random() < shootThreshold) {
        let dy = (Math.random() - 0.5) * C.GOAL_W * 0.8;
        let power = 8 + (this.attr.finishing / 15);
        let shootVec = new Vector(oppGoalX - this.pos.x, goalY + dy - this.pos.y).normalize().mult(power);
        ball.owner = null;
        ball.vel = shootVec;
        ball.lastTouch = this;
        this.cooldown = 30;
        logEvent(`💥 #${this.number} shoots!`, 'action');
        return;
      }

      // PASS — vision selects best target
      let passFreq = this.attr.passing / 1500 + this.attr.vision / 3000;
      if (Math.random() < passFreq) {
        let teammates = myTeam.filter(p => p !== this);
        let bestTarget = null;
        let bestScore = -Infinity;

        teammates.forEach(t => {
          let tDistGoal = t.pos.dist(new Vector(oppGoalX, goalY));
          let passLen = this.pos.dist(t.pos);
          let forwardness = this.team === 0 ? t.pos.x - this.pos.x : this.pos.x - t.pos.x;
          let score = forwardness * 0.5 - tDistGoal * 0.3 - passLen * 0.2;
          let nearestOpp = oppTeam.reduce((min, o) => Math.min(min, o.pos.dist(t.pos)), Infinity);
          if (nearestOpp < 30) score -= 50;
          score += (Math.random() - 0.5) * (200 - this.attr.vision * 2);
          if (score > bestScore) { bestScore = score; bestTarget = t; }
        });

        if (bestTarget) {
          // Offside check
          let offRes = engine.offsideSystem.check(this, bestTarget, engine);
          if (offRes.isOffside) {
            logEvent(`🚩 OFFSIDE! Flag against #${bestTarget.number}`, 'whistle');
            engine.triggerSetPiece('FREE_KICK', bestTarget.pos.copy(), this.team === 0 ? 1 : 0);
            engine.lastSetPieceType = null;
            return;
          }

          let accuracy = this.attr.passing / 100;
          let passVec = Vector.sub(bestTarget.pos, this.pos).normalize();
          passVec.x += (Math.random() - 0.5) * (1 - accuracy) * 0.5;
          passVec.y += (Math.random() - 0.5) * (1 - accuracy) * 0.5;
          passVec.normalize().mult(7 + this.attr.passing / 25);

          ball.owner = null;
          ball.vel = passVec;
          ball.lastTouch = this;
          this.cooldown = 20;

          // Clear set piece exception after first pass
          engine.lastSetPieceType = null;
          return;
        }
      }

      // DRIBBLE toward goal — dribbling attr affects speed
      target = new Vector(oppGoalX, goalY);
      speedMult *= 0.5 + (this.attr.dribbling / 100) * 0.3;

    } else if (ball.owner === null && distToBall < C.PICKUP_RANGE && this.cooldown <= 0) {
      // === LOOSE BALL ===

      // Handball check (rare, fast ball)
      if (ball.vel.mag() > 5 && this.role !== 'GK' && Math.random() < 0.003) {
        engine.handleHandball(this, ball);
        return;
      }

      ball.owner = this;
      ball.lastTouch = this;

    } else if (hasPossession) {
      // === MY TEAM HAS BALL ===
      let dir = this.team === 0 ? 1 : -1;

      if (this.role === 'GK') {
        target = this.basePos.copy();
      } else if (this.role === 'DEF') {
        target = this.basePos.copy();
        target.x += dir * 50;
      } else {
        let ahead = (this.team === 0 && this.pos.x > ball.pos.x) || (this.team === 1 && this.pos.x < ball.pos.x);
        if (ahead) {
          target = this.basePos.copy();
          target.x += dir * (80 + this.attr.positioning * 0.5);
        } else {
          target = ball.pos.copy();
          target.x -= dir * 60;
          target.y = this.basePos.y;
        }
      }

    } else if (oppHasPossession) {
      // === OPPONENT HAS BALL ===

      if (this.role === 'GK') {
        target = this.basePos.copy();
        target.y = ball.pos.y;
        target.y = Math.max(C.GOAL_Y, Math.min(C.GOAL_Y + C.GOAL_W, target.y));
      } else if (myRank === 0 && this.role !== 'GK') {
        // 1st presser — TACKLE
        target = ball.owner.pos.copy();
        if (distToBall < C.TACKLE_RANGE && this.cooldown <= 0) {
          // Only ~20% of close encounters are actual tackle attempts (rest is jostling/pressure)
          if (Math.random() < 0.20) {
            engine.attemptTackle(this, ball.owner);
          }
          this.cooldown = 60;
        }
      } else if (myRank === 1 && this.role !== 'GK') {
        let dirOwn = this.team === 0 ? -1 : 1;
        target = ball.owner.pos.copy();
        target.x += dirOwn * 30;
      } else {
        let nearest = [...oppTeam].sort((a, b) => a.pos.dist(this.pos) - b.pos.dist(this.pos))[0];
        if (nearest && nearest !== ball.owner) {
          let vGoal = Vector.sub(new Vector(myGoalX, goalY), nearest.pos).normalize();
          target = nearest.pos.copy().add(vGoal.mult(40));
        } else {
          let dirOwn = this.team === 0 ? -1 : 1;
          target = this.basePos.copy();
          target.x += dirOwn * 50;
        }
      }

    } else {
      // === NO ONE HAS BALL ===
      if (this.role === 'GK') {
        target = this.basePos.copy();
        target.y = ball.pos.y;
        target.y = Math.max(C.GOAL_Y, Math.min(C.GOAL_Y + C.GOAL_W, target.y));
      } else if (myRank === 0 || myRank === 1) {
        target = ball.pos.copy();
      } else {
        target = this.basePos.copy();
      }
    }

    // GK SAVE
    if (this.role === 'GK' && ball.owner === null && distToBall < 40 && ball.vel.mag() > 3) {
      if (Math.random() * 100 < this.attr.goalkeeping) {
        ball.vel.mult(-0.3);
        ball.vel.y += (Math.random() - 0.5) * 5;
        ball.lastTouch = this;
        logEvent(`🧤 Save by GK #${this.number}!`, 'action');
        this.cooldown = 15;
      }
    }

    // REPULSION
    if (this.role !== 'GK') {
      let rep = new Vector(0, 0);
      myTeam.forEach(p => {
        if (p !== this && p.role !== 'GK') {
          let d = this.pos.dist(p.pos);
          if (d < 30 && d > 0) rep.add(Vector.sub(this.pos, p.pos).normalize().mult(30 - d));
        }
      });
      target.add(rep);
    }

    // STEERING — higher limit for snappier, real-time feel
    let desired = Vector.sub(target, this.pos);
    let d = desired.mag();
    if (d > 0) {
      desired.normalize().mult(C.MAX_SPEED * speedMult);
      let steer = Vector.sub(desired, this.vel);
      steer.limit(0.35);
      this.vel.add(steer);
      this.vel.limit(C.MAX_SPEED * speedMult);
      this.pos.add(this.vel);
    } else {
      this.vel.mult(0.92);
    }

    this.pos.x = Math.max(0, Math.min(C.PITCH_W, this.pos.x));
    this.pos.y = Math.max(0, Math.min(C.PITCH_H, this.pos.y));
  }

  draw(ctx) {
    if (this.sentOff) return;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(this.pos.x, this.pos.y + C.PLAYER_R, C.PLAYER_R * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, C.PLAYER_R, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.number, this.pos.x, this.pos.y);

    // Card indicators beside player
    let cx = this.pos.x + C.PLAYER_R + 2;
    let cy = this.pos.y - C.PLAYER_R - 2;
    if (this.yellowCards >= 1) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx, cy, 5, 7);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.3;
      ctx.strokeRect(cx, cy, 5, 7);
    }
    if (this.yellowCards >= 2 || this.redCard) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx + 6, cy, 5, 7);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.3;
      ctx.strokeRect(cx + 6, cy, 5, 7);
    }

    // Card flash animation
    if (this.cardFlash) {
      let fc = this.cardFlash.type === 'YELLOW' ? '#facc15' : '#ef4444';
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.cardFlash.timer / 60);
      ctx.fillStyle = fc;
      ctx.fillRect(this.pos.x - 6, this.pos.y - 26, 12, 16);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
      ctx.strokeRect(this.pos.x - 6, this.pos.y - 26, 12, 16);
      ctx.restore();
    }

    // Stamina bar
    let bw = 14, bh = 2;
    let bx = this.pos.x - bw / 2;
    let by = this.pos.y + C.PLAYER_R + 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    let sp = this.currentStamina / 100;
    ctx.fillStyle = sp > 0.5 ? '#22c55e' : sp > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(bx, by, bw * sp, bh);
  }
}

// ===== REFEREE =====
class Referee {
  constructor() {
    this.name = REFEREE_NAMES[Math.floor(Math.random() * REFEREE_NAMES.length)];
    this.strictness = Math.floor(10 + Math.random() * 85);
    this.pos = new Vector(C.PITCH_W / 2, C.PITCH_H / 2 + 50);
    this.vel = new Vector(0, 0);
    this.showingCard = null;
    this.whistleTimer = 0;
  }

  get strictnessLabel() {
    if (this.strictness <= 40) return 'Lenient';
    if (this.strictness <= 70) return 'Normal';
    return 'Strict';
  }

  get thresholdMod() {
    return (50 - this.strictness) / 5;
  }

  showCard(type) {
    this.showingCard = { type, timer: 120 };
  }

  update(ball) {
    if (this.showingCard) { this.showingCard.timer--; if (this.showingCard.timer <= 0) this.showingCard = null; }
    if (this.whistleTimer > 0) this.whistleTimer--;

    let target = ball.pos.copy();
    target.y += 40; target.x -= 20;
    let desired = Vector.sub(target, this.pos);
    if (desired.mag() > 0) {
      desired.normalize().mult(C.MAX_SPEED * 0.9);
      let steer = Vector.sub(desired, this.vel);
      steer.limit(0.1);
      this.vel.add(steer);
      this.pos.add(this.vel);
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('R', this.pos.x, this.pos.y);

    // Card animation
    if (this.showingCard) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.showingCard.timer / 60);
      ctx.fillStyle = this.showingCard.type === 'YELLOW' ? '#facc15' : '#ef4444';
      ctx.fillRect(this.pos.x + 7, this.pos.y - 24, 10, 14);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
      ctx.strokeRect(this.pos.x + 7, this.pos.y - 24, 10, 14);
      ctx.restore();
    }

    // Whistle
    if (this.whistleTimer > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('📣', this.pos.x, this.pos.y - 14);
    }
  }
}

// ===== LINESMAN =====
class Linesman {
  constructor(isTop) {
    this.isTop = isTop;
    this.pos = new Vector(C.PITCH_W / 2, isTop ? -12 : C.PITCH_H + 12);
    this.vel = new Vector(0, 0);
    this.flagRaised = false;
    this.flagTimer = 0;
  }

  update(engine) {
    if (this.flagTimer > 0) { this.flagTimer--; if (this.flagTimer <= 0) this.flagRaised = false; }

    let tc = this.isTop ? 0 : 1;
    let tp = engine.getActivePlayers(tc);
    tp.sort((a, b) => tc === 0 ? a.pos.x - b.pos.x : b.pos.x - a.pos.x);

    let olx = C.PITCH_W / 2;
    if (tp.length > 1) olx = tp[1].pos.x;
    if (tc === 0 && olx > C.PITCH_W / 2) olx = C.PITCH_W / 2;
    if (tc === 1 && olx < C.PITCH_W / 2) olx = C.PITCH_W / 2;

    let desired = new Vector(olx - this.pos.x, 0);
    if (desired.mag() > 0) {
      desired.normalize().mult(C.MAX_SPEED);
      let steer = Vector.sub(desired, this.vel);
      steer.limit(0.2);
      this.vel.add(steer);
      this.pos.add(this.vel);
    }
  }

  raiseFlag() { this.flagRaised = true; this.flagTimer = 120; }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.stroke();

    if (this.flagRaised) {
      let fd = this.isTop ? -1 : 1;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(this.pos.x, this.pos.y + fd * 15);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y + fd * 8);
      ctx.lineTo(this.pos.x + 8, this.pos.y + fd * 11);
      ctx.lineTo(this.pos.x, this.pos.y + fd * 14);
      ctx.fill();
    }
  }
}

// ===== FOUL SYSTEM =====
class FoulSystem {
  constructor(referee) { this.referee = referee; }

  evaluateTackle(tackler, carrier, engine) {
    // Reduced multipliers → far fewer fouls (realistic ~20 per match)
    let aggrFactor = (tackler.attr.aggression / 100) * 18;
    let discFactor = ((100 - tackler.attr.discipline) / 100) * 10;
    let rndFactor = Math.random() * 10;

    let fromBehind = Math.random() < 0.06 ? 25 : 0;
    let twoFooted = Math.random() < 0.015 ? 35 : 0;
    let lateTackle = Math.random() < 0.10 ? 15 : 0;
    let strDiff = (carrier.attr.strength - tackler.attr.strength) / 100 * 3;

    let severity = aggrFactor + discFactor + fromBehind + twoFooted + lateTackle + rndFactor + strDiff;
    severity -= this.referee.thresholdMod;
    severity = Math.max(0, Math.min(100, severity));

    let result = {
      isFoul: false, tackleSuccess: false, severity,
      card: null, isPenalty: false, isDOGSO: false, reason: ''
    };

    // Clean tackle (0-40) — much wider clean zone
    if (severity <= 40) {
      let tackleScore = tackler.tacklingAbility;
      let dribbleScore = carrier.attr.dribbling * 0.6 + carrier.attr.strength * 0.4;
      let successChance = Math.max(10, Math.min(90, tackleScore - dribbleScore * 0.5 + 30));
      result.tackleSuccess = Math.random() * 100 < successChance;
      return result;
    }

    // FOUL
    result.isFoul = true;
    let defTeam = carrier.team === 0 ? 1 : 0;
    result.isPenalty = isInPenaltyBox(carrier.pos, defTeam);
    result.isDOGSO = this.isDOGSO(carrier, engine);

    // Determine card
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

    // DOGSO override if not already handled above
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

// ===== OFFSIDE SYSTEM =====
class OffsideSystem {
  check(passer, receiver, engine) {
    let lsp = engine.lastSetPieceType;
    if (lsp === 'THROW_IN' || lsp === 'GOAL_KICK' || lsp === 'CORNER') return { isOffside: false };

    let inOppHalf = passer.team === 0 ? receiver.pos.x > C.PITCH_W / 2 : receiver.pos.x < C.PITCH_W / 2;
    if (!inOppHalf) return { isOffside: false };

    // Behind ball = not offside
    let recToGoal = passer.team === 0 ? C.PITCH_W - receiver.pos.x : receiver.pos.x;
    let ballToGoal = passer.team === 0 ? C.PITCH_W - engine.ball.pos.x : engine.ball.pos.x;
    if (recToGoal >= ballToGoal) return { isOffside: false };

    // Second-last defender
    let opp = engine.getActivePlayers(passer.team === 0 ? 1 : 0);
    if (passer.team === 0) opp.sort((a, b) => b.pos.x - a.pos.x);
    else opp.sort((a, b) => a.pos.x - b.pos.x);

    let sld = opp.length > 1 ? opp[1] : opp[0];
    if (!sld) return { isOffside: false };

    let ol = sld.pos.x;
    let diff = passer.team === 0 ? receiver.pos.x - ol : ol - receiver.pos.x;
    if (diff <= 2) return { isOffside: false }; // level = ok

    return { isOffside: diff > 0, offsideLineX: ol };
  }
}

// ===== ADVANTAGE SYSTEM =====
class AdvantageSystem {
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

// ===== VAR SYSTEM =====
class VARSystem {
  constructor() {
    this.enabled = true;
    this.reviewing = false;
    this.reviewTimer = 0;
    this.reviewType = '';
    this.reviewData = null;
  }

  checkEvent(type, data, engine) {
    if (!this.enabled || this.reviewing) return false;
    let confidence = 60 + Math.random() * 40;
    if (type === 'GOAL') confidence -= 25;
    else if (type === 'PENALTY') confidence -= 20;
    else if (type === 'RED_CARD') confidence -= 15;

    if (confidence < 70) {
      this.reviewing = true;
      this.reviewTimer = 180 + Math.floor(Math.random() * 420);
      this.reviewType = type;
      this.reviewData = data;
      logEvent(`📺 VAR REVIEW: Checking ${type}…`, 'var');
      return true;
    }
    return false;
  }

  update(engine) {
    if (!this.reviewing) return null;
    this.reviewTimer--;
    if (this.reviewTimer <= 0) {
      let confirm = Math.random() < 0.8;
      let type = this.reviewType;
      let data = this.reviewData;
      this.reviewing = false;
      this.reviewType = '';
      this.reviewData = null;

      if (confirm) {
        logEvent(`📺 VAR: ✅ CONFIRMED — ${type}`, 'var');
        return { decision: 'CONFIRM', type, data };
      } else {
        logEvent(`📺 VAR: ❌ OVERTURNED — ${type}`, 'var');
        engine.handleVAROverturned(type, data);
        return { decision: 'OVERTURN', type, data };
      }
    }
    return null;
  }

  draw(ctx) {
    if (!this.reviewing) return;
    let alpha = 0.7 + Math.sin(Date.now() / 200) * 0.3;

    ctx.save();
    ctx.fillStyle = `rgba(0,0,60,${alpha * 0.85})`;
    ctx.fillRect(C.PITCH_W / 2 - 110, 8, 220, 34);
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    ctx.strokeRect(C.PITCH_W / 2 - 110, 8, 220, 34);

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`📺 VAR REVIEW: ${this.reviewType}`, C.PITCH_W / 2, 25);
    ctx.restore();

    // Scan line
    ctx.save();
    ctx.strokeStyle = `rgba(0,255,255,${0.12 * alpha})`;
    ctx.lineWidth = 1;
    let sy = (Date.now() / 10) % C.PITCH_H;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(C.PITCH_W, sy); ctx.stroke();
    ctx.restore();
  }
}

// ===== MATCH ENGINE =====
class MatchEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ball = new Ball();
    this.players = [];
    this.referee = new Referee();
    this.linesmen = [new Linesman(true), new Linesman(false)];

    this.foulSystem = new FoulSystem(this.referee);
    this.offsideSystem = new OffsideSystem();
    this.advantageSystem = new AdvantageSystem();
    this.varSystem = new VARSystem();

    this.state = 'STOPPED'; // STOPPED | PLAYING | SET_PIECE | HALF_TIME | FULL_TIME
    this.time = 0;
    this.half = 1;
    this.score = { home: 0, away: 0 };
    this.speed = 1;
    this.setPieceTimer = 0;
    this.lastSetPieceType = null;
    this.penaltyState = null;

    this.stats = {
      home: { fouls: 0, yellows: 0, reds: 0, possession: 0 },
      away: { fouls: 0, yellows: 0, reds: 0, possession: 0 }
    };
    this.possessionFrames = { home: 0, away: 0 };

    this.crowd = [];
    this.generateCrowd();
    this.setupTeams();
  }

  generateCrowd() {
    let colors = ['#ef4444','#dc2626','#3b82f6','#2563eb','#facc15','#ffffff','#9ca3af','#f97316','#22c55e'];
    for (let i = 0; i < 1000; i++) {
      let cx, cy;
      if (Math.random() > 0.5) {
        cx = Math.random() * (C.PITCH_W + 100) - 50;
        cy = Math.random() > 0.5 ? Math.random() * -45 - 20 : C.PITCH_H + 20 + Math.random() * 45;
      } else {
        cx = Math.random() > 0.5 ? Math.random() * -45 - 20 : C.PITCH_W + 20 + Math.random() * 45;
        cy = Math.random() * (C.PITCH_H + 100) - 50;
      }
      this.crowd.push({ x: cx, y: cy, color: colors[Math.floor(Math.random() * colors.length)] });
    }
  }

  getActivePlayers(team) {
    return this.players.filter(p => p.team === team && !p.sentOff);
  }

  setupTeams() {
    this.players = [];
    let hC = '#ef4444', aC = '#3b82f6';
    let hPos = [
      [50,250,'GK'],
      [200,80,'DEF'],[150,180,'DEF'],[150,320,'DEF'],[200,420,'DEF'],
      [350,100,'MID'],[300,200,'MID'],[300,300,'MID'],[350,400,'MID'],
      [420,190,'FWD'],[420,310,'FWD']
    ];
    let aPos = [
      [750,250,'GK'],
      [600,80,'DEF'],[650,180,'DEF'],[650,320,'DEF'],[600,420,'DEF'],
      [450,100,'MID'],[500,200,'MID'],[500,300,'MID'],[450,400,'MID'],
      [380,190,'FWD'],[380,310,'FWD']
    ];
    hPos.forEach((p,i) => this.players.push(new Player(0, i+1, p[2], p[0], p[1], hC)));
    aPos.forEach((p,i) => this.players.push(new Player(1, i+1, p[2], p[0], p[1], aC)));
  }

  resetKickoff() {
    this.ball.owner = null;
    this.ball.lastTouch = null;
    this.ball.pos = new Vector(C.PITCH_W/2, C.PITCH_H/2);
    this.ball.vel = new Vector(0,0);
    this.players.forEach(p => {
      if (!p.sentOff) { p.pos = p.basePos.copy(); p.vel.mult(0); p.cooldown = 0; }
    });
    this.lastSetPieceType = null;
    this.penaltyState = null;
  }

  triggerSetPiece(type, pos, teamToTake) {
    this.state = 'SET_PIECE';
    this.setPieceTimer = 90;
    this.lastSetPieceType = type;
    this.ball.owner = null;
    this.ball.vel.mult(0);
    this.ball.pos = pos.copy();
    this.advantageSystem.onStoppage(this);
    this.referee.whistleTimer = 60;

    if (type === 'PENALTY') {
      this.setupPenalty(teamToTake);
      return;
    }

    let tp = this.getActivePlayers(teamToTake).filter(p => p.role !== 'GK');
    let taker = tp.sort((a,b) => a.pos.dist(pos) - b.pos.dist(pos))[0];
    if (taker) { taker.pos = pos.copy(); this.ball.owner = taker; }
  }

  setupPenalty(teamToTake) {
    this.setPieceTimer = 180; // longer setup for penalty
    let oppTeam = teamToTake === 0 ? 1 : 0;
    let goalX = oppTeam === 0 ? 0 : C.PITCH_W;
    let spotX = oppTeam === 0 ? C.PENALTY_SPOT : C.PITCH_W - C.PENALTY_SPOT;

    this.ball.pos = new Vector(spotX, C.PITCH_H/2);
    this.ball.vel.mult(0);
    this.ball.owner = null;

    let att = this.getActivePlayers(teamToTake).filter(p => p.role !== 'GK');
    att.sort((a,b) => (b.attr.finishing + b.attr.composure) - (a.attr.finishing + a.attr.composure));
    let kicker = att[0];
    let gk = this.getActivePlayers(oppTeam).find(p => p.role === 'GK');

    this.penaltyState = { team: teamToTake, kicker, gk };

    if (kicker) kicker.pos = new Vector(spotX - (teamToTake === 0 ? 15 : -15), C.PITCH_H/2);
    if (gk) gk.pos = new Vector(goalX, C.PITCH_H/2);

    // Move others out of penalty box
    let box = getPenaltyBox(oppTeam);
    this.players.forEach(p => {
      if (p.sentOff || p === kicker || p === gk) return;
      if (p.pos.x >= box.x1 && p.pos.x <= box.x2 && p.pos.y >= box.y1 && p.pos.y <= box.y2) {
        if (oppTeam === 0) p.pos.x = box.x2 + 20;
        else p.pos.x = box.x1 - 20;
      }
    });

    logEvent(`⚽ PENALTY! #${kicker ? kicker.number : '?'} steps up`, 'penalty');
  }

  executePenalty() {
    let ps = this.penaltyState;
    if (!ps || !ps.kicker || !ps.gk) { this.penaltyState = null; this.state = 'PLAYING'; return; }

    let kicker = ps.kicker, gk = ps.gk;
    let oppTeam = ps.team === 0 ? 1 : 0;
    let goalX = oppTeam === 0 ? 0 : C.PITCH_W;

    let fScore = (kicker.attr.finishing + kicker.attr.composure) / 2;
    let gScore = gk.attr.goalkeeping;

    let zones = ['LEFT','CENTER','RIGHT'];
    let shotZone = zones[Math.floor(Math.random() * 3)];
    let gkDive = zones[Math.floor(Math.random() * 3)];
    let shotY = shotZone === 'LEFT' ? C.PITCH_H/2 - 30 : shotZone === 'RIGHT' ? C.PITCH_H/2 + 30 : C.PITCH_H/2;
    shotY += (Math.random()-0.5) * (100 - kicker.attr.composure) * 0.5;

    let dir = new Vector(goalX - this.ball.pos.x, shotY - this.ball.pos.y).normalize();
    let power = 10 + kicker.attr.finishing / 10;
    this.ball.vel = dir.mult(power);
    this.ball.owner = null;
    this.ball.lastTouch = kicker;

    let saved = false;
    if (shotZone === gkDive) {
      saved = Math.random() < gScore / 100 * 0.7;
    } else {
      saved = Math.random() < gScore / 100 * 0.1;
    }

    if (saved) {
      this.ball.vel.mult(0.1);
      this.ball.vel.y = (Math.random()-0.5) * 5;
      this.ball.lastTouch = gk;
      logEvent(`🧤 SAVED! GK #${gk.number} dives ${gkDive}!`, 'action');
    } else {
      let onTarget = Math.random() < (fScore / 100 * 0.9 + 0.1);
      if (!onTarget) {
        this.ball.vel.y += (Math.random()-0.5) * 10;
        logEvent(`💨 MISS! #${kicker.number}'s penalty goes wide!`, 'action');
      } else {
        logEvent(`💥 #${kicker.number} strikes the penalty!`, 'action');
      }
    }

    kicker.cooldown = 60;
    this.penaltyState = null;
    this.state = 'PLAYING';
  }

  // ===== TACKLE =====
  attemptTackle(tackler, carrier) {
    let result = this.foulSystem.evaluateTackle(tackler, carrier, this);

    if (!result.isFoul) {
      if (result.tackleSuccess) {
        this.ball.owner = null;
        this.ball.vel = new Vector((Math.random()-0.5)*8, (Math.random()-0.5)*8);
        this.ball.lastTouch = tackler;
        logEvent(`💪 #${tackler.number} wins the ball!`, 'action');
      } else {
        tackler.cooldown = 30;
      }
      return;
    }

    // FOUL
    tackler.foulCount++;
    let tk = tackler.team === 0 ? 'home' : 'away';
    this.stats[tk].fouls++;
    logEvent(`⚠️ FOUL by #${tackler.number} on #${carrier.number} (${result.reason})`, 'foul');

    // ADVANTAGE check (not for red cards or penalties)
    if (result.card !== 'RED' && !result.isPenalty && this.advantageSystem.evaluate(carrier.team, carrier.pos, this)) {
      logEvent(`▶️ Advantage played!`, 'advantage');
      this.advantageSystem.advantageActive = true;
      this.advantageSystem.advantageTeam = carrier.team;
      this.advantageSystem.advantageTimer = 180;
      if (result.card) {
        this.advantageSystem.pendingCards.push({ player: tackler, card: result.card, reason: result.reason });
      }
      return;
    }

    // Give card
    this.giveCard(tackler, result.card, result.reason);

    // Set piece
    this.ball.owner = null;
    if (result.isPenalty) {
      this.varSystem.checkEvent('PENALTY', { team: carrier.team }, this);
      this.triggerSetPiece('PENALTY', carrier.pos.copy(), carrier.team);
    } else {
      this.triggerSetPiece('FREE_KICK', carrier.pos.copy(), carrier.team);
    }
  }

  giveCard(player, card, reason) {
    if (!card) return;
    let tk = player.team === 0 ? 'home' : 'away';

    if (card === 'YELLOW') {
      player.yellowCards++;
      player.cardFlash = { type: 'YELLOW', timer: 90 };
      this.referee.showCard('YELLOW');
      this.stats[tk].yellows++;
      logEvent(`🟨 YELLOW CARD #${player.number}!`, 'card');

      if (player.yellowCards >= 2) {
        player.redCard = true; player.sentOff = true;
        player.cardFlash = { type: 'RED', timer: 120 };
        this.referee.showCard('RED');
        this.stats[tk].reds++;
        logEvent(`🟥 SECOND YELLOW! #${player.number} SENT OFF!`, 'red');
      }
    } else if (card === 'RED') {
      player.redCard = true; player.sentOff = true;
      player.cardFlash = { type: 'RED', timer: 120 };
      this.referee.showCard('RED');
      this.stats[tk].reds++;
      logEvent(`🟥 RED CARD! #${player.number} SENT OFF! (${reason})`, 'red');
      this.varSystem.checkEvent('RED_CARD', { player }, this);
    }
  }

  // ===== HANDBALL =====
  handleHandball(player, ball) {
    let result = this.foulSystem.evaluateHandball(player, ball.vel);
    if (!result.isFoul) {
      ball.owner = player; ball.lastTouch = player;
      return;
    }

    let tk = player.team === 0 ? 'home' : 'away';
    this.stats[tk].fouls++;
    player.foulCount++;
    logEvent(`🤚 HANDBALL by #${player.number}! (${result.reason})`, 'foul');

    this.giveCard(player, result.card, result.reason);

    let ot = player.team === 0 ? 1 : 0;
    this.ball.owner = null;
    if (result.isPenalty) {
      this.triggerSetPiece('PENALTY', ball.pos.copy(), ot);
    } else {
      this.triggerSetPiece('FREE_KICK', ball.pos.copy(), ot);
    }
  }

  // ===== VAR OVERTURN =====
  handleVAROverturned(type, data) {
    if (type === 'GOAL') {
      let t = data.team;
      this.score[t]--;
      document.getElementById(`score-${t}`).innerText = this.score[t];
      logEvent(`❌ GOAL DISALLOWED by VAR!`, 'var');
      setTimeout(() => { this.resetKickoff(); this.state = 'PLAYING'; }, 1500);
    } else if (type === 'PENALTY') {
      logEvent(`❌ PENALTY OVERTURNED by VAR`, 'var');
      this.penaltyState = null;
    } else if (type === 'RED_CARD') {
      let p = data.player;
      if (p.redCard && p.yellowCards < 2) {
        p.redCard = false; p.sentOff = false;
        p.yellowCards++;
        p.cardFlash = { type: 'YELLOW', timer: 90 };
        let tk = p.team === 0 ? 'home' : 'away';
        this.stats[tk].reds--; this.stats[tk].yellows++;
        logEvent(`📺 VAR: Red → YELLOW for #${p.number}`, 'var');
      }
    }
  }

  handleVARResult(result) {
    if (result.type === 'GOAL') {
      if (result.decision === 'CONFIRM') {
        setTimeout(() => { this.resetKickoff(); this.state = 'PLAYING'; }, 1500);
      }
      // OVERTURN already handled
    } else if (result.type === 'PENALTY') {
      if (result.decision === 'OVERTURN') {
        this.state = 'PLAYING';
      }
    } else if (result.type === 'RED_CARD') {
      // No extra action needed
    }
  }

  // ===== MAIN UPDATE =====
  update() {
    // VAR review takes priority — freezes game
    if (this.varSystem.reviewing) {
      for (let i = 0; i < this.speed; i++) {
        let r = this.varSystem.update(this);
        if (r) { this.handleVARResult(r); break; }
      }
      return;
    }

    if (this.state === 'STOPPED' || this.state === 'HALF_TIME' || this.state === 'FULL_TIME') return;

    const TIME_MULT = 30;

    for (let i = 0; i < this.speed; i++) {
      this.time += (1/60) * TIME_MULT;

      this.advantageSystem.update();

      if (this.state === 'SET_PIECE') {
        this.setPieceTimer--;
        if (this.setPieceTimer <= 0) {
          if (this.penaltyState) {
            this.executePenalty();
          } else {
            this.state = 'PLAYING';
            logEvent('▶️ Play resumes.');
          }
        }
        this.players.forEach(p => p.update(this));
        continue;
      }

      this.ball.update();
      this.players.forEach(p => p.update(this));

      if (this.state === 'PLAYING') {
        this.referee.update(this.ball);
        this.linesmen.forEach(l => l.update(this));
        this.checkBoundsAndGoals();
        this.updatePossession();
      }

      // Half / Full time
      if (this.half === 1 && this.time >= 45 * 60) {
        this.state = 'HALF_TIME';
        logEvent('🏁 HALF TIME!', 'half');
        document.getElementById('btn-start').innerText = 'Start 2nd Half';
        this.resetKickoff();
        this.players.forEach(p => { if (!p.sentOff) p.currentStamina = Math.min(100, p.currentStamina + 25); });
        this.advantageSystem.onStoppage(this);
        break;
      } else if (this.half === 2 && this.time >= 90 * 60) {
        this.state = 'FULL_TIME';
        logEvent('🏁 FULL TIME!', 'half');
        document.getElementById('btn-start').innerText = 'Match Finished';
        this.advantageSystem.onStoppage(this);
        break;
      }
    }
  }

  updatePossession() {
    if (this.ball.owner) {
      if (this.ball.owner.team === 0) this.possessionFrames.home++;
      else this.possessionFrames.away++;
    }
    let total = this.possessionFrames.home + this.possessionFrames.away;
    if (total > 0) {
      this.stats.home.possession = Math.round((this.possessionFrames.home / total) * 100);
      this.stats.away.possession = 100 - this.stats.home.possession;
    }
  }

  checkBoundsAndGoals() {
    let gyS = C.GOAL_Y, gyE = C.GOAL_Y + C.GOAL_W;

    // GOALS
    if (this.ball.pos.x < 0 && this.ball.pos.y > gyS && this.ball.pos.y < gyE) {
      this.score.away++;
      document.getElementById('score-away').innerText = this.score.away;
      logEvent('⚽ GOOOAL for AWAY! 🎉', 'goal');
      this.state = 'STOPPED';
      this.advantageSystem.onStoppage(this);
      if (!this.varSystem.checkEvent('GOAL', { team: 'away' }, this)) {
        setTimeout(() => { this.resetKickoff(); this.state = 'PLAYING'; }, 2000);
      }
      return;
    }
    if (this.ball.pos.x > C.PITCH_W && this.ball.pos.y > gyS && this.ball.pos.y < gyE) {
      this.score.home++;
      document.getElementById('score-home').innerText = this.score.home;
      logEvent('⚽ GOOOAL for HOME! 🎉', 'goal');
      this.state = 'STOPPED';
      this.advantageSystem.onStoppage(this);
      if (!this.varSystem.checkEvent('GOAL', { team: 'home' }, this)) {
        setTimeout(() => { this.resetKickoff(); this.state = 'PLAYING'; }, 2000);
      }
      return;
    }

    if (this.ball.owner) return;

    let lastTeam = this.ball.lastTouch ? this.ball.lastTouch.team : 0;
    let otherTeam = lastTeam === 0 ? 1 : 0;

    // THROW IN
    if (this.ball.pos.y < 0 || this.ball.pos.y > C.PITCH_H) {
      this.ball.pos.y = this.ball.pos.y < 0 ? 2 : C.PITCH_H - 2;
      logEvent('📐 Throw-in.', 'setpiece');
      this.triggerSetPiece('THROW_IN', this.ball.pos.copy(), otherTeam);
      return;
    }

    // GOAL KICK / CORNER
    if (this.ball.pos.x < 0) {
      if (lastTeam === 0) {
        let cy = this.ball.pos.y < C.PITCH_H/2 ? 2 : C.PITCH_H - 2;
        logEvent('🚩 Corner Kick!', 'setpiece');
        this.triggerSetPiece('CORNER', new Vector(2, cy), 1);
      } else {
        logEvent('⬆️ Goal Kick.', 'setpiece');
        this.triggerSetPiece('GOAL_KICK', new Vector(50, C.PITCH_H/2), 0);
      }
    } else if (this.ball.pos.x > C.PITCH_W) {
      if (lastTeam === 1) {
        let cy = this.ball.pos.y < C.PITCH_H/2 ? 2 : C.PITCH_H - 2;
        logEvent('🚩 Corner Kick!', 'setpiece');
        this.triggerSetPiece('CORNER', new Vector(C.PITCH_W - 2, cy), 0);
      } else {
        logEvent('⬆️ Goal Kick.', 'setpiece');
        this.triggerSetPiece('GOAL_KICK', new Vector(C.PITCH_W - 50, C.PITCH_H/2), 1);
      }
    }
  }

  // ===== DRAWING =====
  drawPitch() {
    let ctx = this.ctx;

    // Crowd
    this.crowd.forEach(c => { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, 3, 3); });

    // Grass + stripes
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, C.PITCH_W, C.PITCH_H);
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    for (let x = 0; x < C.PITCH_W; x += 80) {
      if ((x/80) % 2 === 0) ctx.fillRect(x, 0, 80, C.PITCH_H);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;

    // Outline
    ctx.strokeRect(0, 0, C.PITCH_W, C.PITCH_H);

    // Half
    ctx.beginPath(); ctx.moveTo(C.PITCH_W/2, 0); ctx.lineTo(C.PITCH_W/2, C.PITCH_H); ctx.stroke();

    // Center circle + dot
    ctx.beginPath(); ctx.arc(C.PITCH_W/2, C.PITCH_H/2, C.CENTER_CIRCLE_R, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C.PITCH_W/2, C.PITCH_H/2, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();

    // Penalty boxes
    let pbh = C.PENALTY_BOX_H, pbw = C.PENALTY_BOX_W;
    ctx.strokeRect(0, C.PITCH_H/2 - pbh/2, pbw, pbh);
    ctx.strokeRect(C.PITCH_W - pbw, C.PITCH_H/2 - pbh/2, pbw, pbh);

    // 6-yard boxes
    let syh = C.SIX_YARD_H, syw = C.SIX_YARD_W;
    ctx.strokeRect(0, C.PITCH_H/2 - syh/2, syw, syh);
    ctx.strokeRect(C.PITCH_W - syw, C.PITCH_H/2 - syh/2, syw, syh);

    // Penalty spots
    ctx.beginPath(); ctx.arc(C.PENALTY_SPOT, C.PITCH_H/2, 2, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2, 2, 0, Math.PI*2); ctx.fill();

    // Penalty arcs
    ctx.beginPath(); ctx.arc(C.PENALTY_SPOT, C.PITCH_H/2, 40, -0.7, 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2, 40, Math.PI-0.7, Math.PI+0.7); ctx.stroke();

    // Corner arcs
    ctx.beginPath(); ctx.arc(0, 0, C.CORNER_ARC_R, 0, Math.PI/2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C.PITCH_W, 0, C.CORNER_ARC_R, Math.PI/2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, C.PITCH_H, C.CORNER_ARC_R, -Math.PI/2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(C.PITCH_W, C.PITCH_H, C.CORNER_ARC_R, Math.PI, Math.PI*1.5); ctx.stroke();

    // Goals
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-5, C.GOAL_Y, 5, C.GOAL_W);
    ctx.fillRect(C.PITCH_W, C.GOAL_Y, 5, C.GOAL_W);

    // Goal nets
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.5;
    for (let y = C.GOAL_Y; y <= C.GOAL_Y + C.GOAL_W; y += 8) {
      ctx.beginPath(); ctx.moveTo(-15, y); ctx.lineTo(-5, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(C.PITCH_W+5, y); ctx.lineTo(C.PITCH_W+15, y); ctx.stroke();
    }
    for (let x = -15; x <= -5; x += 8) {
      ctx.beginPath(); ctx.moveTo(x, C.GOAL_Y); ctx.lineTo(x, C.GOAL_Y+C.GOAL_W); ctx.stroke();
    }
    for (let x = C.PITCH_W+5; x <= C.PITCH_W+15; x += 8) {
      ctx.beginPath(); ctx.moveTo(x, C.GOAL_Y); ctx.lineTo(x, C.GOAL_Y+C.GOAL_W); ctx.stroke();
    }
  }

  draw() {
    let ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(50, 50);
    ctx.scale(0.85, 0.85);

    this.drawPitch();

    // Penalty highlight
    if (this.penaltyState) {
      let ot = this.penaltyState.team === 0 ? 1 : 0;
      let box = getPenaltyBox(ot);
      ctx.fillStyle = 'rgba(255,255,0,0.08)';
      ctx.fillRect(box.x1, box.y1, box.x2-box.x1, box.y2-box.y1);
    }

    this.referee.draw(ctx);
    this.linesmen.forEach(l => l.draw(ctx));
    this.players.forEach(p => p.draw(ctx));
    this.ball.draw(ctx);

    this.varSystem.draw(ctx);
    ctx.restore();
  }
}

// ===== APP =====
let engine;
let lastTime = 0;
const FIXED_DT = 1000 / 60; // 16.67ms fixed timestep
let accumulator = 0;

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let elapsed = timestamp - lastTime;
  lastTime = timestamp;

  // Cap elapsed to prevent spiral of death on tab switch
  if (elapsed > 200) elapsed = 200;

  if (engine) {
    accumulator += elapsed;

    // Fixed-step physics for consistency
    while (accumulator >= FIXED_DT) {
      engine.update();
      accumulator -= FIXED_DT;
    }

    engine.draw();
    updateUI();
  }
  requestAnimationFrame(loop);
}

function updateUI() {
  if (!engine) return;

  let t = Math.floor(engine.time);
  let m = Math.floor(t/60), s = t % 60;
  document.getElementById('match-time').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

  document.getElementById('match-half').innerText =
    engine.state === 'FULL_TIME' ? 'Full Time' :
    engine.state === 'HALF_TIME' ? 'Half Time' :
    engine.half === 1 ? '1st Half' : '2nd Half';

  // Stats
  document.getElementById('stat-home-fouls').innerText = engine.stats.home.fouls;
  document.getElementById('stat-home-yellows').innerText = engine.stats.home.yellows;
  document.getElementById('stat-home-reds').innerText = engine.stats.home.reds;
  document.getElementById('stat-home-possession').innerText = engine.stats.home.possession + '%';
  document.getElementById('stat-away-fouls').innerText = engine.stats.away.fouls;
  document.getElementById('stat-away-yellows').innerText = engine.stats.away.yellows;
  document.getElementById('stat-away-reds').innerText = engine.stats.away.reds;
  document.getElementById('stat-away-possession').innerText = engine.stats.away.possession + '%';

  // Referee
  let refEl = document.getElementById('referee-name');
  let strEl = document.getElementById('referee-strictness');
  if (refEl) refEl.innerText = engine.referee.name;
  if (strEl) {
    strEl.innerText = engine.referee.strictnessLabel + ` (${engine.referee.strictness})`;
    strEl.className = `strictness-${engine.referee.strictnessLabel.toLowerCase()}`;
  }

  // VAR toggle
  let vb = document.getElementById('btn-var-toggle');
  if (vb) {
    vb.innerText = engine.varSystem.enabled ? 'VAR: ON' : 'VAR: OFF';
    if (engine.varSystem.enabled) vb.classList.add('active'); else vb.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('pitch');
  canvas.width = 900; canvas.height = 600;
  engine = new MatchEngine(canvas);
  engine.draw();
  requestAnimationFrame(loop);

  document.getElementById('btn-start').addEventListener('click', e => {
    if (engine.state === 'STOPPED') {
      engine.state = 'PLAYING'; e.target.innerText = 'Pause';
      logEvent('⚽ Kickoff!', 'action');
    } else if (engine.state === 'PLAYING') {
      engine.state = 'STOPPED'; e.target.innerText = 'Resume';
    } else if (engine.state === 'HALF_TIME') {
      engine.state = 'PLAYING'; engine.half = 2;
      e.target.innerText = 'Pause';
      logEvent('⚽ Second Half Kickoff!', 'action');
    }
  });

  [1,2,5,10].forEach(s => {
    document.getElementById(`btn-speed-${s}x`).addEventListener('click', e => {
      engine.speed = s;
      document.querySelectorAll('.controls button').forEach(b => { if (b.id.startsWith('btn-speed')) b.classList.remove('active'); });
      e.target.classList.add('active');
    });
  });

  document.getElementById('btn-var-toggle').addEventListener('click', () => {
    engine.varSystem.enabled = !engine.varSystem.enabled;
  });
});
