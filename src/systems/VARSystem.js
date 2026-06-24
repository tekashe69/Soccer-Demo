import { C } from '../utils/constants.js';
import { logEvent } from '../utils/helpers.js';

export class VARSystem {
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

