import Phaser from 'phaser';
import { C } from './utils/constants.js';
import { MatchEngine, updateUI } from './MatchEngine.js';

let engine;

export class MatchScene extends Phaser.Scene {
  constructor() {
    super('MatchScene');
  }

  create() {
    this.container = this.add.container(20, 30);
    this.container.setScale(0.82);

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
