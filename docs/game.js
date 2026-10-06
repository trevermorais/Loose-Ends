const SAVE_KEY = "looseEndsSave";
const TOTAL_ROUNDS = 35;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error("no save");
    return JSON.parse(raw);
  } catch (e) {
    return { coins: 0, kills: 0, bestRun: 0, levels: {}, ownedWeapons: ["standard"], equippedWeapon: "standard" };
  }
}
function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

const save = loadSave();
const lvl = id => (save.levels && save.levels[id]) || 0;

const PLAYER_BASE = {
  maxHealth: 100 + lvl("maxHealth") * 20,
  maxStamina: 100 + lvl("maxStamina") * 15,
  staminaRegen: 14 + lvl("staminaRegen") * 4,
  drawSpeed: 1 + lvl("drawSpeed") * 0.18,
  damage: 30 + lvl("damage") * 3,
  armor: lvl("armor") * 0.08,
  healthRegen: 1.5 + lvl("healthRegen") * 0.5,
};

PLAYER_BASE.armor = Math.min(PLAYER_BASE.armor, 0.4);

const WEAPON_MODS = {
  standard: { dmgMult: 1.35,    speedMult: 1,   color: "#e9e7e0", trail: null },
  fire:     { dmgMult: 1.65, speedMult: 0.85,   color: "#f2603f", trail: "fire" },
  piercing: { dmgMult: 1.95, speedMult: 1.35,color: "#c9e7ff", trail: null },
  explosive:{ dmgMult: 2.20,  speedMult: 0.85,color: "#f2a541", trail: "spark", explode: 65 },
};
const equipped = WEAPON_MODS[save.equippedWeapon] || WEAPON_MODS.standard;

// Canvas setup

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, GROUND_Y = 0;
let playerPlatform = { x: 0, y: 0, w: 100 };
let enemyPlatform = { x: 0, y: 0, w: 100 };

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function randomizePlatforms() {
  const px = clamp(W * (0.14 + Math.random() * 0.9), W * 0.1, W * 0.34);
  const ex = clamp(W * (0.72 + Math.random() * 0.2), W * 0.4, W * 0.92);
  const py = GROUND_Y - 40 + (Math.random() * 5.5 - 4) * 26;
  const ey = GROUND_Y - 40 + (Math.random() * 6 - 5) * 26;
  playerPlatform = { x: px, y: py, w: 100 };
  enemyPlatform = { x: ex, y: ey, w: 100 };
}

function layout() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND_Y = H - 90;
  randomizePlatforms();
}
window.addEventListener("resize", layout);

layout();

// background stars

let stars = [];
function makeStars() {
  stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.6,
    r: Math.random() * 1.6 + 0.3,
    tw: Math.random() * Math.PI * 2,
  }));
}
makeStars();
window.addEventListener("resize", makeStars);

// Entities

const GRAVITY_G = 1400;
const ARROW_GRAVITY = 920;
const ARROW_POWER_SCALE = 1500;

const player = {
  x: 0, y: 0, vx: 0, vy: 0, grounded: true, facing: 1,
  health: PLAYER_BASE.maxHealth, maxHealth: PLAYER_BASE.maxHealth,
  stamina: PLAYER_BASE.maxStamina, maxStamina: PLAYER_BASE.maxStamina,
  isDrawing: false, aimDX: 0, aimDY: 0,
  cooldown: 0,
};

const enemy = {
  x: 0, y: 0, health: 150, maxHealth: 150, facing: -1,
  state: "idle", stateTimer: 1.2, aimDX: 0, aimDY: 0, telegraph: 0,
  isBoss: false, scale: 1,
};

let arrows = [];
let particles = [];
let ragdolls = [];

let round = 1;
let score = 0;
let runCoinsEarned = 0;
let gameState = "intro";

function resetPositions() {
  player.x = playerPlatform.x; player.y = playerPlatform.y - 30;
  player.vx = 0; player.vy = 0; player.grounded = true;
  enemy.x = enemyPlatform.x; enemy.y = enemyPlatform.y - 30;
}
resetPositions();

function isBossRound(r) { return r % 10 === 0; }

