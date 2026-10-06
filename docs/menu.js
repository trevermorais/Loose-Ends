//Menu Graphics

const SAVE_KEY = "looseEndsSave";

const UPGRADES = [
  { id: "maxHealth",   name: "Vitality",     desc: "+20 max health",     baseCost: 30, maxLevel: 5 },
  { id: "maxStamina",  name: "Endurance",    desc: "+15 max stamina",    baseCost: 25, maxLevel: 5 },
  { id: "staminaRegen",name: "Second Wind",  desc: "faster stamina regen",baseCost: 20, maxLevel: 5 },
  { id: "drawSpeed",   name: "Fast Draw",    desc: "quicker bow pull",   baseCost: 35, maxLevel: 5 },
  { id: "damage",      name: "Broadhead",    desc: "+3 arrow damage",    baseCost: 45, maxLevel: 5 },
  { id: "armor",       name: "Hide Wrap",    desc: "-8% damage taken",   baseCost: 40, maxLevel: 5 },
];

const WEAPONS = [
  { id: "standard", name: "Standard",  icon: "➶", unlockKills: 0,  cost: 0 },
  { id: "fire",     name: "Firebrand", icon: "🔥", unlockKills: 5,  cost: 100 },
  { id: "piercing", name: "Piercer",   icon: "⚡", unlockKills: 15, cost: 200 },
  { id: "explosive",name: "Volatile",  icon: "💥", unlockKills: 30, cost: 400 },
];

function defaultSave() {
  const levels = {};
  UPGRADES.forEach(u => levels[u.id] = 0);
  return {
    coins: 0,
    kills: 0,
    bestRun: 0,
    levels,
    ownedWeapons: ["standard"],
    equippedWeapon: "standard",
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    // backfill any new fields for older saves
    const base = defaultSave();
    return { ...base, ...parsed, levels: { ...base.levels, ...(parsed.levels || {}) } };
  } catch (e) {
    return defaultSave();
  }
}

function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

let save = loadSave();

function upgradeCost(upgrade, level) {
  return Math.round(upgrade.baseCost * Math.pow(1.45, level));
}

function renderTopbar() {
  document.getElementById("coinCount").textContent = save.coins;
  document.getElementById("killCount").textContent = save.kills;
  document.getElementById("bestRun").textContent = `${save.bestRun} / 35`;
}

function renderUpgrades() {
  const list = document.getElementById("upgradeList");
  list.innerHTML = "";
  UPGRADES.forEach(u => {
    const level = save.levels[u.id] || 0;
    const maxed = level >= u.maxLevel;
    const cost = upgradeCost(u, level);
    const affordable = save.coins >= cost;

    const row = document.createElement("div");
    row.className = "upgrade-row";

    const costEl = document.createElement("div");
    costEl.className = "upgrade-cost";
    costEl.innerHTML = maxed ? "MAX" : `◆ ${cost}`;

    const nameEl = document.createElement("div");
    nameEl.className = "upgrade-name";
    nameEl.textContent = u.name;
    nameEl.title = u.desc;

    const pips = document.createElement("div");
    pips.className = "upgrade-pips";
    for (let i = 0; i < u.maxLevel; i++) {
      const p = document.createElement("div");
      p.className = "pip" + (i < level ? " filled" : "");
      pips.appendChild(p);
    }

    const btn = document.createElement("button");
    btn.className = "upgrade-btn";
    btn.textContent = "+";
    btn.disabled = maxed || !affordable;
    btn.addEventListener("click", () => {
      if (maxed || save.coins < cost) return;
      save.coins -= cost;
      save.levels[u.id] = level + 1;
      writeSave(save);
      renderAll();
    });

    row.append(costEl, nameEl, pips, btn);
    list.appendChild(row);
  });
}

