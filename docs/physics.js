//used AI the get the physics of the game

const GRAVITY = 1400;

class RagdollPoint {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.oldX = x; this.oldY = y;
    this.pinned = false;
  }
  update(dt, friction, groundY) {
    if (this.pinned) return;
    const vx = (this.x - this.oldX) * friction;
    const vy = (this.y - this.oldY) * friction;
    this.oldX = this.x; this.oldY = this.y;
    this.x += vx;
    this.y += vy + GRAVITY * dt * dt;

    if (this.y > groundY) {
      this.y = groundY;
      this.oldY = this.y + vy * 0.25;
      this.oldX = this.x - vx * 0.55;
    }
  }
}

class RagdollStick {
  constructor(p1, p2, len) {
    this.p1 = p1; this.p2 = p2;
    this.len = len ?? Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
  solve() {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const diff = (this.len - dist) / dist;
    const offX = dx * diff * 0.5;
    const offY = dy * diff * 0.5;
    if (!this.p1.pinned) { this.p1.x -= offX; this.p1.y -= offY; }
    if (!this.p2.pinned) { this.p2.x += offX; this.p2.y += offY; }
  }
}

class Ragdoll {
  constructor(x, y, facing) {
    const f = facing; // 1 = facing right, -1 = facing left
    this.points = {
      head:  new RagdollPoint(x, y - 52),
      neck:  new RagdollPoint(x, y - 40),
      hip:   new RagdollPoint(x, y),
      hand:  new RagdollPoint(x + 22 * f, y - 30),
      elbow: new RagdollPoint(x + 10 * f, y - 34),
      footL: new RagdollPoint(x - 10, y + 34),
      footR: new RagdollPoint(x + 10, y + 34),
    };
    const p = this.points;
    this.sticks = [
      new RagdollStick(p.head, p.neck),
      new RagdollStick(p.neck, p.hip),
      new RagdollStick(p.neck, p.elbow),
      new RagdollStick(p.elbow, p.hand),
      new RagdollStick(p.hip, p.footL),
      new RagdollStick(p.hip, p.footR),
      new RagdollStick(p.footL, p.footR),
    ];
    this.settleTimer = 2.2;
  }

  applyImpulse(px, py, fx, fy) {
    let nearest = null, best = Infinity;
    for (const key in this.points) {
      const p = this.points[key];
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < best) { best = d; nearest = p; }
    }
    if (nearest) {
      nearest.oldX -= fx * 0.02;
      nearest.oldY -= fy * 0.02;
    }
  }

  update(dt, groundY) {
    if (this.settleTimer <= 0) return;
    this.settleTimer -= dt;
    for (const key in this.points) this.points[key].update(dt, 0.985, groundY);
    for (let i = 0; i < 4; i++) this.sticks.forEach(s => s.solve());
  }

  draw(ctx) {
    const p = this.points;
    ctx.strokeStyle = "#e9e7e0";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.neck.x, p.neck.y); ctx.lineTo(p.hip.x, p.hip.y);
    ctx.moveTo(p.hip.x, p.hip.y); ctx.lineTo(p.footL.x, p.footL.y);
    ctx.moveTo(p.hip.x, p.hip.y); ctx.lineTo(p.footR.x, p.footR.y);
    ctx.moveTo(p.neck.x, p.neck.y); ctx.lineTo(p.elbow.x, p.elbow.y);
    ctx.lineTo(p.hand.x, p.hand.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.head.x, p.head.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#181d23";
    ctx.fill();
    ctx.stroke();
  }
}