function enemyStatsForRound(r) {
  const base = {
    maxHealth: 80 + r * 10,
    damage: 30 + r * 2.5,
    accuracyNoise: Math.max(0.01, 0.22 - r * 0.045),
    telegraphTime: Math.max(0.20, 1.0 - r * 0.09),
    cooldown: Math.max(0.4, 1.6 - r * 0.06),
  };

  if (isBossRound(r)) {
    return {
      maxHealth: Math.round(base.maxHealth * 3.5),
      damage: Math.round(base.damage * 3.0),
      accuracyNoise: base.accuracyNoise * 0.35,
      telegraphTime: base.telegraphTime * 0.7,
      cooldown: Math.max(0.3, base.cooldown * 0.50),
      isBoss: true,
      scale: 1.45,
    };
  }
  return { ...base, isBoss: false, scale: 1 };
}

function startRound(r) {
  round = r;
  const stats = enemyStatsForRound(r);
  enemy.maxHealth = stats.maxHealth;
  enemy.health = stats.maxHealth;
  enemy.isBoss = stats.isBoss;
  enemy.scale = stats.scale;
  enemy.state = "idle";
  enemy.stateTimer = 0.8;
  arrows = [];
  ragdolls = ragdolls.filter(rd => rd.settleTimer > 0); // let old ones finish falling, harmless
  randomizePlatforms();
  resetPositions();
  document.getElementById("roundNum").textContent = round;
  document.getElementById("scoreNum").textContent = score;
  document.getElementById("enemyName").textContent = stats.isBoss ? `Boss ${round}` : `Rival ${round}`;
  const banner = document.getElementById("roundBanner");
  banner.classList.toggle("boss", stats.isBoss);
  showRoundBanner(stats.isBoss ? `BOSS ROUND ${round}` : `ROUND ${round}`);
  gameState = "playing";
}

function showRoundBanner(text) {
  const el = document.getElementById("roundBanner");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1100);
}

// Input — drag from the player to draw the bow, WASD/space to move+jump

const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "Escape") window.location.href = "index.html";
});
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

const MAX_PULL = 90;

let aimTouchId = null; // which finger is drawing the bow (so the move/jump thumb doesn't interfere)

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  let t = e;
  if (e.changedTouches) {
    t = Array.from(e.touches).find(x => x.identifier === aimTouchId) || e.changedTouches[0];
  }
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function withinDrawRange(p) {
  return Math.hypot(p.x - player.x, p.y - (player.y - 30)) < 70;
}

