import { Vector } from '../utils/math.js';
import { C } from '../utils/constants.js';

export class Linesman {
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

