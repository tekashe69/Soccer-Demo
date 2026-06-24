import { Vector } from '../utils/math.js';
import { C, REFEREE_NAMES } from '../utils/constants.js';
import { logEvent } from '../utils/helpers.js';

export class Referee {
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