function startDraw(e) {
  if (gameState !== "playing" || player.stamina <= 5) return;
  const p = pointerPos(e);
  if (!withinDrawRange(p)) return;
  player.isDrawing = true;
  player.aimDX = 0; player.aimDY = 0;
}
function moveDraw(e) {
  if (!player.isDrawing) return;
  const p = pointerPos(e);
  const anchorX = player.x, anchorY = player.y - 30;
  let dx = p.x - anchorX, dy = p.y - anchorY;
  const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
  const ang = Math.atan2(dy, dx);
  player.aimDX = Math.cos(ang) * dist;
  player.aimDY = Math.sin(ang) * dist;
}
function releaseDraw() {
  if (!player.isDrawing) return;
  player.isDrawing = false;
  const pull = Math.hypot(player.aimDX, player.aimDY);
  if (pull > 10) {
    const power = (pull / MAX_PULL) * ARROW_POWER_SCALE * equipped.speedMult;
    const ang = Math.atan2(player.aimDY, player.aimDX);
    fireArrow(
      player.x, player.y - 30,
      -Math.cos(ang) * power, -Math.sin(ang) * power,
      "player"
    );
    player.stamina = Math.max(0, player.stamina - (14 + pull / 8));
    player.facing = Math.cos(ang) > 0 ? -1 : 1;
  }
  player.aimDX = 0; player.aimDY = 0;
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
window.addEventListener("mouseup", releaseDraw);
canvas.addEventListener("touchstart", e => {
  if (aimTouchId !== null) return;
  aimTouchId = e.changedTouches[0].identifier;
  startDraw(e);
  if (!player.isDrawing) aimTouchId = null; // touch wasn't on the archer
}, { passive: true });
canvas.addEventListener("touchmove", e => {
  if (aimTouchId === null) return;
  if (Array.from(e.touches).some(t => t.identifier === aimTouchId)) moveDraw(e);
}, { passive: true });
function endTouch(e) {
  if (aimTouchId === null) return;
  if (Array.from(e.changedTouches).some(t => t.identifier === aimTouchId)) {
    releaseDraw();
    aimTouchId = null;
  }
}
window.addEventListener("touchend", endTouch);
window.addEventListener("touchcancel", endTouch);

// On-screen move / jump buttons (touch devices) feed the same `keys` map as the keyboard
document.querySelectorAll("[data-key]").forEach(btn => {
  const k = btn.dataset.key;
  const down = ev => { ev.preventDefault(); keys[k] = true; btn.classList.add("down"); };
  const up = ev => { ev.preventDefault(); keys[k] = false; btn.classList.remove("down"); };
  btn.addEventListener("touchstart", down, { passive: false });
  btn.addEventListener("touchend", up, { passive: false });
  btn.addEventListener("touchcancel", up, { passive: false });
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
});

function fireArrow(x, y, vx, vy, owner) {
  arrows.push({
    x, y, vx, vy, owner,
    dmg: owner === "player"
      ? PLAYER_BASE.damage * equipped.dmgMult
      : enemyStatsForRound(round).damage,
    trail: owner === "player" ? equipped.trail : null,
    color: owner === "player" ? equipped.color : "#c9484f",
    explode: owner === "player" ? equipped.explode : null,
    dead: false,
  });
}

//Enemy AI

function updateEnemyAI(dt) {
  const stats = enemyStatsForRound(round);
  enemy.stateTimer -= dt;

  if (enemy.state === "idle" && enemy.stateTimer <= 0) {
    enemy.state = "aiming";
    enemy.stateTimer = stats.telegraphTime;

    const dx = player.x - enemy.x;
    const dy = (player.y - 30) - (enemy.y - 30);
    const power = stats.isBoss ? 1300 : 1150;
    const g = 820;

    const root = Math.pow(power, 4) - g * (g * dx * dx - 2 * power * power * dy);
    let baseAngle = Math.atan2(dy, dx);

    if (root >= 0) {
      const top = -power * power + Math.sqrt(root);
      const bottom = g * dx;
      baseAngle = Math.atan(top / bottom);
      if (dx < 0) baseAngle += Math.PI;
    }

    enemy.aimAngle = baseAngle + (Math.random() * 2 - 1) * stats.accuracyNoise;

  } else if (enemy.state === "aiming" && enemy.stateTimer <= 0) {
    const power = stats.isBoss ? 1300 : 1150;
    fireArrow(
      enemy.x, enemy.y - 30,
      Math.cos(enemy.aimAngle) * power,
      Math.sin(enemy.aimAngle) * power,
      "enemy"
    );
    enemy.state = "cooldown";
    enemy.stateTimer = stats.cooldown;
  } else if (enemy.state === "cooldown" && enemy.stateTimer <= 0) {
    enemy.state = "idle";
    enemy.stateTimer = 0.3 + Math.random() * 0.4;
  }

  enemy.facing = player.x < enemy.x ? -1 : 1;
}

// Player Movement

function updatePlayerMovement(dt) {
  const speed = 220;
  let moveDir = 0;
  if (keys["a"] || keys["arrowleft"]) moveDir -= 1;
  if (keys["d"] || keys["arrowright"]) moveDir += 1;
  if (!player.isDrawing) player.vx = moveDir * speed;
  else player.vx = 0;

  const minX = playerPlatform.x - playerPlatform.w / 2 + 14;
  const maxX = playerPlatform.x + playerPlatform.w / 2 - 14;
  player.x = Math.min(maxX, Math.max(minX, player.x + player.vx * dt));

  if ((keys["w"] || keys[" "]) && player.grounded) {
    if (player.stamina >= 12) {
      player.vy = -440;
      player.grounded = false;
      player.stamina -= 12;
    }
  }
  if (!player.grounded) {
    player.vy += GRAVITY_G * dt;
    player.y += player.vy * dt;
    if (player.y >= playerPlatform.y) {
      player.y = playerPlatform.y - 30;
      player.vy = 0;
      player.grounded = true;
    }
  }

  if (!player.isDrawing) {
    player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_BASE.staminaRegen * dt);
  }

  if (player.health > 0 && player.health < PLAYER_BASE.maxHealth) {
    player.health += PLAYER_BASE.healthRegen * dt;

    if (player.health > PLAYER_BASE.maxHealth) {
      player.health = PLAYER_BASE.maxHealth;
    }
  }
}

// Arrow physics + collisions

function circleHit(ax, ay, cx, cy, r) {
  return Math.hypot(ax - cx, ay - cy) < r;
}

function applyDamage(target, dmg, isPlayer) {
  const dealt = isPlayer ? dmg * (1 - PLAYER_BASE.armor) : dmg;
  target.health = Math.max(0, target.health - dealt);
  return dealt;
}

