import { Vector } from '../utils/math.js';
import { C, worldToScreen } from '../utils/constants.js';

export class Linesman {
  constructor(isTop) {
    this.isTop = isTop;
    this.pos = new Vector(C.PITCH_W / 2, isTop ? -12 : C.PITCH_H + 12);
    this.vel = new Vector(0, 0);
    this.flagRaised = false;
    this.flagTimer = 0;
    this.animCycle = 0;
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
      this.pos.x = Math.max(0, Math.min(C.PITCH_W, this.pos.x));
    } else {
      this.vel.mult(0.9);
    }
    this.animCycle += this.vel.mag() * 0.15;
  }

  raiseFlag() { this.flagRaised = true; this.flagTimer = 120; }

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

    // Linesman flag arm
    let fShoulder = this.flagRaised ? -Math.PI/2 : Math.PI/2 - swing * maxShoulder;
    let fElbow = this.flagRaised ? -Math.PI/2 : fShoulder - armBend - Math.max(0, swing) * maxElbow;

    let fHip = Math.PI/2 + swing * maxHip;
    let bHip = Math.PI/2 - swing * maxHip;
    let fKnee = fHip + Math.max(0, -swing) * maxKnee;
    let bKnee = bHip + Math.max(0, swing) * maxKnee;
    let bShoulder = Math.PI/2 + swing * maxShoulder;
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
      return {x: ex, y: ey};
    };

    let hipX = 0, hipY = 2;
    let shoulderX = hipX - Math.sin(bodyLean) * 10;
    let shoulderY = hipY - Math.cos(bodyLean) * 10;

    let shirt = 0xeab308; // Yellow shirt
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
    let handPos = drawLimb(shirt, skin, 3.5, shoulderX, shoulderY, fShoulder, 5, fElbow, 6, false);

    if (this.flagRaised) {
      g.lineStyle(2, 0xef4444, 1);
      g.beginPath();
      g.moveTo(handPos.x, handPos.y);
      g.lineTo(handPos.x, handPos.y - 15);
      g.strokePath();

      g.fillStyle(0xef4444, 1);
      g.beginPath();
      g.moveTo(handPos.x, handPos.y - 8);
      g.lineTo(handPos.x + 8, handPos.y - 11);
      g.lineTo(handPos.x, handPos.y - 14);
      g.fillPath();
    }
  }
}

