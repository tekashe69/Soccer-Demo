import { Vector } from './utils/math.js';
import { C } from './utils/constants.js';
import { logEvent, getPenaltyBox, generateAttributes } from './utils/helpers.js';
import { Ball } from './entities/Ball.js';
import { Player } from './entities/Player.js';
import { Referee } from './entities/Referee.js';
import { Linesman } from './entities/Linesman.js';
import { FoulSystem } from './systems/FoulSystem.js';
import { OffsideSystem } from './systems/OffsideSystem.js';
import { AdvantageSystem } from './systems/AdvantageSystem.js';
import { VARSystem } from './systems/VARSystem.js';

export class MatchEngine {
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
      let isGk = p[2] === 'GK';
      let colors = {
        shirt: isGk ? 0x39ff14 : 0xef4444,
        shorts: isGk ? 0x000000 : 0xffffff,
        socks: isGk ? 0x39ff14 : 0xef4444,
        skin: 0xffccaa
      };
      this.players.push(new Player(0, i+1, p[2], p[0], p[1], colors));
    });
    aPos.forEach((p,i) => {
      let isGk = p[2] === 'GK';
      let colors = {
        shirt: isGk ? 0xfacc15 : 0x3b82f6,
        shorts: isGk ? 0x000000 : 0xffffff,
        socks: isGk ? 0xfacc15 : 0x3b82f6,
        skin: 0x8d5524
      };
      this.players.push(new Player(1, i+1, p[2], p[0], p[1], colors));
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
        p.basePos = new Vector(config[0] * 1.3, config[1] * 1.3);
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
    kicker.actionState = 'PASS';
    kicker.actionTimer = 30;
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
      taker.actionState = 'PASS';
      taker.actionTimer = 20;
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
        wp.actionState = 'PASS';
        wp.actionTimer = 20;
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
        p.actionState = 'SHOOT';
        p.actionTimer = 30;
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
    taker.actionState = 'SHOOT';
    taker.actionTimer = 30;
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
        tackler.actionState = 'TACKLE';
        tackler.actionTimer = 30;
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
      let defTeam = t === 'home' ? 1 : 0;
      let pos = new Vector(defTeam === 0 ? 50 : C.PITCH_W - 50, C.PITCH_H / 2);
      setTimeout(() => { this.triggerSetPiece('GOAL_KICK', pos, defTeam); }, 1500);
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

    if (this.state === 'STOPPED' || this.state === 'PAUSED' || this.state === 'HALF_TIME' || this.state === 'FULL_TIME') return;

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
export function updateUI(engine) {
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