function spawnHitSpark(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 140;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0.4 + Math.random() * 0.3, color,
    });
  }
}

function killToRagdoll(entity, isPlayerTarget, hitVX, hitVY) {
  const facing = isPlayerTarget ? player.facing : enemy.facing;
  const rd = new Ragdoll(entity.x, entity.y - 20, facing);
  rd.applyImpulse(entity.x, entity.y - 30, hitVX, hitVY);
  ragdolls.push(rd);
}

function updateArrows(dt) {
  for (const a of arrows) {
    if (a.dead) continue;
    a.vy += ARROW_GRAVITY * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    if (a.trail === "fire" && Math.random() < 0.6) {
      particles.push({ x: a.x, y: a.y, vx: -a.vx * 0.05, vy: -a.vy * 0.05 + 20, life: 0.35, color: "#f2603f" });
    }

    if (a.x < -60 || a.x > W + 60 || a.y > H + 60) { a.dead = true; continue; }
    if (a.y > GROUND_Y + 20) { a.dead = true; spawnHitSpark(a.x, GROUND_Y, "#8b93a1"); continue; }

    if (a.owner === "player" && enemy.health > 0) {
      const enemyScale = enemy.scale || 1;
      if (circleHit(a.x, a.y, enemy.x, enemy.y - (34 * enemyScale), 32 * enemyScale)) {
        a.dead = true;
        const dealt = applyDamage(enemy, a.dmg, false);
        spawnHitSpark(a.x, a.y, a.color);
        if (a.explode) explodeAt(a.x, a.y, a.explode, a.dmg * 0.5, "enemy");
        if (enemy.health <= 0) onEnemyDown(a.vx, a.vy);
      }
    } else if (a.owner === "enemy" && player.health > 0) {
      if (circleHit(a.x, a.y, player.x, player.y - 34, 32)) {
        a.dead = true;
        applyDamage(player, a.dmg, true);
        spawnHitSpark(a.x, a.y, a.color);
        if (player.health <= 0) onPlayerDown(a.vx, a.vy);
      }
    }
  }
  arrows = arrows.filter(a => !a.dead);
}

function explodeAt(x, y, radius, dmg, targetSide) {
  spawnHitSpark(x, y, "#f2a541");
  if (targetSide === "enemy" && circleHit(x, y, enemy.x, enemy.y - 30, radius * (enemy.scale || 1))) {
    applyDamage(enemy, dmg, false);
    if (enemy.health <= 0) onEnemyDown(0, -300);
  }
}

function onEnemyDown(vx, vy) {
  if (gameState !== "playing") return;
  killToRagdoll(enemy, false, vx, vy);
  enemy.health = 0;
  score += 1;
  save.kills += 1;
  const reward = 8 + Math.floor(round * 1.2);
  save.coins += reward;
  runCoinsEarned += reward;
  save.bestRun = Math.max(save.bestRun, score);
  writeSave(save);
  gameState = "roundover";
  setTimeout(() => {
    if (score >= TOTAL_ROUNDS) {
      finishVictory();
    } else {
      startRound(round + 1);
    }
  }, 900);
}

function onPlayerDown(vx, vy) {
  if (gameState !== "playing") return;
  killToRagdoll(player, true, vx, vy);
  player.health = 0;
  gameState = "gameover";
  save.bestRun = Math.max(save.bestRun, score);
  writeSave(save);
  document.getElementById("loseStats").textContent =
    `Reached round ${round} · earned ${runCoinsEarned} \u25C6`;
  setTimeout(() => document.getElementById("loseOverlay").classList.add("show"), 700);
}

function finishVictory() {
  gameState = "victory";
  document.getElementById("winStats").textContent =
    `All ${TOTAL_ROUNDS} rounds cleared · earned ${runCoinsEarned} \u25C6`;
  setTimeout(() => document.getElementById("winOverlay").classList.add("show"), 500);
}

document.getElementById("retryBtn").addEventListener("click", () => location.reload());
document.getElementById("loseMenuBtn").addEventListener("click", () => window.location.href = "index.html");
document.getElementById("playAgainBtn").addEventListener("click", () => location.reload());
document.getElementById("winMenuBtn").addEventListener("click", () => window.location.href = "index.html");


