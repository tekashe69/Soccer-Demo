import Phaser from 'phaser';

// =====================================================================
// 2D FOOTBALL MATCH ENGINE v5.1 (Phaser 3 + Z-Axis Physics & Tuning)
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
  FRICTION: 0.95, // Increased friction so ball stops sooner
  MAX_SPEED: 2.2, // Slightly slower players
  MAX_BALL_SPEED: 12,
  GRAVITY: 0.25,  // Z-axis gravity
  BOUNCE: 0.5,    // Z-axis bounce retention
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
  while (logDiv.children.length > 200) logDiv.removeChild(logDiv.lastChild);
}

const REFEREE_NAMES = [
  'M. Oliver', 'A. Taylor', 'C. Pawson', 'P. Tierney', 'D. Coote',
  'S. Attwell', 'R. Jones', 'M. Dean', 'A. Marriner', 'J. Moss'
];

function generateAttributes(role) {
  let a = {
    finishing:   5 + Math.random() * 10,
    passing:     8 + Math.random() * 8,
    vision:      8 + Math.random() * 8,
    dribbling:   8 + Math.random() * 8,
    pace:        10 + Math.random() * 7,
    strength:    8 + Math.random() * 8,
    aggression:  5 + Math.random() * 10,
    discipline:  8 + Math.random() * 10,
    positioning: 10 + Math.random() * 8,
    composure:   8 + Math.random() * 8,
    stamina:     12 + Math.random() * 6,
    goalkeeping: 1 + Math.random() * 4,
    heading:     8 + Math.random() * 8,
    height:      170 + Math.random() * 25,
  };

  switch (role) {
    case 'GK':
      a.goalkeeping = 12 + Math.random() * 8;
      a.finishing = 1 + Math.random() * 4;
      a.positioning = 12 + Math.random() * 6;
      a.composure = 12 + Math.random() * 6;
      a.pace = 5 + Math.random() * 7;
      a.dribbling = 2 + Math.random() * 4;
      break;
    case 'DEF':
      a.strength = 12 + Math.random() * 6;
      a.positioning = 12 + Math.random() * 6;
      a.discipline = 10 + Math.random() * 8;
      a.finishing = 4 + Math.random() * 5;
      a.aggression = 8 + Math.random() * 8;
      a.pace = 8 + Math.random() * 7;
      a.heading = 12 + Math.random() * 8;
      a.height = 180 + Math.random() * 15;
      break;
    case 'MID':
      a.passing = 12 + Math.random() * 6;
      a.vision = 12 + Math.random() * 7;
      a.stamina = 14 + Math.random() * 6;
      a.dribbling = 10 + Math.random() * 8;
      a.composure = 10 + Math.random() * 8;
      break;
    case 'FWD':
      a.finishing = 12 + Math.random() * 8;
      a.pace = 12 + Math.random() * 8;
      a.dribbling = 12 + Math.random() * 6;
      a.composure = 12 + Math.random() * 6;
      a.positioning = 12 + Math.random() * 6;
      a.heading = 10 + Math.random() * 8;
      break;
  }
  for (let k in a) a[k] = Math.min(20, Math.max(1, Math.round(a[k])));
  return a;
}

// ===== BALL =====
class Ball {
  constructor() {
    this.pos = new Vector(C.PITCH_W / 2, C.PITCH_H / 2);
    this.z = 0;   // Height (0 = ground)
    this.vel = new Vector(0, 0);
    this.vz = 0;  // Vertical velocity
    this.owner = null;
    this.lastTouch = null;
  }
  
  initGraphics(scene, container) {
    this.graphics = scene.add.graphics();
    container.add(this.graphics);
  }

  update() {
    if (this.owner) {
      this.lastTouch = this.owner;
      this.pos = this.owner.pos.copy();
      this.pos.x += (this.owner.team === 0 ? 10 : -10);
      this.vel.mult(0);
      this.z = 0;
      this.vz = 0;
      return;
    }
    
    // XY movement
    this.pos.add(this.vel);
    
    // Friction only fully applies if ball is on ground. Less friction in air.
    if (this.z > 0) {
       this.vel.mult(0.99); // Air resistance
    } else {
       this.vel.mult(C.FRICTION); // Ground friction
    }
    
    if (this.vel.mag() < 0.1 && this.z <= 0) this.vel.mult(0);

    // Z movement
    if (this.z > 0 || this.vz > 0) {
      this.z += this.vz;
      this.vz -= C.GRAVITY;

      // Ground bounce
      if (this.z <= 0) {
        this.z = 0;
        this.vz = -this.vz * C.BOUNCE;
        if (this.vz < 0.5) this.vz = 0; // stop bouncing
      }
    }
  }

  draw() {
    let g = this.graphics;
    g.clear();
    
    // Shadow (stays at ground level, scales with height)
    let shadowScale = Math.max(0.2, 1 - (this.z / 100));
    g.fillStyle(0x000000, 0.4 * shadowScale);
    g.fillEllipse(this.pos.x + 4, this.pos.y + 4, C.BALL_R * 2 * shadowScale, C.BALL_R * 1.2 * shadowScale);

    // Body (drawn higher up based on Z)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(this.pos.x, this.pos.y - this.z, C.BALL_R);
    
    // Classic soccer ball pattern dot
    g.fillStyle(0x222222, 1);
    g.fillCircle(this.pos.x + 1, this.pos.y - this.z + 1, C.BALL_R * 0.4);

    g.lineStyle(1, 0x333333, 1);
    g.strokeCircle(this.pos.x, this.pos.y - this.z, C.BALL_R);
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
    this.colorHex = parseInt(color.replace('#', '0x'));

    this.attr = generateAttributes(role);
    this.currentStamina = 100;
    this.cooldown = 0;

    this.yellowCards = 0;
    this.redCard = false;
    this.sentOff = false;
    this.foulCount = 0;
    this.cardFlash = null;
  }

  initGraphics(scene, container) {
    this.graphics = scene.add.graphics();
    container.add(this.graphics);
    this.textObj = scene.add.text(0, 0, this.number.toString(), {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#fff'
    }).setOrigin(0.5);
    container.add(this.textObj);
  }

  get effectiveSpeed() {
    let staminaMod = 0.7 + (this.currentStamina / 100) * 0.3;
    return (this.attr.pace / 20) * C.MAX_SPEED * staminaMod;
  }