function renderWeapons() {
  const list = document.getElementById("weaponList");
  list.innerHTML = "";
  WEAPONS.forEach(w => {
    const unlocked = save.kills >= w.unlockKills;
    const owned = save.ownedWeapons.includes(w.id);
    const equipped = save.equippedWeapon === w.id;

    const row = document.createElement("div");
    row.className = "weapon-row" + (!unlocked ? " locked" : "") + (equipped ? " equipped" : "");

    const icon = document.createElement("div");
    icon.className = "weapon-icon";
    icon.textContent = w.icon;

    const meta = document.createElement("div");
    meta.className = "weapon-meta";
    const nameEl = document.createElement("div");
    nameEl.className = "weapon-name";
    nameEl.textContent = w.name;
    const reqEl = document.createElement("div");
    reqEl.className = "weapon-req";
    if (!unlocked) {
      reqEl.textContent = `${w.unlockKills} kills to unlock`;
    } else if (!owned) {
      reqEl.textContent = `◆ ${w.cost} to craft`;
    } else {
      reqEl.textContent = equipped ? "equipped" : "tap to equip";
    }
    meta.append(nameEl, reqEl);

    row.append(icon, meta);

    if (equipped) {
      const check = document.createElement("div");
      check.className = "weapon-check";
      check.textContent = "✓";
      row.appendChild(check);
    }

    row.style.cursor = unlocked ? "pointer" : "default";
    row.addEventListener("click", () => {
      if (!unlocked) return;
      if (!owned) {
        if (save.coins < w.cost) return;
        save.coins -= w.cost;
        save.ownedWeapons.push(w.id);
      }
      save.equippedWeapon = w.id;
      writeSave(save);
      renderAll();
    });

    list.appendChild(row);
  });
}

function renderAll() {
  renderTopbar();
  renderUpgrades();
  renderWeapons();
}

renderAll();

document.getElementById("playBtn").addEventListener("click", () => {
  window.location.href = "game.html";
});

// ---------------------------------------------------------------------
// Idle character preview — simple procedural stick-figure archer,
// swaying gently and periodically drawing the bow. No external art.
// ---------------------------------------------------------------------
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
let t = 0;

function drawStickArcher(ctx, x, y, scale, sway, draw) {
  // draw: 0 -> relaxed, 1 -> fully drawn bow
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(sway, 0);

  ctx.strokeStyle = "#e9e7e0";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // legs
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-10, 34);
  ctx.moveTo(0, 0); ctx.lineTo(10, 34);
  ctx.stroke();

  // torso
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -40);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(0, -52, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#181d23";
  ctx.fill();
  ctx.stroke();

  // bow arm + bow
  const bowX = 22;
  ctx.beginPath();
  ctx.moveTo(0, -32); ctx.lineTo(bowX, -30);
  ctx.stroke();

  ctx.strokeStyle = "#f2a541";
  ctx.beginPath();
  ctx.arc(bowX, -30, 22, -0.9, 0.9);
  ctx.stroke();

  // string, pulled back proportionally to `draw`
  const pull = 14 * draw;
  ctx.strokeStyle = "#8b93a1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowX + 22 * Math.cos(-0.9), -30 + 22 * Math.sin(-0.9));
  ctx.lineTo(bowX - pull, -30);
  ctx.lineTo(bowX + 22 * Math.cos(0.9), -30 + 22 * Math.sin(0.9));
  ctx.stroke();

  // draw arm
  ctx.strokeStyle = "#e9e7e0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -32); ctx.lineTo(bowX - pull, -30);
  ctx.stroke();

  ctx.restore();
}

function loop() {
  t += 0.02;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* platform block
  ctx.fillStyle = "#212832";
  ctx.strokeStyle = "#2c3542";
  ctx.lineWidth = 2;
  ctx.fillRect(canvas.width / 2 - 40, 240, 80, 20);
  ctx.strokeRect(canvas.width / 2 - 40, 240, 80, 20);
  */

  const sway = Math.sin(t) * 0;
  const drawCycle = (Math.sin(t * 5) + 1) / 2; // 0..1 breathing draw
  drawStickArcher(ctx, canvas.width / 2, 240, 1.8, sway, drawCycle);

  requestAnimationFrame(loop);
}
loop();