function drawBackground(t) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0d11");
  grad.addColorStop(1, "#171d24");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    const alpha = 0.4 + Math.sin(t * 2 + s.tw) * 0.3;
    ctx.fillStyle = `rgba(233,231,224,${Math.max(0, alpha)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // distant hill silhouette
  ctx.fillStyle = "#12161b";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 100);
  ctx.quadraticCurveTo(W * 0.25, GROUND_Y - 40, W * 0.5, GROUND_Y + 5);
  ctx.quadraticCurveTo(W * 0.75, GROUND_Y - 20, W, GROUND_Y + 15);
  ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.fill();

  // ground
  ctx.fillStyle = "#1b2129";
  ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y - 20);
  ctx.strokeStyle = "#2c3542";
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 20); ctx.lineTo(W, GROUND_Y + 20); ctx.stroke();
}

function drawTorch(x, y, t) {
  ctx.save();
  ctx.strokeStyle = "#3a2f22";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke();
  const flick = 0.55 + Math.sin(t * 9 + x) * 0.15 + Math.sin(t * 23 + x) * 0.08;
  const grad = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 13);
  grad.addColorStop(0, `rgba(255,205,120,${flick})`);
  grad.addColorStop(1, "rgba(255,110,40,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(x, y - 6, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPedestal(p, tint, t) {
  const capW = p.w, baseW = p.w * 1.15, topY = p.y;
  ctx.save();
  const grad = ctx.createLinearGradient(0, topY, 0, topY + 22);
  grad.addColorStop(0, "#262e39");
  grad.addColorStop(1, "#1b212a");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#333d4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - baseW / 2, topY + 22);
  ctx.lineTo(p.x - capW / 2, topY);
  ctx.lineTo(p.x + capW / 2, topY);
  ctx.lineTo(p.x + baseW / 2, topY + 22);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = tint;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - capW / 2 + 5, topY + 3);
  ctx.lineTo(p.x + capW / 2 - 5, topY + 3);
  ctx.stroke();

  // support column down to the ground
  ctx.fillStyle = "#20262e";
  ctx.fillRect(p.x - 9, topY + 22, 18, GROUND_Y + 20 - (topY + 22));

  const torchX = (p.x + 20) + (tint === "#3fa9e0" ? -baseW / 2 - 12 : baseW / 2 + 12);
  drawTorch(torchX, topY - 4, t);


  ctx.restore();
}

function drawPedestal_enemy(p, tint, t) {
  const capW = p.w, baseW = p.w * 1.15, topY = p.y;
  ctx.save();
  const grad = ctx.createLinearGradient(0, topY, 0, topY + 22);
  grad.addColorStop(0, "#262e39");
  grad.addColorStop(1, "#1b212a");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#333d4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - baseW / 2, topY + 22);
  ctx.lineTo(p.x - capW / 2, topY);
  ctx.lineTo(p.x + capW / 2, topY);
  ctx.lineTo(p.x + baseW / 2, topY + 22);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = tint;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - capW / 2 + 5, topY + 3);
  ctx.lineTo(p.x + capW / 2 - 5, topY + 3);
  ctx.stroke();

  // support column down to the ground

  ctx.fillStyle = "#20262e";
  ctx.fillRect(p.x - 9, topY + 22, 18, GROUND_Y + 20 - (topY + 22));

  const torchX = (p.x - 20) + (tint === "#3fa9e0" ? -baseW / 2 - 12 : baseW / 2 + 12);
  drawTorch(torchX, topY - 4, t);


  ctx.restore();
}

function drawArcher(x, y, facing, drawAmount, aimDX, aimDY, color, opts) {
  opts = opts || {};
  const scale = opts.scale || 1;
  const armor = opts.armorColor || "#4a5568";
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // legs
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-9, 30);
  ctx.moveTo(0, 0); ctx.lineTo(9, 30);
  ctx.stroke();

  // torso
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -34);
  ctx.stroke();

  // head + helmet rim
  ctx.beginPath();
  ctx.arc(0, -44, 9, 0, Math.PI * 4);
  ctx.fillStyle = "#181d23";
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = armor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -44, 9, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = armor;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(-6, -33, 12, 22, 3);
    ctx.fill();
  } else {
    ctx.fillRect(-6, -33, 12, 22);
  }
  ctx.beginPath(); ctx.arc(-7, -31, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -31, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = armor;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, 13); ctx.lineTo(-9, 19);
  ctx.moveTo(9, 13); ctx.lineTo(9, 19);
  ctx.stroke();

  if (opts.isBoss) {
    ctx.fillStyle = "#f2a541";
    ctx.beginPath(); ctx.moveTo(-12, -34); ctx.lineTo(-7, -44); ctx.lineTo(-3, -34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -34); ctx.lineTo(7, -44); ctx.lineTo(12, -34); ctx.closePath(); ctx.fill();
  }

  const bowX = 20;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -28); ctx.lineTo(bowX, -26);
  ctx.stroke();

  ctx.strokeStyle = opts.isBoss ? "#f2a541" : "#c98a3a";
  ctx.beginPath();
  ctx.arc(bowX, -26, 20, -0.9, 0.9);
  ctx.stroke();

  ctx.strokeStyle = "#8b93a1";
  ctx.lineWidth = 2;
  const pull = 12 * drawAmount;
  ctx.beginPath();
  ctx.moveTo(bowX + 20 * Math.cos(-0.9), -26 + 20 * Math.sin(-0.9));
  ctx.lineTo(bowX - pull, -26);
  ctx.lineTo(bowX + 20 * Math.cos(0.9), -26 + 20 * Math.sin(0.9));
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -28); ctx.lineTo(bowX - pull, -26);
  ctx.stroke();

  ctx.restore();
}

function drawAimTrajectory() {
  if (!player.isDrawing) return;
  const power = (Math.hypot(player.aimDX, player.aimDY) / MAX_PULL) * ARROW_POWER_SCALE * equipped.speedMult;
  const ang = Math.atan2(player.aimDY, player.aimDX);
  let x = player.x, y = player.y - 30;
  let vx = -Math.cos(ang) * power, vy = -Math.sin(ang) * power;
  ctx.fillStyle = "rgba(233,231,224,0.35)";
  for (let i = 0; i < 16; i++) {
    vy += ARROW_GRAVITY * 0.03;
    x += vx * 0.03; y += vy * 0.03;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawArrow(a) {
  const ang = Math.atan2(a.vy, a.vx);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(ang);
  ctx.strokeStyle = a.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 0); ctx.lineTo(6, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(0, -3); ctx.lineTo(0, 3); ctx.closePath();
  ctx.fillStyle = a.color;
  ctx.fill();
  ctx.restore();
}

function render(t, dt) {
  drawBackground(t);
  drawPedestal(playerPlatform, "#3fa9e0", t);
  drawPedestal_enemy(enemyPlatform, enemy.isBoss ? "#f2a541" : "#e2484f", t);
  drawAimTrajectory();

  const pullAmt = Math.min(1, Math.hypot(player.aimDX, player.aimDY) / MAX_PULL);
  if (player.health > 0) {
    drawArcher(player.x, player.y, player.facing, player.isDrawing ? pullAmt : 0, player.aimDX, player.aimDY, "#e9e7e0",
      { scale: 1, armorColor: "#4a5568" });
  }
  if (enemy.health > 0) {
    const enemyPull = enemy.state === "aiming" ? 1 - Math.max(0, enemy.stateTimer) : 0;
    drawArcher(enemy.x, enemy.y, enemy.facing, Math.min(1, enemyPull), -1, 0, enemy.isBoss ? "#f2c9a0" : "#e6b8b8",
      { scale: enemy.scale, armorColor: enemy.isBoss ? "#8a5a2b" : "#6b4a35", isBoss: enemy.isBoss });
  }

  ragdolls.forEach(rd => rd.draw(ctx));
  arrows.forEach(drawArrow);

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 400 * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function updateHUD() {
  document.getElementById("playerHealthBar").style.width = `${(player.health / player.maxHealth) * 100}%`;
  document.getElementById("playerStaminaBar").style.width = `${(player.stamina / player.maxStamina) * 100}%`;
  document.getElementById("enemyHealthBar").style.width = `${(enemy.health / enemy.maxHealth) * 100}%`;
  document.getElementById("hudCoins").textContent = save.coins;
  document.getElementById("scoreNum").textContent = score;
}

// Main loop

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  if (gameState === "playing") {
    updatePlayerMovement(dt);
    updateEnemyAI(dt);
    updateArrows(dt);
  }
  ragdolls.forEach(rd => rd.update(dt, GROUND_Y + 34));
  updateParticles(dt);
  render(t, dt);
  updateHUD();

  requestAnimationFrame(loop);
}

startRound(1);
requestAnimationFrame(loop);

document.getElementById("pauseMenuBtn").addEventListener("click", () => window.location.href = "index.html");
