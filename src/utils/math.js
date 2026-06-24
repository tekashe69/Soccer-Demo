export class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { let m = this.mag(); if (m > 0) this.mult(1 / m); return this; }
  limit(max) { if (this.magSq() > max * max) { this.normalize(); this.mult(max); } return this; }
  dist(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
  copy() { return new Vector(this.x, this.y); }
  static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
  static add(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y); }
}
