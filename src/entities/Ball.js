import { Vector } from '../utils/math.js';
import { C, worldToScreen } from '../utils/constants.js';

export class Ball {
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

    // Net Collisions (Ball bounces inside the net)
    if (this.pos.x < 0 && this.pos.y > C.GOAL_Y && this.pos.y < C.GOAL_Y + C.GOAL_W) {
      if (this.pos.x <= -15) { this.pos.x = -15; this.vel.x *= -0.3; } // Back net
      if (this.pos.y <= C.GOAL_Y + 5) { this.pos.y = C.GOAL_Y + 5; this.vel.y *= -0.3; } // Side net
      if (this.pos.y >= C.GOAL_Y + C.GOAL_W - 5) { this.pos.y = C.GOAL_Y + C.GOAL_W - 5; this.vel.y *= -0.3; } // Side net
      if (this.z >= 35) { this.z = 35; this.vz *= -0.3; } // Top net
    } else if (this.pos.x > C.PITCH_W && this.pos.y > C.GOAL_Y && this.pos.y < C.GOAL_Y + C.GOAL_W) {
      if (this.pos.x >= C.PITCH_W + 15) { this.pos.x = C.PITCH_W + 15; this.vel.x *= -0.3; }
      if (this.pos.y <= C.GOAL_Y + 5) { this.pos.y = C.GOAL_Y + 5; this.vel.y *= -0.3; } 
      if (this.pos.y >= C.GOAL_Y + C.GOAL_W - 5) { this.pos.y = C.GOAL_Y + C.GOAL_W - 5; this.vel.y *= -0.3; } 
      if (this.z >= 35) { this.z = 35; this.vz *= -0.3; } 
    }
  }

  draw() {
    let g = this.graphics;
    g.clear();
    
    let p = worldToScreen(this.pos.x, this.pos.y, this.z);
    let shadowP = worldToScreen(this.pos.x, this.pos.y, 0);

    // Shadow (stays at ground level, scales with height)
    let shadowScale = Math.max(0.2, 1 - (this.z / 100)) * shadowP.scale;
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(shadowP.x + 4 * shadowP.scale, shadowP.y + 4 * shadowP.scale, C.BALL_R * 2 * shadowScale, C.BALL_R * 1.2 * shadowScale);

    // Body (drawn higher up based on Z)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(p.x, p.y, C.BALL_R * p.scale);
    
    // Classic soccer ball pattern dot
    g.fillStyle(0x222222, 1);
    g.fillCircle(p.x + 1 * p.scale, p.y + 1 * p.scale, C.BALL_R * 0.4 * p.scale);

    g.lineStyle(1, 0x333333, 1);
    g.strokeCircle(p.x, p.y, C.BALL_R * p.scale);
  }
}

