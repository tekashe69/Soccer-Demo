import { Vector } from '../utils/math.js';
import { C, REFEREE_NAMES, worldToScreen } from '../utils/constants.js';
import { logEvent } from '../utils/helpers.js';

export class Referee {
  constructor() {
    this.name = REFEREE_NAMES[Math.floor(Math.random() * REFEREE_NAMES.length)];
    this.strictness = Math.floor(10 + Math.random() * 85);
    this.pos = new Vector(C.PITCH_W / 2, C.PITCH_H / 2 + 50);
    this.vel = new Vector(0, 0);
    this.showingCard = null;
    this.whistleTimer = 0;
    this.animCycle = 0;
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
      this.pos.x = Math.max(10, Math.min(C.PITCH_W - 10, this.pos.x));
      this.pos.y = Math.max(10, Math.min(C.PITCH_H - 10, this.pos.y));
    } else {
      this.vel.mult(0.9);
    }
    this.animCycle += this.vel.mag() * 0.15;
  }

  draw() {
    let g = this.graphics;
    g.clear();

    let p = worldToScreen(this.pos.x, this.pos.y, 0);

    g.setPosition(p.x, p.y);
    g.scaleX = (this.vel.x < 0 ? -1 : 1) * p.scale;
    g.scaleY = p.scale;
    g.setRotation(0);

    // Shadow
    g.fillStyle(0x000000, 0.3 * p.scale);
    g.fillEllipse(3 * p.scale, 14 * p.scale, C.PLAYER_R * 2 * p.scale, C.PLAYER_R * 1.5 * p.scale);

    // Body Animation
    let speed = this.vel.mag();
    let swing = Math.sin(this.animCycle);
    let maxHip = speed > 1 ? 0.7 : 0.4;
    let maxKnee = speed > 1 ? 0.8 : 0.5;
    let maxShoulder = speed > 1 ? 0.6 : 0.3;
    let maxElbow = speed > 1 ? 0.5 : 0.3;
    let bodyLean = speed > 1 ? 0.15 : 0;
    let armBend = speed > 1 ? 0.6 : 0.2;

    if (speed < 0.1) {
      maxHip = 0; maxKnee = 0; maxShoulder = 0.1; maxElbow = 0; armBend = 0.2; bodyLean = 0; swing = 0;
    }

    let fHip = Math.PI/2 + swing * maxHip;
    let bHip = Math.PI/2 - swing * maxHip;
    let fKnee = fHip + Math.max(0, -swing) * maxKnee;
    let bKnee = bHip + Math.max(0, swing) * maxKnee;
    let fShoulder = Math.PI/2 - swing * maxShoulder;
    let bShoulder = Math.PI/2 + swing * maxShoulder;
    let fElbow = fShoulder - armBend - Math.max(0, swing) * maxElbow;
    let bElbow = bShoulder - armBend - Math.max(0, -swing) * maxElbow;

    let drawLimb = (col1, col2, thick, sx, sy, a1, l1, a2, l2, isLeg) => {
      let jx = sx + Math.cos(a1) * l1;
      let jy = sy + Math.sin(a1) * l1;
      let ex = jx + Math.cos(a2) * l2;
      let ey = jy + Math.sin(a2) * l2;
      g.lineStyle(thick, col1, 1);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(jx, jy); g.strokePath();
      g.lineStyle(isLeg ? thick - 1 : thick, col2, 1);
      g.beginPath(); g.moveTo(jx, jy); g.lineTo(ex, ey); g.strokePath();
    };

    let hipX = 0, hipY = 2;
    let shoulderX = hipX - Math.sin(bodyLean) * 10;
    let shoulderY = hipY - Math.cos(bodyLean) * 10;

    let shirt = 0x222222; // Black shirt
    let shorts = 0x111111; // Black shorts
    let skin = 0xffcc99;
    let socks = 0x111111; // Black socks

    drawLimb(shirt, skin, 3, shoulderX, shoulderY, bShoulder, 5, bElbow, 6, false);
    drawLimb(shorts, socks, 4, hipX, hipY, bHip, 6, bKnee, 7, true);

    g.lineStyle(8, shirt, 1);
    g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(shoulderX, shoulderY); g.strokePath();
    g.fillStyle(shirt, 1); g.fillCircle(shoulderX, shoulderY, 4);
    g.fillStyle(shorts, 1); g.fillCircle(hipX, hipY, 4);

    let headX = shoulderX - Math.sin(bodyLean) * 5;
    let headY = shoulderY - Math.cos(bodyLean) * 5;
    g.fillStyle(skin, 1); g.fillCircle(headX, headY, 4.5);
    // Hair
    g.fillStyle(0x000000, 1);
    g.fillCircle(headX - 1.5, headY - 2.5, 4.0);
    g.fillCircle(headX - 2.5, headY - 0.5, 3.5);

    drawLimb(shorts, socks, 4.5, hipX, hipY, fHip, 6, fKnee, 7, true);
    drawLimb(shirt, skin, 3.5, shoulderX, shoulderY, fShoulder, 5, fElbow, 6, false);

    this.textObj.setPosition(p.x, p.y - 15 * p.scale);
    this.textObj.setScale(p.scale);

    if (this.showingCard) {
      let alpha = Math.min(1, this.showingCard.timer / 60);
      let fc = this.showingCard.type === 'YELLOW' ? 0xfacc15 : 0xef4444;
      g.fillStyle(fc, alpha);
      g.fillRect(7 * p.scale, -24 * p.scale, 10 * p.scale, 14 * p.scale);
      g.lineStyle(1, 0x000000, alpha);
      g.strokeRect(7 * p.scale, -24 * p.scale, 10 * p.scale, 14 * p.scale);
    }

    if (this.whistleTimer > 0) {
      this.whistleObj.setVisible(true);
      this.whistleObj.setPosition(p.x, p.y - 25 * p.scale);
      this.whistleObj.setScale(p.scale);
    } else {
      this.whistleObj.setVisible(false);
    }
  }
}