  get tacklingAbility() {
    return this.attr.strength * 1.75 + this.attr.positioning * 1.75 + this.attr.composure * 1.5;
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

    let ball = engine.ball;
    
    // Reset GK holding timer if goalkeeper no longer has possession
    if (ball.owner !== this) {
      this.gkHoldTimer = 0;
    }

    let mentality = (this.team === 0) ? engine.homeMentality : 'Balanced';
    let tactic = (this.team === 0) ? engine.homeTactic : 'Mixed';

    let isSprinting = this.vel.mag() > this.effectiveSpeed * 0.7;
    // Gegenpress is highly fatiguing
    this.drainStamina(isSprinting || (tactic === 'Gegenpress' && this.team === 0));

    if (engine.state !== 'PLAYING') {
      this.vel.mult(0.8);
      this.pos.add(this.vel);
      return;
    }

    let target = this.basePos.copy();
    let speedMult = this.effectiveSpeed / C.MAX_SPEED;
    
    // Ignore ball if it's flying high overhead
    let ballPickupDistance = C.PICKUP_RANGE;
    if (ball.z > 20) ballPickupDistance = 0; 
    let distToBallGround = this.pos.dist(ball.pos);

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

    if (ball.owner === this) {
      // ============================================================
      // BALL CARRIER: Vision-based decision tree
      // ============================================================
      
      // --- GOALKEEPER HOLDING BALL (3.5s Rule) ---
      if (this.role === 'GK') {
        let isPassBack = ball.lastTouch && ball.lastTouch.team === this.team && ball.lastTouch !== this;
        if (!isPassBack && isInPenaltyBox(this.pos, this.team)) {
          if (this.gkHoldTimer === undefined || this.gkHoldTimer <= 0) {
            this.gkHoldTimer = 210; // 3.5 seconds in-game at 60fps
            logEvent(`🧤 GK #${this.number} gathers the ball in hands (3.5s)`, 'action');
          }
          this.gkHoldTimer--;

          this.vel.mult(0.5);
          ball.pos = new Vector(this.pos.x + (this.team === 0 ? 8 : -8), this.pos.y);
          ball.z = 10;
          ball.vz = 0;
          ball.vel.mult(0);

          let minHoldTime = 90; // 1.5 seconds min hold for realism
          let holdDuration = 600 - this.gkHoldTimer;
          if (this.gkHoldTimer <= 0 || (holdDuration > minHoldTime && Math.random() < 0.025)) {
            let teammates = myTeam.filter(p => p !== this);
            let shortThrow = Math.random() < 0.3; // 30% short throw, 70% long punt
            let targetPlayer = null;

            if (shortThrow && teammates.length > 0) {
              // Find the nearest teammate
              targetPlayer = [...teammates].sort((a,b) => this.pos.dist(a.pos) - this.pos.dist(b.pos))[0];
              // If they are too far (> 220px), do not use short throw
              if (this.pos.dist(targetPlayer.pos) > 220) {
                targetPlayer = null;
              }
            }

            if (targetPlayer) {
              let passVec = Vector.sub(targetPlayer.pos, this.pos).normalize();
              let passLen = this.pos.dist(targetPlayer.pos);
              let power = 4 + (passLen / 80);
              power = Math.min(8, power);
              passVec.mult(power);
              ball.owner = null;
              ball.vel = passVec;
              ball.vz = 0; // low throw
              ball.lastTouch = this;
              this.cooldown = 40;
              this.gkHoldTimer = 0;
              logEvent(`🧤 GK #${this.number} rolls a short throw to #${targetPlayer.number}`, 'action');
            } else {
              // Long random punt down the pitch towards opponent's goal!
              let targetX = this.team === 0 ? C.PITCH_W * 0.75 : C.PITCH_W * 0.25;
              let targetY = C.PITCH_H / 2 + (Math.random() - 0.5) * C.PITCH_H * 0.6;
              let puntTarget = new Vector(targetX, targetY);
              
              let passVec = Vector.sub(puntTarget, this.pos).normalize();
              passVec.x += (Math.random() - 0.5) * 0.25;
              passVec.y += (Math.random() - 0.5) * 0.25;
              passVec.normalize();
              
              let power = 10 + Math.random() * 2; // strong punt
              passVec.mult(power);
              
              ball.owner = null;
              ball.vel = passVec;
              ball.vz = 10 + Math.random() * 2; // very high flight to clear immediate players
              ball.lastTouch = this;
              this.cooldown = 45;
              this.gkHoldTimer = 0;
              logEvent(`🧤 GK #${this.number} punts the ball long downfield!`, 'action');
            }
          }
          return;
        } else {
          // Pass back or outside penalty box: must play with feet!
          this.gkHoldTimer = 0;
        }
      }

      let oppGoalPos = new Vector(oppGoalX, goalY);

      // How many opponents are nearby? (threat level)
      let nearbyOpp = oppTeam.filter(o => o.pos.dist(this.pos) < 60).length;
      let pressured = nearbyOpp >= 2;
      let heavilyPressured = nearbyOpp >= 3;

      // How open is space ahead?
      let aheadX = this.team === 0 ? this.pos.x + 80 : this.pos.x - 80;
      let spaceAhead = oppTeam.filter(o => Math.abs(o.pos.x - aheadX) < 40 && Math.abs(o.pos.y - this.pos.y) < 50).length === 0;

      // === SHOOTING ===
      let composureMod = this.attr.composure / 20;
      let finishingMod = this.attr.finishing / 20;
      
      let blockerCount = oppTeam.filter(o => {
        let toGoal = Vector.sub(oppGoalPos, this.pos);
        let toOpp = Vector.sub(o.pos, this.pos);
        let dot = (toGoal.x * toOpp.x + toGoal.y * toOpp.y) / (toGoal.mag() * Math.max(toOpp.mag(), 0.01));
        return dot > 0.82 && toOpp.mag() < distToOppGoal;
      }).length;
      
      let shootZone = distToOppGoal < 180;
      let dangerZone = distToOppGoal < 90;
      let longShootZone = distToOppGoal < 300 && distToOppGoal >= 180;
      
      let willShoot = false;
      let isLongShot = false;

      // Both FWD and MID can shoot
      if (this.role === 'FWD' || this.role === 'MID') {
        if (dangerZone) {
          // Close snap shot: shoot immediately! Ignore blockers
          willShoot = Math.random() < 0.22;
        } else if (shootZone) {
          // Inside penalty area: shoot if clear or with moderate probability if blocked
          let baseChance = (blockerCount <= 1) ? 0.08 : 0.035;
          willShoot = Math.random() < (baseChance * finishingMod * composureMod);
        } else if (longShootZone && (tactic !== 'Tiki Taka' || Math.random() < 0.15)) {
          // Outside box: take a long shot if path is relatively clear
          // Midfielders take long shots!
          let longShotChance = (this.role === 'MID' ? 0.022 : 0.016) * finishingMod * composureMod;
          if (blockerCount <= 2 && Math.random() < longShotChance) {
            willShoot = true;
            isLongShot = true;
          }
        }
      }

      if (willShoot) {
        let accuracy = 0.35 + (this.attr.finishing / 20) * 0.6;
        let maxDev = C.GOAL_W * 1.2 * (1 - accuracy);
        let dy = (Math.random() - 0.5) * maxDev;
        let basePower = isLongShot ? 7.5 : 6;
        let power = basePower + (this.attr.finishing / 20) * 4 + (this.attr.strength / 20) * 2;
        let shootVec = Vector.sub(oppGoalPos, this.pos);
        shootVec.y += dy;
        shootVec.normalize().mult(power);

        ball.owner = null;
        ball.vel = shootVec;
        
        if (isLongShot) {
          ball.vz = 2.5 + Math.random() * 2.5; // Top spin simulation (low dipping path)
          logEvent(`💥 Midfielder #${this.number} lets fly from distance!`, 'action');
        } else {
          ball.vz = Math.random() * 1.5;
          logEvent(`💥 #${this.number} shoots from inside the box!`, 'action');
        }
        ball.lastTouch = this;
        this.cooldown = 40;
        return;
      }

      // === CROSSING ===
      let isWide = this.pos.y < C.PITCH_H * 0.2 || this.pos.y > C.PITCH_H * 0.8;
      let inFinalThird = this.team === 0 ? this.pos.x > C.PITCH_W * 0.65 : this.pos.x < C.PITCH_W * 0.35;
      
      if (isWide && inFinalThird && Math.random() < 0.20) {
         let crossTarget = new Vector(oppGoalX + (this.team === 0 ? -40 : 40), C.PITCH_H/2 + (Math.random()-0.5)*80);
         let crossVec = Vector.sub(crossTarget, this.pos).normalize();
         let passLen = this.pos.dist(crossTarget);
         let power = 5 + (passLen / 80);
         crossVec.mult(power);
         
         ball.owner = null;
         ball.vel = crossVec;
         let flightTime = passLen / power;
         ball.vz = Math.min(10, (flightTime * C.GRAVITY) / 1.5); // High cross
         ball.lastTouch = this;
         this.cooldown = 40;
         logEvent(`🔄 #${this.number} swings a cross into the box!`, 'action');
         return;
      }

      // === PASSING ===
      let passFreq = heavilyPressured ? 0.12 : pressured ? 0.06 : 0.008;
      if (tactic === 'Tiki Taka') {
        passFreq = heavilyPressured ? 0.22 : pressured ? 0.15 : 0.06;
      }

      if (Math.random() < passFreq) {
        let teammates = myTeam.filter(p => p !== this);
        let bestTarget = null;
        let bestScore = -Infinity;

        teammates.forEach(t => {
          let tDistGoal = t.pos.dist(oppGoalPos);
          let passLen = this.pos.dist(t.pos);
          if (passLen > 350) return; // Don't try ridiculous passes
          
          let forwardness = this.team === 0 ? t.pos.x - this.pos.x : this.pos.x - t.pos.x;
          // Tiki Taka allows backward passes to keep possession; other tactics reject backward passes
          if (tactic !== 'Tiki Taka' && forwardness < -20 && !heavilyPressured) return;
          if (tactic === 'Tiki Taka' && passLen > 200) return; // Short pass rule

          let nearestOppToT = oppTeam.reduce((min, o) => Math.min(min, o.pos.dist(t.pos)), Infinity);
          if (nearestOppToT < 25) return; // Target marked too tightly

          let score = 0;
          if (heavilyPressured) {
            score = nearestOppToT * 1.5 - passLen * 0.2;
          } else {
            score = forwardness * 0.6 - tDistGoal * 0.2 - passLen * 0.1 + nearestOppToT * 0.3;
            // Bias towards wide players
            let isTargetWide = t.pos.y < C.PITCH_H * 0.2 || t.pos.y > C.PITCH_H * 0.8;
            if (isTargetWide) score += 20; 
          }
          score += (Math.random() - 0.5) * (20 - this.attr.vision) * 1.5;
          if (score > bestScore) { bestScore = score; bestTarget = t; }
        });

        if (bestTarget) {
          let offRes = engine.offsideSystem.check(this, bestTarget, engine);
          if (offRes.isOffside) {
            logEvent(`🚩 OFFSIDE! Flag against #${bestTarget.number}`, 'whistle');
            engine.ball.owner = null;
            engine.ball.vel.mult(0);
            engine.ball.z = 0;
            engine.ball.vz = 0;
            engine.triggerSetPiece('FREE_KICK', offRes.offsidePos, this.team === 0 ? 1 : 0);
            return;
          }

          let accuracy = 0.4 + (this.attr.passing / 20) * 0.5;
          let passVec = Vector.sub(bestTarget.pos, this.pos).normalize();
          passVec.x += (Math.random() - 0.5) * (1 - accuracy) * 0.8;
          passVec.y += (Math.random() - 0.5) * (1 - accuracy) * 0.8;
          let passLen = this.pos.dist(bestTarget.pos);
          let power = 4 + (passLen / 100);
          power = Math.min(9, power * (0.8 + (this.attr.passing / 20) * 0.4));
          passVec.normalize().mult(power);
          ball.owner = null;
          ball.vel = passVec;
          if (passLen > 150 && Math.random() < (this.attr.vision / 20)) {
            let flightTime = passLen / power;
            ball.vz = Math.min(8, (flightTime * C.GRAVITY) / 2);
          } else {
            ball.vz = 0;
          }
          ball.lastTouch = this;
          this.cooldown = 25;
          engine.lastSetPieceType = null;
          return;
        }
      }

      // === DRIBBLE (DEFAULT) ===
      speedMult *= 0.6 + (this.attr.dribbling / 20) * 0.3;
      if (spaceAhead && !pressured) {
        target = oppGoalPos.copy();
      } else if (pressured && !heavilyPressured) {
        let sideStep = (this.pos.y < goalY) ? 30 : -30;
        target = new Vector(this.pos.x + (this.team === 0 ? 20 : -20), this.pos.y + sideStep);
      } else {
        target = new Vector(this.pos.x + (this.team === 0 ? 5 : -5), this.pos.y);
      }

    } else if (ball.owner === null && distToBallGround < 35 && this.cooldown <= 0 && ball.z >= 20 && ball.z < 80) {
      // === HEADER LOGIC ===
      let winProb = (this.attr.heading / 20) * 0.6 + (this.attr.height / 200) * 0.4;
      if (Math.random() < winProb) {
         let oppGoalX = this.team === 0 ? C.PITCH_W : 0;
         let oppGoalPos = new Vector(oppGoalX, C.PITCH_H / 2);
         let distToGoal = this.pos.dist(oppGoalPos);
         if (distToGoal < 180 && Math.random() < 0.6) {
            let power = 4 + (this.attr.heading / 20) * 4;
            let dir = Vector.sub(oppGoalPos, this.pos).normalize().mult(power);
            ball.vel = dir;
            ball.vz = Math.random() * 2;
            logEvent(`🎯 #${this.number} wins the header and shoots!`, 'action');
         } else {
            let targetTeam = engine.players.filter(p => p.team === this.team && p !== this);
            let target = targetTeam.sort((a,b) => this.pos.dist(a.pos) - this.pos.dist(b.pos))[0];
            if (target) {
               let dir = Vector.sub(target.pos, this.pos).normalize().mult(4);
               ball.vel = dir;
            } else {
               ball.vel = new Vector(this.team === 0 ? 5 : -5, (Math.random()-0.5)*5);
            }
            logEvent(`⚽ #${this.number} wins the header.`, 'action');
         }
         ball.lastTouch = this;
         this.cooldown = 20;
      } else {
         this.cooldown = 15; // Failed header duel
      }
    } else if (ball.owner === null && distToBallGround < ballPickupDistance && this.cooldown <= 0 && ball.z < 20) {
      if (ball.vel.mag() > 5 && this.role !== 'GK' && Math.random() < 0.003) {
        engine.handleHandball(this, ball);
        return;
      }
      ball.owner = this;
      ball.lastTouch = this;
      if (this.role === 'GK' && isInPenaltyBox(this.pos, this.team)) {
        this.gkHoldTimer = 600;
        logEvent(`🧤 GK #${this.number} gathers the ball in hands`, 'action');
      }

    } else if (hasPossession) {
      // ============================================================
      // IN POSSESSION (Dynamic Home Positions & Mentality)
      // ============================================================
      let dir = this.team === 0 ? 1 : -1;
      let ballX = ball.owner.pos.x;
      if (ball.owner.role === 'GK') {
        ballX = this.team === 0 ? C.PITCH_W * 0.45 : C.PITCH_W * 0.55; // Push up to prepare for GK punt
      }
      let homePos = this.basePos.copy();

      // Team pushes up based on ball location and Mentality
      let pushLimit = C.PITCH_W * 0.6;
      if (this.team === 0) {
        if (mentality === 'Attack') pushLimit = C.PITCH_W * 0.78;
        if (mentality === 'Defend') pushLimit = C.PITCH_W * 0.42;
      }
      
      // Prevent defenders/midfielders from pushing out of bounds
      let pushX = this.team === 0 
        ? Math.max(80, Math.min(ballX - 100, pushLimit)) 
        : Math.min(C.PITCH_W - 80, Math.max(ballX + 100, C.PITCH_W * 0.4));
      
      if (this.role === 'DEF') {
        let defMaxX = this.team === 0 ? (mentality === 'Attack' ? C.PITCH_W * 0.6 : mentality === 'Defend' ? C.PITCH_W * 0.3 : C.PITCH_W * 0.45) : C.PITCH_W * 0.55;
        homePos.x = this.team === 0 ? Math.min(pushX, defMaxX) : Math.max(pushX, C.PITCH_W * 0.55);
      }
      if (this.role === 'MID') {
        homePos.x = pushX;
      }
      if (this.role === 'FWD') {
        let fwdMaxX = this.team === 0 ? (mentality === 'Attack' ? C.PITCH_W * 0.92 : mentality === 'Defend' ? C.PITCH_W * 0.72 : C.PITCH_W * 0.85) : C.PITCH_W * 0.15;
        homePos.x = this.team === 0 ? Math.min(ballX + 150, fwdMaxX) : Math.max(ballX - 150, C.PITCH_W * 0.15);
      }

      if (this.role === 'GK') {
        let dist = this.pos.dist(ball.owner.pos);
        target = dist > 300 ? new Vector(this.basePos.x + dir * 25, this.basePos.y) : this.basePos.copy();
      } else if (this.role === 'FWD') {
        let inFinalThird = this.team === 0 ? ballX > C.PITCH_W * 0.6 : ballX < C.PITCH_W * 0.4;
        if (inFinalThird) {
           let fwdRank = myTeam.filter(p => p.role === 'FWD').indexOf(this);
           let channelY = fwdRank === 0 ? C.PITCH_H * 0.3 : C.PITCH_H * 0.7;
           let runX = this.team === 0 ? Math.min(C.PITCH_W - 50, oppGoalX - 80) : Math.max(50, oppGoalX + 80);
           target = new Vector(runX, channelY);
        } else {
           target = homePos;
        }
      } else {
        let isGkHolding = ball.owner && ball.owner.role === 'GK' && ball.owner.gkHoldTimer > 0;
        if (isGkHolding) {
          let outfield = myTeam.filter(p => p.role !== 'GK');
          let supporterIdx = [...outfield].sort((a, b) => a.pos.dist(ball.pos) - b.pos.dist(ball.pos)).indexOf(this);
          if (supporterIdx < 2) {
             target = new Vector(ball.owner.pos.x + (this.team === 0 ? 60 : -60), ball.owner.pos.y + (supporterIdx === 0 ? -60 : 60));
          } else {
             target = homePos;
          }
        } else if (tactic === 'Tiki Taka' && this.team === 0 && this.role !== 'GK') {
          target = new Vector(homePos.x * 0.6 + ball.pos.x * 0.4, homePos.y * 0.6 + ball.pos.y * 0.4);
        } else {
          let outfield = myTeam.filter(p => p.role !== 'GK' && p !== ball.owner);
          let supporterIdx = [...outfield].sort((a, b) => a.pos.dist(ball.owner.pos) - b.pos.dist(ball.owner.pos)).indexOf(this);
          if (supporterIdx < 2 && ball.owner.pos.dist(this.pos) > 50) {
             // 2 nearest teammates approach ball carrier to offer short pass
             target = new Vector(ball.owner.pos.x + (this.team === 0 ? -30 : 30), ball.owner.pos.y + (supporterIdx === 0 ? -50 : 50));
          } else {
             target = homePos;
          }
        }
      }

    } else if (oppHasPossession) {
      // ============================================================
      // OUT OF POSSESSION (Compact Defending & Tactics)
      // ============================================================
      let oppCarrier = ball.owner;
      let ballX = oppCarrier.pos.x;
      let homePos = this.basePos.copy();
      
      let isGkHolding = oppCarrier && oppCarrier.role === 'GK' && oppCarrier.gkHoldTimer > 0;

      // Drop back lines: symmetric and bounded
      let minDrop = (tactic === 'Low Block' && this.team === 0) ? C.PITCH_W * 0.08 : C.PITCH_W * 0.15;
      let dropX = this.team === 0 
        ? Math.max(minDrop, Math.min(ballX - 150, C.PITCH_W * 0.55)) 
        : Math.min(C.PITCH_W * 0.92, Math.max(ballX + 150, C.PITCH_W * 0.45));
        
      if (this.role === 'DEF') homePos.x = this.team === 0 ? Math.max(dropX, C.PITCH_W * 0.1) : Math.min(dropX, C.PITCH_W * 0.9);
      if (this.role === 'MID') homePos.x = this.team === 0 ? Math.max(dropX + 130, C.PITCH_W * 0.25) : Math.min(dropX - 130, C.PITCH_W * 0.75);
      if (this.role === 'FWD') homePos.x = this.team === 0 ? Math.max(dropX + 250, C.PITCH_W * 0.4) : Math.min(dropX - 250, C.PITCH_W * 0.6);

      if (this.role === 'GK') {
        let gkY = Math.max(C.GOAL_Y + 5, Math.min(C.GOAL_Y + C.GOAL_W - 5, oppCarrier.pos.y));
        target = new Vector(this.basePos.x, gkY);
      } else {
        let outfield = myTeam.filter(p => p.role !== 'GK');
        let presserIdx = [...outfield].sort((a, b) => a.pos.dist(ball.pos) - b.pos.dist(ball.pos)).indexOf(this);
        
        let maxPressers = (tactic === 'Gegenpress' && this.team === 0) ? 4 : (tactic === 'Low Block' && this.team === 0) ? 1 : (this.role === 'FWD' ? 1 : 2);
        let isPresser = presserIdx < maxPressers;

        // Low Block tactics do not press in opponent's half
        if (tactic === 'Low Block' && this.team === 0 && ball.pos.x > C.PITCH_W * 0.45) {
          isPresser = false;
        }

        // 1 player presses GK holding ball from a distance (3 meters ~ 45px)
        if (isGkHolding) {
          if (presserIdx === 0) {
            isPresser = true;
          } else {
            isPresser = false;
          }
        }

        if (isPresser && distToBallGround < 300) {
           target = oppCarrier.pos.copy();
           if (isGkHolding) {
             let standOff = Vector.sub(this.pos, oppCarrier.pos);
             if (standOff.mag() === 0) standOff = new Vector((this.team === 0 ? -1 : 1), 0);
             standOff.normalize().mult(45);
             target.add(standOff);
           } else {
             let tackleRate = (tactic === 'Gegenpress' && this.team === 0) ? 0.45 : 0.2;
             if (distToBallGround < C.TACKLE_RANGE && this.cooldown <= 0 && Math.random() < tackleRate) {
               engine.attemptTackle(this, oppCarrier);
               this.cooldown = (tactic === 'Gegenpress' && this.team === 0) ? 40 : 60;
             }
           }
        } else {
           // Hold compact defensive shape, stay goal-side of attackers
           let nearestOpp = [...oppTeam].sort((a, b) => a.pos.dist(this.pos) - b.pos.dist(this.pos))[0];
           if (nearestOpp && nearestOpp.role !== 'GK' && nearestOpp.pos.dist(homePos) < 150) {
             let goalDir = Vector.sub(new Vector(myGoalX, goalY), nearestOpp.pos).normalize();
             target = nearestOpp.pos.copy().add(goalDir.mult(20)); // Stay 20px goal-side
             target.x = this.team === 0 ? Math.max(target.x, homePos.x) : Math.min(target.x, homePos.x); // Maintain depth
           } else {
             target = homePos;
           }
        }
      }

    } else {
      // ============================================================
      // LOOSE BALL
      // ============================================================
      let homePos = this.basePos.copy();
      if (this.role === 'GK') {
        let gkY = Math.max(C.GOAL_Y + 5, Math.min(C.GOAL_Y + C.GOAL_W - 5, ball.pos.y));
        target = new Vector(this.basePos.x, gkY);
      } else if (myRank === 0) {
        let interceptTime = distToBallGround / (C.MAX_SPEED * 1.2);
        let predictedX = ball.pos.x + ball.vel.x * interceptTime;
        let predictedY = ball.pos.y + ball.vel.y * interceptTime;
        predictedX = Math.max(20, Math.min(C.PITCH_W - 20, predictedX));
        predictedY = Math.max(20, Math.min(C.PITCH_H - 20, predictedY));
        target = new Vector(predictedX, predictedY);
      } else {
        let ballX = ball.pos.x;
        let pushX = this.team === 0 ? Math.min(ballX - 50, C.PITCH_W * 0.5) : Math.max(ballX + 50, C.PITCH_W * 0.5);
        if (this.role === 'DEF') homePos.x = this.team === 0 ? Math.min(pushX, C.PITCH_W * 0.3) : Math.max(pushX, C.PITCH_W * 0.7);
        if (this.role === 'MID') homePos.x = pushX;
        if (this.role === 'FWD') homePos.x = this.team === 0 ? Math.min(ballX + 100, C.PITCH_W * 0.7) : Math.max(ballX - 100, C.PITCH_W * 0.3);
        target = homePos;
      }
    }

    // GK SAVE (Checks 3D position now)
    if (this.role === 'GK' && ball.owner === null && distToBallGround < 40 && ball.vel.mag() > 2 && ball.z < 40 && this.cooldown <= 0) {
      let catchProb = (this.attr.goalkeeping / 20) * 0.6; 
      let saveProb = 0.3 + (this.attr.goalkeeping / 20) * 0.5; // Slightly reduced to allow more goals
      
      this.cooldown = 45; // GK commits to the dive/save
      if (Math.random() < saveProb) {
        if (Math.random() < catchProb && ball.vel.mag() < 8) { // Only catch if not a rocket
          ball.vel.mult(0);
          ball.vz = 0;
          ball.z = 0;
          ball.owner = this;
          ball.lastTouch = this;
          this.gkHoldTimer = 210; // start GK holding phase (3.5s)
          logEvent(`🧤 GK #${this.number} catches securely!`, 'action');
          this.cooldown = 15;
        } else {
          let toCorner = Math.random() < 0.7;
          if (toCorner) {
            ball.vel.mult(0.6);
            ball.vel.y = (Math.random() > 0.5 ? 6 : -6);
            ball.vel.x = this.team === 0 ? -3 : 3;
            ball.vz = 2; // deflected up slightly
            logEvent(`🧤 GK #${this.number} parries out for a corner!`, 'action');
          } else {
            ball.vel.mult(-0.3);
            ball.vel.y += (Math.random() - 0.5) * 5;
            ball.vz = 1 + Math.random()*2;
            logEvent(`🧤 GK #${this.number} parries the ball into play!`, 'action');
          }
          ball.lastTouch = this;
          this.cooldown = 15;
        }
      } else {
        logEvent(`🧤 GK #${this.number} dives but is beaten!`, 'action');
      }
    }

    // Safety clamp target within pitch boundaries (at least 35px margin to keep players inside the lines)
    target.x = Math.max(35, Math.min(C.PITCH_W - 35, target.x));
    target.y = Math.max(35, Math.min(C.PITCH_H - 35, target.y));

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

    // Safe clamp for player actual position (at least 20px inside the lines)
    this.pos.x = Math.max(20, Math.min(C.PITCH_W - 20, this.pos.x));
    this.pos.y = Math.max(20, Math.min(C.PITCH_H - 20, this.pos.y));
  }

