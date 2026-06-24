import { Vector } from '../utils/math.js';
import { C } from '../utils/constants.js';
import { generateAttributes, isInPenaltyBox, logEvent } from '../utils/helpers.js';

export class Player {
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

