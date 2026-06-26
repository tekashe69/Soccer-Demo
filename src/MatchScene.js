import Phaser from 'phaser';
import { C, worldToScreen } from './utils/constants.js';
import { MatchEngine, updateUI } from './MatchEngine.js';

let engine;

export class MatchScene extends Phaser.Scene {
  constructor() {
    super('MatchScene');
  }

  create() {
    this.container = this.add.container(0, 0);

    this.pitchGraphics = this.add.graphics();
    this.container.add(this.pitchGraphics);

    this.overlayGraphics = this.add.graphics();
    this.container.add(this.overlayGraphics);

    engine = new MatchEngine(this);
    if (window.setMatchEngine) window.setMatchEngine(engine);
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

    let pt = (x, y, z=0) => worldToScreen(x, y, z);
    let drawLine = (x1, y1, x2, y2) => {
      let p1 = pt(x1, y1), p2 = pt(x2, y2);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.strokePath();
    };
    let drawLineZ = (x1, y1, z1, x2, y2, z2) => {
      let p1 = pt(x1, y1, z1), p2 = pt(x2, y2, z2);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.strokePath();
    };
    let drawRect = (rx, ry, rw, rh) => {
      drawLine(rx, ry, rx+rw, ry);
      drawLine(rx+rw, ry, rx+rw, ry+rh);
      drawLine(rx+rw, ry+rh, rx, ry+rh);
      drawLine(rx, ry+rh, rx, ry);
    };
    let drawArc = (cx, cy, r, startA, endA, segments=20) => {
      g.beginPath();
      for(let i=0; i<=segments; i++){
         let a = startA + (i/segments) * (endA - startA);
         let p = pt(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
         if(i===0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    };

    // Draw crowd dots
    engine.crowd.forEach(c => {
      let p = pt(c.x, c.y);
      let col = parseInt(c.color.replace('#', '0x'));
      g.fillStyle(col, 1); 
      g.fillRect(p.x, p.y, 3 * p.scale, 3 * p.scale); 
    });

    // Premium Grass Base
    g.fillStyle(0x288741, 1);
    let pTL = pt(0, 0), pTR = pt(C.PITCH_W, 0);
    let pBL = pt(0, C.PITCH_H), pBR = pt(C.PITCH_W, C.PITCH_H);
    g.beginPath(); g.moveTo(pTL.x, pTL.y); g.lineTo(pTR.x, pTR.y); g.lineTo(pBR.x, pBR.y); g.lineTo(pBL.x, pBL.y); g.fillPath();
    
    // Mowing stripes
    g.fillStyle(0x3ab859, 0.8);
    for (let x = 0; x < C.PITCH_W; x += 50) {
      if ((x/50) % 2 === 0) {
        let tL = pt(x, 0), tR = pt(x + 50, 0);
        let bL = pt(x, C.PITCH_H), bR = pt(x + 50, C.PITCH_H);
        g.beginPath(); g.moveTo(tL.x, tL.y); g.lineTo(tR.x, tR.y); g.lineTo(bR.x, bR.y); g.lineTo(bL.x, bL.y); g.fillPath();
      }
    }

    g.lineStyle(2, 0xffffff, 0.6);
    drawRect(0, 0, C.PITCH_W, C.PITCH_H);
    drawLine(C.PITCH_W/2, 0, C.PITCH_W/2, C.PITCH_H);

    drawArc(C.PITCH_W/2, C.PITCH_H/2, C.CENTER_CIRCLE_R, 0, Math.PI*2, 40);
    g.fillStyle(0xffffff, 0.6);
    let centerPt = pt(C.PITCH_W/2, C.PITCH_H/2);
    g.fillCircle(centerPt.x, centerPt.y, 3 * centerPt.scale);

    let pbh = C.PENALTY_BOX_H, pbw = C.PENALTY_BOX_W;
    drawRect(0, C.PITCH_H/2 - pbh/2, pbw, pbh);
    drawRect(C.PITCH_W - pbw, C.PITCH_H/2 - pbh/2, pbw, pbh);

    let syh = C.SIX_YARD_H, syw = C.SIX_YARD_W;
    drawRect(0, C.PITCH_H/2 - syh/2, syw, syh);
    drawRect(C.PITCH_W - syw, C.PITCH_H/2 - syh/2, syw, syh);

    let p1 = pt(C.PENALTY_SPOT, C.PITCH_H/2);
    let p2 = pt(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(p1.x, p1.y, 2 * p1.scale);
    g.fillCircle(p2.x, p2.y, 2 * p2.scale);

    drawArc(C.PENALTY_SPOT, C.PITCH_H/2, 40, -40 * Math.PI/180, 40 * Math.PI/180);
    drawArc(C.PITCH_W - C.PENALTY_SPOT, C.PITCH_H/2, 40, 140 * Math.PI/180, 220 * Math.PI/180);

    drawArc(0, 0, C.CORNER_ARC_R, 0, Math.PI/2);
    drawArc(C.PITCH_W, 0, C.CORNER_ARC_R, Math.PI/2, Math.PI);
    drawArc(0, C.PITCH_H, C.CORNER_ARC_R, -Math.PI/2, 0);
    drawArc(C.PITCH_W, C.PITCH_H, C.CORNER_ARC_R, Math.PI, Math.PI*1.5);

    // 3D GOALS
    let goalZ = 45;
    
    let drawGoal = (isLeft) => {
      let gx = isLeft ? 0 : C.PITCH_W;
      let netX = isLeft ? -25 : C.PITCH_W + 25;
      
      // Base Shadows for posts
      g.fillStyle(0x000000, 0.4);
      let p1s = pt(gx, C.GOAL_Y, 0); g.fillCircle(p1s.x, p1s.y, 5 * p1s.scale);
      let p2s = pt(gx, C.GOAL_Y+C.GOAL_W, 0); g.fillCircle(p2s.x, p2s.y, 5 * p2s.scale);

      // Fill faces for the net to make it look solid
      g.fillStyle(0xffffff, 0.15);
      
      // Back Net Fill
      let pTL = pt(netX, C.GOAL_Y, goalZ), pTR = pt(netX, C.GOAL_Y+C.GOAL_W, goalZ);
      let pBL = pt(netX, C.GOAL_Y, 0), pBR = pt(netX, C.GOAL_Y+C.GOAL_W, 0);
      g.beginPath(); g.moveTo(pTL.x, pTL.y); g.lineTo(pTR.x, pTR.y); g.lineTo(pBR.x, pBR.y); g.lineTo(pBL.x, pBL.y); g.fillPath();

      // Top Net Fill
      let ptFrontTL = pt(gx, C.GOAL_Y, goalZ), ptFrontTR = pt(gx, C.GOAL_Y+C.GOAL_W, goalZ);
      g.beginPath(); g.moveTo(ptFrontTL.x, ptFrontTL.y); g.lineTo(ptFrontTR.x, ptFrontTR.y); g.lineTo(pTR.x, pTR.y); g.lineTo(pTL.x, pTL.y); g.fillPath();

      // Side Net Fills
      let ptFrontBL = pt(gx, C.GOAL_Y, 0);
      g.beginPath(); g.moveTo(ptFrontTL.x, ptFrontTL.y); g.lineTo(pTL.x, pTL.y); g.lineTo(pBL.x, pBL.y); g.lineTo(ptFrontBL.x, ptFrontBL.y); g.fillPath();
      
      let ptFrontBR = pt(gx, C.GOAL_Y+C.GOAL_W, 0);
      g.beginPath(); g.moveTo(ptFrontTR.x, ptFrontTR.y); g.lineTo(pTR.x, pTR.y); g.lineTo(pBR.x, pBR.y); g.lineTo(ptFrontBR.x, ptFrontBR.y); g.fillPath();

      // Dense Net Wireframe
      g.lineStyle(1.5, 0xffffff, 0.5);
      let steps = 10;
      for (let i = 0; i <= steps; i++) {
        let f = i / steps;
        let yPos = C.GOAL_Y + f * C.GOAL_W;
        // Back net grid
        drawLineZ(netX, C.GOAL_Y, f * goalZ, netX, C.GOAL_Y + C.GOAL_W, f * goalZ);
        drawLineZ(netX, yPos, goalZ, netX, yPos, 0);
        // Top net grid
        drawLineZ(gx, yPos, goalZ, netX, yPos, goalZ);
        drawLineZ(gx + (netX - gx)*f, C.GOAL_Y, goalZ, gx + (netX - gx)*f, C.GOAL_Y+C.GOAL_W, goalZ);
      }

      // Outer Support Bars
      g.lineStyle(4, 0xffffff, 0.9);
      drawLineZ(gx, C.GOAL_Y, goalZ, netX, C.GOAL_Y, 0);
      drawLineZ(gx, C.GOAL_Y+C.GOAL_W, goalZ, netX, C.GOAL_Y+C.GOAL_W, 0);

      // Thick Goal Posts with 3D Effect
      g.lineStyle(8, 0xffffff, 1);
      drawLineZ(gx, C.GOAL_Y, 0, gx, C.GOAL_Y, goalZ);
      drawLineZ(gx, C.GOAL_Y+C.GOAL_W, 0, gx, C.GOAL_Y+C.GOAL_W, goalZ);
      drawLineZ(gx, C.GOAL_Y, goalZ, gx, C.GOAL_Y+C.GOAL_W, goalZ);
      
      // Inner shading for posts
      g.lineStyle(2, 0xcccccc, 1);
      drawLineZ(gx, C.GOAL_Y, 0, gx, C.GOAL_Y, goalZ);
      drawLineZ(gx, C.GOAL_Y+C.GOAL_W, 0, gx, C.GOAL_Y+C.GOAL_W, goalZ);
      drawLineZ(gx, C.GOAL_Y, goalZ, gx, C.GOAL_Y+C.GOAL_W, goalZ);
    };

    drawGoal(true);
    drawGoal(false);
  }
}