  draw() {
    let g = this.graphics;
    g.clear();
    
    if (this.sentOff) {
      this.textObj.setVisible(false);
      return;
    }
    this.textObj.setVisible(true);

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(this.pos.x + 3, this.pos.y + 4, C.PLAYER_R * 1.6, C.PLAYER_R * 1.2);

    g.fillStyle(this.colorHex, 1);
    g.fillCircle(this.pos.x, this.pos.y, C.PLAYER_R);
    
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeCircle(this.pos.x, this.pos.y, C.PLAYER_R - 1);
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeCircle(this.pos.x, this.pos.y, C.PLAYER_R);

    this.textObj.setPosition(this.pos.x, this.pos.y);

    let cx = this.pos.x + C.PLAYER_R + 2;
    let cy = this.pos.y - C.PLAYER_R - 2;
    if (this.yellowCards >= 1) {
      g.fillStyle(0xfacc15, 1);
      g.fillRect(cx, cy, 5, 7);
      g.lineStyle(0.6, 0x000000, 1);
      g.strokeRect(cx, cy, 5, 7);
    }
    if (this.yellowCards >= 2 || this.redCard) {
      g.fillStyle(0xef4444, 1);
      g.fillRect(cx + 6, cy, 5, 7);
      g.lineStyle(0.6, 0x000000, 1);
      g.strokeRect(cx + 6, cy, 5, 7);
    }

    if (this.cardFlash) {
      let fc = this.cardFlash.type === 'YELLOW' ? 0xfacc15 : 0xef4444;
      let alpha = Math.min(1, this.cardFlash.timer / 60);
      g.fillStyle(fc, alpha);
      g.fillRect(this.pos.x - 6, this.pos.y - 26, 12, 16);
      g.lineStyle(1, 0x000000, alpha);
      g.strokeRect(this.pos.x - 6, this.pos.y - 26, 12, 16);
    }

    let bw = 14, bh = 2;
    let bx = this.pos.x - bw / 2;
    let by = this.pos.y + C.PLAYER_R + 5;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(bx, by, bw, bh);
    let sp = this.currentStamina / 100;
    let spColor = sp > 0.5 ? 0x22c55e : sp > 0.25 ? 0xfacc15 : 0xef4444;
    g.fillStyle(spColor, 1);
    g.fillRect(bx, by, bw * sp, bh);
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

  initGraphics(scene, container) {
    this.graphics = scene.add.graphics();
    container.add(this.graphics);
    this.textObj = scene.add.text(0, 0, 'R', {
      fontFamily: 'sans-serif', fontSize: '7px', fontStyle: 'bold', color: '#fff'
    }).setOrigin(0.5);
    container.add(this.textObj);
    this.whistleObj = scene.add.text(0, 0, '📣', {
      fontFamily: 'sans-serif', fontSize: '10px'
    }).setOrigin(0.5);
    container.add(this.whistleObj);
  }

  get strictnessLabel() {
    if (this.strictness <= 40) return 'Lenient';
    if (this.strictness <= 70) return 'Normal';
    return 'Strict';
  }

  get thresholdMod() { return (50 - this.strictness) / 5; }

  showCard(type) { this.showingCard = { type, timer: 120 }; }

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

  draw() {
    let g = this.graphics;
    g.clear();

    g.fillStyle(0x111111, 1);
    g.fillCircle(this.pos.x, this.pos.y, 6);
    g.lineStyle(1, 0x444444, 1);
    g.strokeCircle(this.pos.x, this.pos.y, 6);

    this.textObj.setPosition(this.pos.x, this.pos.y);

    if (this.showingCard) {
      let alpha = Math.min(1, this.showingCard.timer / 60);
      let fc = this.showingCard.type === 'YELLOW' ? 0xfacc15 : 0xef4444;
      g.fillStyle(fc, alpha);
      g.fillRect(this.pos.x + 7, this.pos.y - 24, 10, 14);
      g.lineStyle(1, 0x000000, alpha);
      g.strokeRect(this.pos.x + 7, this.pos.y - 24, 10, 14);
    }

    if (this.whistleTimer > 0) {
      this.whistleObj.setVisible(true);
      this.whistleObj.setPosition(this.pos.x, this.pos.y - 14);
    } else {
      this.whistleObj.setVisible(false);
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

  initGraphics(scene, container) {
    this.graphics = scene.add.graphics();
    container.add(this.graphics);
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

  draw() {
    let g = this.graphics;
    g.clear();

    g.fillStyle(0xeab308, 1);
    g.fillCircle(this.pos.x, this.pos.y, 5);
    g.lineStyle(1, 0x000000, 1);
    g.strokeCircle(this.pos.x, this.pos.y, 5);

    if (this.flagRaised) {
      let fd = this.isTop ? -1 : 1;
      g.lineStyle(2, 0xef4444, 1);
      g.beginPath();
      g.moveTo(this.pos.x, this.pos.y);
      g.lineTo(this.pos.x, this.pos.y + fd * 15);
      g.strokePath();

      g.fillStyle(0xef4444, 1);
      g.beginPath();
      g.moveTo(this.pos.x, this.pos.y + fd * 8);
      g.lineTo(this.pos.x + 8, this.pos.y + fd * 11);
      g.lineTo(this.pos.x, this.pos.y + fd * 14);
      g.fillPath();
    }
  }
}

// ===== FOUL SYSTEM =====
class FoulSystem {
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

// ===== OFFSIDE SYSTEM =====
class OffsideSystem {
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

  initGraphics(scene, container) {
    this.graphics = scene.add.graphics();
    container.add(this.graphics);
    this.textObj = scene.add.text(C.PITCH_W / 2, 25, '', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#00ffff'
    }).setOrigin(0.5);
    container.add(this.textObj);
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

  draw() {
    let g = this.graphics;
    g.clear();
    this.textObj.setVisible(false);

    if (!this.reviewing) return;
    let alpha = 0.7 + Math.sin(Date.now() / 200) * 0.3;

    g.fillStyle(0x00003c, alpha * 0.85);
    g.fillRect(C.PITCH_W / 2 - 110, 8, 220, 34);
    g.lineStyle(2, 0x00ffff, 1);
    g.strokeRect(C.PITCH_W / 2 - 110, 8, 220, 34);

    this.textObj.setText(`📺 VAR REVIEW: ${this.reviewType}`);
    this.textObj.setVisible(true);

    g.lineStyle(1, 0x00ffff, 0.12 * alpha);
    let sy = (Date.now() / 10) % C.PITCH_H;
    g.beginPath(); g.moveTo(0, sy); g.lineTo(C.PITCH_W, sy); g.strokePath();
  }
}

// ===== MATCH ENGINE =====
class MatchEngine {
  constructor(scene) {
    this.scene = scene;
    this.ball = new Ball();
    this.players = [];
    this.referee = new Referee();
    this.linesmen = [new Linesman(true), new Linesman(false)];

    this.foulSystem = new FoulSystem(this.referee);
    this.offsideSystem = new OffsideSystem();
    this.advantageSystem = new AdvantageSystem();
    this.varSystem = new VARSystem();

    this.state = 'STOPPED'; 
    this.time = 0;
    this.half = 1;
    this.score = { home: 0, away: 0 };
    this.speed = 1;

    this.setPieceTimer = 0;
    this.lastSetPieceType = null;
    this.penaltyState = null;
    
    this.outOfBoundsTimer = 0;
    this.nextSetPiece = null;

    this.stats = {
      home: { fouls: 0, yellows: 0, reds: 0, possession: 0 },
      away: { fouls: 0, yellows: 0, reds: 0, possession: 0 }
    };
    this.possessionFrames = { home: 0, away: 0 };

    this.crowd = [];
    this.generateCrowd();
    this.setupTeams();
    this.accumulator = 0;
    this.FIXED_DT = 1000 / 60;
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
    hPos.forEach((p,i) => {
      let color = p[2] === 'GK' ? '#39ff14' : hC; // bright green for Home GK
      this.players.push(new Player(0, i+1, p[2], p[0], p[1], color));
    });
    aPos.forEach((p,i) => {
      let color = p[2] === 'GK' ? '#facc15' : aC; // yellow for Away GK
      this.players.push(new Player(1, i+1, p[2], p[0], p[1], color));
    });

    // Initialize tactical values from Manager UI or defaults
    const sf = document.getElementById('select-formation');
    const st = document.getElementById('select-tactic');
    const sm = document.getElementById('select-mentality');

    this.homeFormation = sf ? sf.value : '4-4-2';
    this.homeTactic = st ? st.value : 'Mixed';
    this.homeMentality = sm ? sm.value : 'Balanced';

    this.applyHomeFormation(this.homeFormation);
  }

  applyHomeFormation(formation) {
    this.homeFormation = formation;
    let hPos;
    if (formation === '4-3-3') {
      hPos = [
        [50,250,'GK'],
        [200,80,'DEF'],[150,180,'DEF'],[150,320,'DEF'],[200,420,'DEF'],
        [300,120,'MID'],[270,250,'MID'],[300,380,'MID'],
        [420,100,'FWD'],[440,250,'FWD'],[420,400,'FWD']
      ];
    } else if (formation === '3-5-2') {
      hPos = [
        [50,250,'GK'],
        [180,130,'DEF'],[150,250,'DEF'],[180,370,'DEF'],
        [350,70,'MID'],[300,160,'MID'],[320,250,'MID'],[300,340,'MID'],[350,430,'MID'],
        [420,190,'FWD'],[420,310,'FWD']
      ];
    } else { // '4-4-2' default
      hPos = [
        [50,250,'GK'],
        [200,80,'DEF'],[150,180,'DEF'],[150,320,'DEF'],[200,420,'DEF'],
        [350,100,'MID'],[300,200,'MID'],[300,300,'MID'],[350,400,'MID'],
        [420,190,'FWD'],[420,310,'FWD']
      ];
    }

    // Apply to home players (team 0)
    let homePlayers = this.players.filter(p => p.team === 0);
    homePlayers.forEach((p, idx) => {
      let config = hPos[idx];
      if (config) {
        p.role = config[2];
        p.basePos = new Vector(config[0], config[1]);
        p.attr = generateAttributes(p.role); // refresh attributes for new role
        
        // If match hasn't started or is stopped/set piece, move player to base position immediately
        if (this.state !== 'PLAYING') {
          p.pos = p.basePos.copy();
          p.vel.mult(0);
        }
      }
    });
    logEvent(`📋 Home Team adjusted to ${formation} formation`, 'setpiece');
  }

  resetKickoff(kickingTeam = 0) {
    this.ball.owner = null;
    this.ball.lastTouch = null;
    this.ball.pos = new Vector(C.PITCH_W/2, C.PITCH_H/2);
    this.ball.vel = new Vector(0,0);
    this.ball.z = 0;
    this.ball.vz = 0;
    this.players.forEach(p => {
      if (!p.sentOff) { p.pos = p.basePos.copy(); p.vel.mult(0); p.cooldown = 0; }
    });
    this.lastSetPieceType = null;
    this.penaltyState = null;

    // FIFA kickoff: kicking team's center forward kicks off
    // Only players of the kicking team can be in their half (others must be in own half)
    this.state = 'SET_PIECE';
    this.setPieceTimer = 90; // short delay before kickoff pass
    this.lastSetPieceType = 'KICKOFF';

    // Find the two FWDs of the kicking team for kickoff
    let kt = this.getActivePlayers(kickingTeam);
    let fwds = kt.filter(p => p.role === 'FWD');
    let kicker = fwds[0] || kt.find(p => p.role === 'MID');
    let receiver = fwds[1] || kt.find(p => p.role === 'MID' && p !== kicker);

    if (kicker) {
      kicker.pos = new Vector(C.PITCH_W/2 + (kickingTeam === 0 ? -12 : 12), C.PITCH_H/2);
      this.ball.owner = kicker;
    }
    if (receiver) {
      receiver.pos = new Vector(C.PITCH_W/2 + (kickingTeam === 0 ? -30 : 30), C.PITCH_H/2 + 40);
    }

    // Force opponents to their own half
    let ot = this.getActivePlayers(kickingTeam === 0 ? 1 : 0);
    ot.forEach(p => {
      if (kickingTeam === 0 && p.pos.x < C.PITCH_W/2) p.pos.x = C.PITCH_W/2 + 5;
      if (kickingTeam === 1 && p.pos.x > C.PITCH_W/2) p.pos.x = C.PITCH_W/2 - 5;
    });

    // Force kicking team to their own half (except kickers)
    kt.forEach(p => {
      if (p === kicker || p === receiver) return;
      if (kickingTeam === 0 && p.pos.x > C.PITCH_W/2) p.pos.x = C.PITCH_W/2 - 5;
      if (kickingTeam === 1 && p.pos.x < C.PITCH_W/2) p.pos.x = C.PITCH_W/2 + 5;
    });
  }

  triggerSetPiece(type, pos, teamToTake) {
    this.state = 'SET_PIECE';
    this.setPieceTimer = 120;
    this.lastSetPieceType = type;
    this.ball.owner = null;
    this.ball.vel.mult(0);
    this.ball.z = 0;
    this.ball.vz = 0;
    this.ball.pos = pos.copy();
    this.advantageSystem.onStoppage(this);
    this.referee.whistleTimer = 60;

    if (type === 'PENALTY') {
      this.setupPenalty(teamToTake);
      return;
    }

    let taker;
    if (type === 'GOAL_KICK') {
      taker = this.getActivePlayers(teamToTake).find(p => p.role === 'GK');
    } else {
      let tp = this.getActivePlayers(teamToTake).filter(p => p.role !== 'GK');
      taker = tp.sort((a,b) => a.pos.dist(pos) - b.pos.dist(pos))[0];
    }

    if (taker) {
      taker.pos = pos.copy();
      this.ball.owner = taker;
    }
    
    if (type === 'CORNER') {
      let opGoalX = teamToTake === 0 ? C.PITCH_W : 0;
      let att = this.getActivePlayers(teamToTake).filter(p => p !== taker && p.role !== 'GK');
      att.sort((a,b) => a.role === 'DEF' ? 1 : -1); 
      let stayBack = att.slice(att.length - 2);
      let crowdBox = att.slice(0, att.length - 2);

      let attPositions = [
        { dx: 15, dy: -40 }, { dx: 15, dy: 40 },
        { dx: 30, dy: 0 }, { dx: 45, dy: -20 },
        { dx: 45, dy: 20 }, { dx: 65, dy: 0 },
        { dx: 75, dy: -30 }, { dx: 75, dy: 30 }
      ];

      crowdBox.forEach((p, i) => {
        let posRef = attPositions[i % attPositions.length];
        let rx = opGoalX + (teamToTake === 0 ? -posRef.dx : posRef.dx);
        let ry = C.PITCH_H/2 + posRef.dy;
        p.pos = new Vector(rx + (Math.random()-0.5)*15, ry + (Math.random()-0.5)*15);
        p.vel.mult(0);
      });
      stayBack.forEach(p => {
        let rx = C.PITCH_W/2 + (teamToTake === 0 ? 80 : -80);
        let ry = C.PITCH_H/2 + (Math.random() - 0.5) * 60;
        p.pos = new Vector(rx, ry);
        p.vel.mult(0);
      });

      let defTeamFull = this.getActivePlayers(teamToTake === 0 ? 1 : 0);
      let defGk = defTeamFull.find(p => p.role === 'GK');
      if (defGk) {
         defGk.pos = new Vector(opGoalX, C.PITCH_H/2);
         defGk.vel.mult(0);
      }
      
      let defTeam = defTeamFull.filter(p => p.role !== 'GK');
      defTeam.forEach((p, i) => {
        if (i < crowdBox.length) {
          let markTarget = crowdBox[i];
          let goalSide = Vector.sub(new Vector(opGoalX, C.PITCH_H/2), markTarget.pos).normalize().mult(15);
          p.pos = markTarget.pos.copy().add(goalSide);
        } else {
          let rx = opGoalX + (teamToTake === 0 ? -Math.random()*40 - 20 : Math.random()*40 + 20);
          let ry = C.PITCH_H/2 + (Math.random() - 0.5) * 100;
          p.pos = new Vector(rx, ry);
        }
        p.vel.mult(0);
      });
    }
    
    this.players.forEach(p => {
      if (p === taker || p.sentOff || p.role === 'GK') return;
      if (type === 'THROW_IN') {
        if (p.pos.dist(pos) < 50 && p.team !== teamToTake) {
           p.vel = Vector.sub(p.pos, pos).normalize().mult(2);
        }
      }
    });
  }

  setupPenalty(teamToTake) {
    this.setPieceTimer = 180;
    let oppTeam = teamToTake === 0 ? 1 : 0;
    let goalX = oppTeam === 0 ? 0 : C.PITCH_W;
    let spotX = oppTeam === 0 ? C.PENALTY_SPOT : C.PITCH_W - C.PENALTY_SPOT;

    this.ball.pos = new Vector(spotX, C.PITCH_H/2);
    this.ball.vel.mult(0);
    this.ball.z = 0;
    this.ball.vz = 0;
    this.ball.owner = null;

    let att = this.getActivePlayers(teamToTake).filter(p => p.role !== 'GK');
    att.sort((a,b) => (b.attr.finishing + b.attr.composure) - (a.attr.finishing + a.attr.composure));
    let kicker = att[0];
    let gk = this.getActivePlayers(oppTeam).find(p => p.role === 'GK');

    this.penaltyState = { team: teamToTake, kicker, gk };

    if (kicker) kicker.pos = new Vector(spotX - (teamToTake === 0 ? 15 : -15), C.PITCH_H/2);
    if (gk) gk.pos = new Vector(goalX, C.PITCH_H/2);

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
    shotY += (Math.random()-0.5) * (20 - kicker.attr.composure) * 2;

    let dir = new Vector(goalX - this.ball.pos.x, shotY - this.ball.pos.y).normalize();
    let power = 8 + kicker.attr.finishing / 3;
    this.ball.vel = dir.mult(power);
    this.ball.owner = null;
    this.ball.lastTouch = kicker;

    let saved = false;
    if (shotZone === gkDive) {
      saved = Math.random() < gScore / 20 * 0.7;
    } else {
      saved = Math.random() < gScore / 20 * 0.1;
    }

    if (saved) {
      this.ball.vel.mult(0.1);
      this.ball.vel.y = (Math.random()-0.5) * 5;
      this.ball.lastTouch = gk;
      logEvent(`🧤 SAVED! GK #${gk.number} dives ${gkDive}!`, 'action');
    } else {
      let onTarget = Math.random() < (fScore / 20 * 0.9 + 0.1);
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

  executeSetPiece() {
    let taker = this.ball.owner;
    if (!taker) { this.state = 'PLAYING'; return; }

    let type = this.lastSetPieceType;
    let teammates = this.getActivePlayers(taker.team).filter(p => p !== taker && p.role !== 'GK');
    let oppPlayers = this.getActivePlayers(taker.team === 0 ? 1 : 0);

    // ---- KICKOFF: short pass to nearby teammate in center circle ----
    if (type === 'KICKOFF') {
      let receiver = teammates.find(p => p.pos.dist(new Vector(C.PITCH_W/2, C.PITCH_H/2)) < 80 && p !== taker);
      if (!receiver) receiver = teammates.sort((a,b) => a.pos.dist(taker.pos) - b.pos.dist(taker.pos))[0];
      if (receiver) {
        let passVec = Vector.sub(receiver.pos, taker.pos).normalize().mult(3 + Math.random());
        this.ball.vel = passVec;
        this.ball.vz = 0;
        logEvent(`⚽ Kickoff! #${taker.number} passes to #${receiver.number}`, 'action');
      }
      taker.cooldown = 30;
      this.ball.owner = null;
      this.ball.lastTouch = taker;
      this.state = 'PLAYING';
      this.lastSetPieceType = null;
      return;
    }

    if (type === 'THROW_IN') {
      teammates.sort((a,b) => a.pos.dist(taker.pos) - b.pos.dist(taker.pos));
      let target = teammates[0];
      if (target) {
        let passVec = Vector.sub(target.pos, taker.pos).normalize();
        if (Math.random() < 0.15) {
          passVec.x += (Math.random()-0.5)*1.5;
          passVec.y += (Math.random()-0.5)*1.5;
        }
        this.ball.vel = passVec.normalize().mult(4);
        this.ball.vz = 1;
        logEvent(`👐 #${taker.number} throws it in.`, 'action');
      }

    } else if (type === 'CORNER') {
      let oppGoalX = taker.team === 0 ? C.PITCH_W : 0;
      let crossTarget = new Vector(oppGoalX + (taker.team === 0 ? -40 : 40), C.PITCH_H/2 + (Math.random()-0.5)*80);
      let passVec = Vector.sub(crossTarget, taker.pos).normalize();
      this.ball.vel = passVec.mult(8);
      this.ball.vz = 4 + Math.random()*2;
      logEvent(`🚩 #${taker.number} crosses the corner!`, 'action');

    } else if (type === 'FREE_KICK') {
      // --- FREE KICK LOGIC ---
      let oppGoalX = taker.team === 0 ? C.PITCH_W : 0;
      let distToGoal = taker.pos.dist(new Vector(oppGoalX, C.PITCH_H/2));

      // Build a defensive WALL from the opponent team
      // (3-5 players line up between ball and goal)
      let wallPlayers = oppPlayers.filter(p => p.role !== 'GK').sort(
        (a,b) => a.pos.dist(taker.pos) - b.pos.dist(taker.pos)
      ).slice(0, Math.min(5, Math.floor(distToGoal / 50)));

      wallPlayers.forEach((wp, idx) => {
        // Line up perpendicular to the kick direction, 9.15m (scaled ~35px) from ball
        let wallDir = Vector.sub(new Vector(oppGoalX, C.PITCH_H/2), taker.pos).normalize();
        let wallCenter = taker.pos.copy().add(wallDir.copy().mult(35));
        let perp = new Vector(-wallDir.y, wallDir.x);
        let offset = (idx - (wallPlayers.length - 1) / 2) * 10;
        wp.pos = wallCenter.copy().add(perp.mult(offset));
        wp.vel.mult(0);
        wp.cooldown = 80;
      });

      // Remaining defenders hold positions between ball and goal (zonal)
      oppPlayers.filter(p => !wallPlayers.includes(p) && p.role !== 'GK').forEach(p => {
        // Position goal-side and mark nearby attackers
        let attackerNear = teammates.sort((a,b) => a.pos.dist(p.pos) - b.pos.dist(p.pos))[0];
        if (attackerNear) {
          let goalDir2 = Vector.sub(new Vector(oppGoalX, C.PITCH_H/2), attackerNear.pos).normalize();
          p.pos = attackerNear.pos.copy().add(goalDir2.mult(20));
          p.pos.x = Math.max(2, Math.min(C.PITCH_W-2, p.pos.x));
          p.pos.y = Math.max(2, Math.min(C.PITCH_H-2, p.pos.y));
        }
        p.vel.mult(0);
        p.cooldown = 60;
      });

      // Decision: shoot directly or pass to teammate
      let shootDirect = distToGoal < 200 && Math.random() < 0.55;
      if (shootDirect) {
        let targetY = C.PITCH_H/2 + (Math.random()-0.5) * C.GOAL_W * 0.7;
        // Try to curve around wall
        let wallMidY = wallPlayers.length > 0
          ? wallPlayers.reduce((s,w) => s + w.pos.y, 0) / wallPlayers.length
          : C.PITCH_H/2;
        let curveY = targetY + (C.PITCH_H/2 - wallMidY) * 0.3;
        let passVec = new Vector(oppGoalX - taker.pos.x, curveY - taker.pos.y).normalize();
        this.ball.vel = passVec.mult(8 + taker.attr.finishing/4);
        this.ball.vz = 2 + Math.random();
        logEvent(`💥 #${taker.number} curls it toward goal!`, 'action');
      } else {
        // Pass to the most forward, open teammate
        let target = teammates.filter(t => {
          let nearOpp = oppPlayers.reduce((m,o) => Math.min(m, o.pos.dist(t.pos)), Infinity);
          return nearOpp > 30;
        }).sort((a,b) => {
          let fwdA = taker.team === 0 ? a.pos.x : -a.pos.x;
          let fwdB = taker.team === 0 ? b.pos.x : -b.pos.x;
          return fwdB - fwdA;
        })[0];
        if (target) {
          let passVec = Vector.sub(target.pos, taker.pos).normalize();
          this.ball.vel = passVec.mult(6 + taker.attr.passing/4);
          this.ball.vz = 0;
          logEvent(`👟 #${taker.number} plays it short from free kick.`, 'action');
        } else {
          this.ball.vel = new Vector(taker.team===0?1:-1, 0).mult(5);
        }
      }

    } else if (type === 'GOAL_KICK') {
      // GOAL KICK
      teammates.sort((a,b) => a.pos.dist(new Vector(taker.team===0?C.PITCH_W:0, C.PITCH_H/2)) - b.pos.dist(new Vector(taker.team===0?C.PITCH_W:0, C.PITCH_H/2)));
      let target = teammates[Math.floor(Math.random()*3)];
      if (target) {
        let passVec = Vector.sub(target.pos, taker.pos).normalize();
        this.ball.vel = passVec.mult(9 + taker.attr.passing/4);
        this.ball.vz = 8; // High arc
        logEvent(`⬆️ GK #${taker.number} punts the goal kick.`, 'action');
      } else {
        this.ball.vel = new Vector(taker.team===0?1:-1, 0).mult(9);
        this.ball.vz = 8;
      }
    }

    taker.cooldown = 40;
    this.ball.owner = null;
    this.ball.lastTouch = taker;
    this.state = 'PLAYING';
    if (type !== 'KICKOFF') this.lastSetPieceType = null;
  }

  attemptTackle(tackler, carrier) {
    let result = this.foulSystem.evaluateTackle(tackler, carrier, this);

    if (!result.isFoul) {
      if (result.tackleSuccess) {
        this.ball.owner = null;
        this.ball.vel = new Vector((Math.random()-0.5)*4, (Math.random()-0.5)*4);
        this.ball.lastTouch = tackler;
        logEvent(`💪 #${tackler.number} wins the ball!`, 'action');
      } else {
        tackler.cooldown = 30;
      }
      return;
    }

    tackler.foulCount++;
    let tk = tackler.team === 0 ? 'home' : 'away';
    this.stats[tk].fouls++;
    logEvent(`⚠️ FOUL by #${tackler.number} on #${carrier.number} (${result.reason})`, 'foul');

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

    this.giveCard(tackler, result.card, result.reason);

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

  handleVAROverturned(type, data) {
    if (type === 'GOAL') {
      let t = data.team;
      this.score[t]--;
      document.getElementById(`score-${t}`).innerText = this.score[t];
      logEvent(`❌ GOAL DISALLOWED by VAR!`, 'var');
      setTimeout(() => { this.resetKickoff(0); }, 1500);
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
        let kickTeam = result.data.kickingTeamAfterGoal !== undefined ? result.data.kickingTeamAfterGoal : 0;
        setTimeout(() => { this.resetKickoff(kickTeam); }, 1500);
      }
    } else if (result.type === 'PENALTY') {
      if (result.decision === 'OVERTURN') {
        this.state = 'PLAYING';
      }
    }
  }

  checkBoundsAndGoals() {
    let gyS = C.GOAL_Y, gyE = C.GOAL_Y + C.GOAL_W;
    let bpx = this.ball.pos.x, bpy = this.ball.pos.y;

    if (this.ball.owner) return;

    if (bpx < 0 || bpx > C.PITCH_W || bpy < 0 || bpy > C.PITCH_H) {
      if (this.state !== 'OUT_OF_BOUNDS' && this.state !== 'STOPPED' && this.state !== 'SET_PIECE') {
        this.handleBallOut();
      }
    }
  }

  handleBallOut() {
    let gyS = C.GOAL_Y, gyE = C.GOAL_Y + C.GOAL_W;
    let bpx = this.ball.pos.x, bpy = this.ball.pos.y;

    if ((bpx < 0 || bpx > C.PITCH_W) && bpy > gyS && bpy < gyE && this.ball.z < 30) {
      let teamScored = bpx > C.PITCH_W ? 'home' : 'away';
      let scoredByTeam = teamScored === 'home' ? 0 : 1;
      let kickingTeamAfterGoal = scoredByTeam === 0 ? 1 : 0; // Opposition kicks off
      this.score[teamScored]++;
      document.getElementById(`score-${teamScored}`).innerText = this.score[teamScored];
      logEvent(`⚽ GOOOAL for ${teamScored.toUpperCase()}! 🎉`, 'goal');
      this.state = 'STOPPED';
      this.advantageSystem.onStoppage(this);
      if (!this.varSystem.checkEvent('GOAL', { team: teamScored, kickingTeamAfterGoal }, this)) {
        setTimeout(() => { this.resetKickoff(kickingTeamAfterGoal); }, 2000);
      }
      return;
    }

    this.state = 'OUT_OF_BOUNDS';
    this.outOfBoundsTimer = 60; 
    this.referee.whistleTimer = 30;

    let lastTeam = this.ball.lastTouch ? this.ball.lastTouch.team : 0;
    this.nextSetPiece = { team: lastTeam === 0 ? 1 : 0 };

    if (bpy < 0 || bpy > C.PITCH_H) {
      this.nextSetPiece.type = 'THROW_IN';
      this.nextSetPiece.pos = new Vector(Math.max(2, Math.min(C.PITCH_W-2, bpx)), bpy < 0 ? 2 : C.PITCH_H-2);
      logEvent('📐 Out of bounds. Throw-in.', 'setpiece');
    } else if (bpx < 0) {
      if (lastTeam === 0) {
        this.nextSetPiece.type = 'CORNER';
        this.nextSetPiece.pos = new Vector(2, bpy < C.PITCH_H/2 ? 2 : C.PITCH_H-2);
        logEvent('🚩 Corner Kick!', 'setpiece');
      } else {
        this.nextSetPiece.type = 'GOAL_KICK';
        this.nextSetPiece.pos = new Vector(50, C.PITCH_H/2);
        logEvent('⬆️ Goal Kick.', 'setpiece');
      }
    } else if (bpx > C.PITCH_W) {
      if (lastTeam === 1) {
        this.nextSetPiece.type = 'CORNER';
        this.nextSetPiece.pos = new Vector(C.PITCH_W-2, bpy < C.PITCH_H/2 ? 2 : C.PITCH_H-2);
        logEvent('🚩 Corner Kick!', 'setpiece');
      } else {
        this.nextSetPiece.type = 'GOAL_KICK';
        this.nextSetPiece.pos = new Vector(C.PITCH_W-50, C.PITCH_H/2);
        logEvent('⬆️ Goal Kick.', 'setpiece');
      }
    }
  }

  update() {
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

      if (this.state === 'OUT_OF_BOUNDS') {
        this.ball.update(); 
        this.players.forEach(p => p.update(this)); 
        this.outOfBoundsTimer--;
        if (this.outOfBoundsTimer <= 0) {
          this.triggerSetPiece(this.nextSetPiece.type, this.nextSetPiece.pos, this.nextSetPiece.team);
        }
        continue;
      }

      if (this.state === 'SET_PIECE') {
        this.setPieceTimer--;
        if (this.setPieceTimer <= 0) {
          if (this.penaltyState) {
            this.executePenalty();
          } else {
            this.executeSetPiece();
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

      if (this.half === 1 && this.time >= 45 * 60) {
        this.state = 'HALF_TIME';
        logEvent('🏁 HALF TIME!', 'half');
        document.getElementById('btn-start').innerText = 'Start 2nd Half';
        // Reset positions but stay in HALF_TIME — kickoff happens when user clicks
        this.ball.pos = new Vector(C.PITCH_W/2, C.PITCH_H/2);
        this.ball.vel.mult(0); this.ball.z = 0; this.ball.vz = 0; this.ball.owner = null;
        this.players.forEach(p => { if (!p.sentOff) { p.pos = p.basePos.copy(); p.vel.mult(0); } });
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

  draw() {
    if (this.penaltyState) {
      let ot = this.penaltyState.team === 0 ? 1 : 0;
      let box = getPenaltyBox(ot);
      this.overlayGraphics.clear();
      this.overlayGraphics.fillStyle(0xffff00, 0.08);
      this.overlayGraphics.fillRect(box.x1, box.y1, box.x2-box.x1, box.y2-box.y1);
    } else {
      this.overlayGraphics.clear();
    }

    if (this.state === 'HALF_TIME' || this.state === 'FULL_TIME') {
      this.overlayGraphics.fillStyle(0x000000, 0.7);
      this.overlayGraphics.fillRect(0, 0, C.PITCH_W, C.PITCH_H);
      if (!this.stateText) {
        this.stateText = this.scene.add.text(C.PITCH_W/2, C.PITCH_H/2 - 20, '', {
          fontFamily: 'sans-serif', fontSize: '64px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.9);
        this.subStateText = this.scene.add.text(C.PITCH_W/2, C.PITCH_H/2 + 40, 'Click Start/Resume to continue', {
          fontFamily: 'sans-serif', fontSize: '24px', color: '#aaaaaa'
        }).setOrigin(0.5).setAlpha(0.9);
      }
      this.stateText.setText(this.state === 'HALF_TIME' ? 'HALF TIME' : 'FULL TIME');
      this.stateText.setVisible(true);
      this.subStateText.setVisible(true);
    } else {
      if (this.stateText) {
        this.stateText.setVisible(false);
        this.subStateText.setVisible(false);
      }
    }

    this.referee.draw();
    this.linesmen.forEach(l => l.draw());
    this.players.forEach(p => p.draw());
    this.ball.draw();
    this.varSystem.draw();
  }
}

// ===== UI SYNC =====
function updateUI(engine) {
  let t = Math.floor(engine.time);
  let m = Math.floor(t/60), s = t % 60;
  document.getElementById('match-time').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

  document.getElementById('match-half').innerText =
    engine.state === 'FULL_TIME' ? 'Full Time' :
    engine.state === 'HALF_TIME' ? 'Half Time' :
    engine.half === 1 ? '1st Half' : '2nd Half';

  document.getElementById('stat-home-fouls').innerText = engine.stats.home.fouls;
  document.getElementById('stat-home-yellows').innerText = engine.stats.home.yellows;
  document.getElementById('stat-home-reds').innerText = engine.stats.home.reds;
  document.getElementById('stat-home-possession').innerText = engine.stats.home.possession + '%';
  document.getElementById('stat-away-fouls').innerText = engine.stats.away.fouls;
  document.getElementById('stat-away-yellows').innerText = engine.stats.away.yellows;
  document.getElementById('stat-away-reds').innerText = engine.stats.away.reds;
  document.getElementById('stat-away-possession').innerText = engine.stats.away.possession + '%';

  let refEl = document.getElementById('referee-name');
  let strEl = document.getElementById('referee-strictness');
  if (refEl) refEl.innerText = engine.referee.name;
  if (strEl) {
    strEl.innerText = engine.referee.strictnessLabel + ` (${engine.referee.strictness})`;
    strEl.className = `strictness-${engine.referee.strictnessLabel.toLowerCase()}`;
  }

  let vb = document.getElementById('btn-var-toggle');
  if (vb) {
    vb.innerText = engine.varSystem.enabled ? 'VAR: ON' : 'VAR: OFF';
    if (engine.varSystem.enabled) vb.classList.add('active'); else vb.classList.remove('active');
  }
}

// ===== PHASER SETUP =====
class MatchScene extends Phaser.Scene {
  constructor() {
    super('MatchScene');
  }

  create() {
    this.container = this.add.container(50, 50);
    this.container.setScale(0.85);

    this.pitchGraphics = this.add.graphics();
    this.container.add(this.pitchGraphics);

    this.overlayGraphics = this.add.graphics();
    this.container.add(this.overlayGraphics);

    engine = new MatchEngine(this);
    engine.overlayGraphics = this.overlayGraphics;

    engine.players.forEach(p => p.initGraphics(this, this.container));
    engine.ball.initGraphics(this, this.container);
    engine.referee.initGraphics(this, this.container);
    engine.linesmen.forEach(l => l.initGraphics(this, this.container));
    engine.varSystem.initGraphics(this, this.container);

    this.drawPitch();
  }

  update(time, delta) {
    if (engine) {
      if (engine.crashed) return;
      try {
        let elapsed = Math.min(delta, 200);
        engine.accumulator += elapsed;
        while (engine.accumulator >= engine.FIXED_DT) {
          engine.update();
          engine.accumulator -= engine.FIXED_DT;
        }
        engine.draw();
        updateUI(engine);
      } catch (err) {
        engine.crashed = true;
        console.error(err);
        alert("CRASH: " + err.message + "\n\n" + err.stack);
      }
    }
  }

  drawPitch() {
    let g = this.pitchGraphics;
    g.clear();

    engine.crowd.forEach(c => { 
      let col = parseInt(c.color.replace('#', '0x'));
      g.fillStyle(col, 1); 
      g.fillRect(c.x, c.y, 3, 3); 
    });

    // Premium Grass Base
    g.fillStyle(0x288741, 1);
    g.fillRect(0, 0, C.PITCH_W, C.PITCH_H);
    
    // Mowing stripes
    g.fillStyle(0x3ab859, 0.8);
    for (let x = 0; x < C.PITCH_W; x += 50) {
      if ((x/50) % 2 === 0) g.fillRect(x, 0, 50, C.PITCH_H);
    }

    // Top and bottom vignette
    g.fillStyle(0x000000, 0.15);
    g.fillRect(0, 0, C.PITCH_W, 25);
    g.fillRect(0, C.PITCH_H - 25, C.PITCH_W, 25);

    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeRect(0, 0, C.PITCH_W, C.PITCH_H);
    g.beginPath(); g.moveTo(C.PITCH_W/2, 0); g.lineTo(C.PITCH_W/2, C.PITCH_H); g.strokePath();

    g.strokeCircle(C.PITCH_W/2, C.PITCH_H/2, C.CENTER_CIRCLE_R);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(C.PITCH_W/2, C.PITCH_H/2, 3);

    let pbh = C.PENALTY_BOX_H, pbw = C.PENALTY_BOX_W;
    g.strokeRect(0, C.PITCH_H/2 - pbh/2, pbw, pbh);
    g.strokeRect(C.PITCH_W - pbw, C.PITCH_H/2 - pbh/2, pbw, pbh);

    let syh = C.SIX_YARD_H, syw = C.SIX_YARD_W;
    g.strokeRect(0, C.PITCH_H/2 - syh/2, syw, syh);
    g.strokeRect(C.PITCH_W - syw, C.PITCH_H/2 - syh/2, syw, syh);

    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(C.PENALTY_SPOT, C.PITCH_H/2, 2);
    g.fillCircle(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2, 2);

    g.beginPath(); g.arc(C.PENALTY_SPOT, C.PITCH_H/2, 40, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40), false); g.strokePath();
    g.beginPath(); g.arc(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2, 40, Phaser.Math.DegToRad(140), Phaser.Math.DegToRad(220), false); g.strokePath();

    g.beginPath(); g.arc(0, 0, C.CORNER_ARC_R, 0, Math.PI/2, false); g.strokePath();
    g.beginPath(); g.arc(C.PITCH_W, 0, C.CORNER_ARC_R, Math.PI/2, Math.PI, false); g.strokePath();
    g.beginPath(); g.arc(0, C.PITCH_H, C.CORNER_ARC_R, -Math.PI/2, 0, false); g.strokePath();
    g.beginPath(); g.arc(C.PITCH_W, C.PITCH_H, C.CORNER_ARC_R, Math.PI, Math.PI*1.5, false); g.strokePath();

    g.fillStyle(0xffffff, 0.9);
    g.fillRect(-5, C.GOAL_Y, 5, C.GOAL_W);
    g.fillRect(C.PITCH_W, C.GOAL_Y, 5, C.GOAL_W);

    g.lineStyle(0.5, 0xffffff, 0.25);
    for (let y = C.GOAL_Y; y <= C.GOAL_Y + C.GOAL_W; y += 8) {
      g.beginPath(); g.moveTo(-15, y); g.lineTo(-5, y); g.strokePath();
      g.beginPath(); g.moveTo(C.PITCH_W+5, y); g.lineTo(C.PITCH_W+15, y); g.strokePath();
    }
    for (let x = -15; x <= -5; x += 8) {
      g.beginPath(); g.moveTo(x, C.GOAL_Y); g.lineTo(x, C.GOAL_Y+C.GOAL_W); g.strokePath();
    }
    for (let x = C.PITCH_W+5; x <= C.PITCH_W+15; x += 8) {
      g.beginPath(); g.moveTo(x, C.GOAL_Y); g.lineTo(x, C.GOAL_Y+C.GOAL_W); g.strokePath();
    }
  }
}

let engine;

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  parent: 'pitch-container',
  scene: MatchScene,
  backgroundColor: '#0a0a0a'
};

document.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);

  // Start Menu Listeners
  document.getElementById('btn-menu-start-match').addEventListener('click', () => {
    document.getElementById('start-menu-overlay').classList.add('hidden');
    document.getElementById('btn-exit-scenario').classList.add('hidden');
    if (engine && engine.state === 'STOPPED') {
      engine.resetKickoff(0);
      document.getElementById('btn-start').innerText = 'Pause';
    }
  });

  const setupScenario = (callback) => {
    document.getElementById('start-menu-overlay').classList.add('hidden');
    document.getElementById('btn-exit-scenario').classList.remove('hidden');
    if (engine) {
      engine.resetKickoff(0); // Resets to base positions
      setTimeout(callback, 100);
      document.getElementById('btn-start').innerText = 'Pause';
    }
  };

  document.getElementById('btn-menu-corner').addEventListener('click', () => {
    setupScenario(() => {
      engine.triggerSetPiece('CORNER', new Vector(C.PITCH_W, C.PITCH_H), 0);
    });
  });

  document.getElementById('btn-menu-freekick').addEventListener('click', () => {
    setupScenario(() => {
      // Free kick right outside the penalty box for Home team
      engine.triggerSetPiece('FREE_KICK', new Vector(C.PITCH_W - C.PENALTY_BOX_W - 10, C.PITCH_H/2 + 20), 0);
    });
  });

  document.getElementById('btn-menu-offside').addEventListener('click', () => {
    setupScenario(() => {
      // Force an offside scenario
      let attacker = engine.getActivePlayers(0).find(p => p.role === 'FWD');
      let defender = engine.getActivePlayers(1).find(p => p.role === 'DEF');
      let passer = engine.getActivePlayers(0).find(p => p.role === 'MID');
      
      if (attacker && defender && passer) {
         // Place attacker blatantly offside
         attacker.pos = new Vector(C.PITCH_W - 50, C.PITCH_H/2);
         // Place defender further up
         defender.pos = new Vector(C.PITCH_W - 150, C.PITCH_H/2);
         // Give ball to passer
         passer.pos = new Vector(C.PITCH_W/2, C.PITCH_H/2);
         engine.ball.owner = null;
         engine.ball.pos = passer.pos.copy();
         // Pass the ball
         engine.ball.vel = Vector.sub(attacker.pos, passer.pos).normalize().mult(6);
         engine.ball.lastTouch = passer;
         engine.state = 'PLAYING';
      }
    });
  });

  document.getElementById('btn-exit-scenario').addEventListener('click', () => {
    document.getElementById('start-menu-overlay').classList.remove('hidden');
    document.getElementById('btn-exit-scenario').classList.add('hidden');
    if (engine) {
      engine.state = 'STOPPED';
      engine.time = 0;
      engine.half = 1;
      engine.score = { home: 0, away: 0 };
      document.getElementById('score-home').innerText = '0';
      document.getElementById('score-away').innerText = '0';
      document.getElementById('match-time').innerText = '00:00';
    }
  });

  document.getElementById('btn-start').addEventListener('click', e => {
    if (engine.state === 'STOPPED') {
      // Initial kickoff: home team kicks off
      engine.resetKickoff(0);
      e.target.innerText = 'Pause';
    } else if (engine.state === 'PLAYING' || engine.state === 'SET_PIECE') {
      engine.state = 'STOPPED'; e.target.innerText = 'Resume';
    } else if (engine.state === 'HALF_TIME') {
      // 2nd half: away team kicks off (FIFA rule)
      engine.half = 2;
      engine.resetKickoff(1);
      e.target.innerText = 'Pause';
      logEvent('⚽ Second Half! Away team kicks off.', 'action');
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

  // Tactic, Formation, Mentality Change Listeners
  const sf = document.getElementById('select-formation');
  if (sf) {
    sf.addEventListener('change', e => {
      if (engine) engine.applyHomeFormation(e.target.value);
    });
  }
  const st = document.getElementById('select-tactic');
  if (st) {
    st.addEventListener('change', e => {
      if (engine) engine.homeTactic = e.target.value;
    });
  }
  const sm = document.getElementById('select-mentality');
  if (sm) {
    sm.addEventListener('change', e => {
      if (engine) engine.homeMentality = e.target.value;
    });
  }
});