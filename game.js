const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const coinValue = document.querySelector("#coinValue");
const boostValue = document.querySelector("#boostValue");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const DESIGN_WIDTH = 900;
const DESIGN_HEIGHT = 1200;
const ROAD_LEFT = 150;
const ROAD_RIGHT = 750;
const PLAYER_WIDTH = 58;
const PLAYER_HEIGHT = 104;
const LANES = [250, 350, 450, 550, 650];

const state = {
  status: "menu",
  lastTime: 0,
  score: 0,
  coins: 0,
  distance: 0,
  speed: 360,
  spawnTimer: 0,
  coinTimer: 0,
  stripeOffset: 0,
  flash: 0,
  boost: {
    active: false,
    timer: 0,
    cooldown: 0,
  },
  pointer: {
    x: DESIGN_WIDTH / 2,
    y: DESIGN_HEIGHT * 0.78,
  },
  player: {
    x: DESIGN_WIDTH / 2,
    y: DESIGN_HEIGHT * 0.78,
    lean: 0,
  },
  vehicles: [],
  coinsList: [],
  sparks: [],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function resetGame() {
  state.status = "playing";
  state.lastTime = performance.now();
  state.score = 0;
  state.coins = 0;
  state.distance = 0;
  state.speed = 360;
  state.spawnTimer = 0.4;
  state.coinTimer = 1.2;
  state.stripeOffset = 0;
  state.flash = 0;
  state.boost.active = false;
  state.boost.timer = 0;
  state.boost.cooldown = 0;
  state.pointer.x = DESIGN_WIDTH / 2;
  state.pointer.y = DESIGN_HEIGHT * 0.78;
  state.player.x = DESIGN_WIDTH / 2;
  state.player.y = DESIGN_HEIGHT * 0.78;
  state.player.lean = 0;
  state.vehicles = [];
  state.coinsList = [];
  state.sparks = [];
  overlay.classList.remove("is-visible");
  updateHud();
}

function showStartOverlay() {
  overlay.querySelector("h1").textContent = "Bike Rush";
  overlay.querySelector("p").textContent = "Dodge traffic, collect coins, and chase your best distance.";
  startButton.textContent = "Start Ride";
  overlay.classList.add("is-visible");
}

function resumeGame() {
  if (state.status !== "paused") {
    return;
  }
  state.status = "playing";
  state.lastTime = performance.now();
  overlay.classList.remove("is-visible");
}

function endGame() {
  state.status = "over";
  state.flash = 1;
  createCrashSparks(state.player.x, state.player.y);
  overlay.querySelector("h1").textContent = "Crash!";
  overlay.querySelector("p").textContent = `Score ${Math.floor(state.score)} - Coins ${state.coins}`;
  startButton.textContent = "Ride Again";
  overlay.classList.add("is-visible");
}

function updateHud() {
  scoreValue.textContent = Math.floor(state.score).toLocaleString();
  coinValue.textContent = state.coins.toString();

  if (state.status !== "playing") {
    boostValue.textContent = "Ready";
    return;
  }

  if (state.boost.active) {
    boostValue.textContent = "Boosting";
  } else if (state.boost.cooldown > 0) {
    boostValue.textContent = `${Math.ceil(state.boost.cooldown)}s`;
  } else {
    boostValue.textContent = "Ready";
  }
}

function startBoost() {
  if (state.status !== "playing" || state.boost.active || state.boost.cooldown > 0) {
    return;
  }
  state.boost.active = true;
  state.boost.timer = 0.8;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * DESIGN_WIDTH,
    y: ((clientY - rect.top) / rect.height) * DESIGN_HEIGHT,
  };
}

function movePointer(event) {
  if (event.cancelable) {
    event.preventDefault();
  }
  const point = getCanvasPoint(event);
  state.pointer.x = clamp(point.x, ROAD_LEFT + PLAYER_WIDTH / 2, ROAD_RIGHT - PLAYER_WIDTH / 2);
  state.pointer.y = clamp(point.y, 210, DESIGN_HEIGHT - 130);
}

function createVehicle() {
  const width = randomChoice([62, 70, 84]);
  const height = randomChoice([108, 122, 138]);
  const lane = randomChoice(LANES);
  const colors = ["#ef476f", "#118ab2", "#ffd166", "#f78c6b", "#7bdff2"];
  state.vehicles.push({
    x: lane,
    y: -height - 40,
    width,
    height,
    color: randomChoice(colors),
    speedOffset: Math.random() * 90,
  });
}

function createCoin() {
  state.coinsList.push({
    x: randomChoice(LANES),
    y: -60,
    radius: 22,
    spin: Math.random() * Math.PI,
  });
}

function createCrashSparks(x, y) {
  for (let i = 0; i < 28; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 360;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.4,
      size: 4 + Math.random() * 5,
      color: randomChoice(["#ffd166", "#ff5e66", "#ffffff"]),
    });
  }
}

function update(dt) {
  if (state.status !== "playing" && state.status !== "over") {
    return;
  }

  state.flash = Math.max(0, state.flash - dt * 2.2);
  updateSparks(dt);

  if (state.status !== "playing") {
    return;
  }

  const boostMultiplier = state.boost.active ? 1.55 : 1;
  const currentSpeed = state.speed * boostMultiplier;
  const difficulty = 1 + state.distance / 2600;

  state.distance += (currentSpeed * dt) / 18;
  state.score += dt * (18 + difficulty * 10) * boostMultiplier;
  state.speed = Math.min(760, state.speed + dt * 8.5);
  state.stripeOffset = (state.stripeOffset + currentSpeed * dt) % 130;

  const previousX = state.player.x;
  state.player.x = lerp(state.player.x, state.pointer.x, 0.12);
  state.player.y = lerp(state.player.y, state.pointer.y, 0.08);
  state.player.lean = clamp((state.player.x - previousX) * 0.15, -0.55, 0.55);

  state.boost.timer -= state.boost.active ? dt : 0;
  if (state.boost.active && state.boost.timer <= 0) {
    state.boost.active = false;
    state.boost.cooldown = 3.5;
  }
  state.boost.cooldown = Math.max(0, state.boost.cooldown - dt);

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    createVehicle();
    state.spawnTimer = Math.max(0.42, 1.18 - difficulty * 0.08 - Math.random() * 0.22);
  }

  state.coinTimer -= dt;
  if (state.coinTimer <= 0) {
    createCoin();
    state.coinTimer = Math.max(0.8, 1.8 - difficulty * 0.05 + Math.random() * 0.45);
  }

  for (const vehicle of state.vehicles) {
    vehicle.y += (currentSpeed + vehicle.speedOffset) * dt;
  }
  state.vehicles = state.vehicles.filter((vehicle) => vehicle.y < DESIGN_HEIGHT + vehicle.height);

  for (const coin of state.coinsList) {
    coin.y += currentSpeed * dt;
    coin.spin += dt * 7;
  }
  state.coinsList = state.coinsList.filter((coin) => coin.y < DESIGN_HEIGHT + 60 && !coin.collected);

  handleCollisions();
  updateHud();
}

function updateSparks(dt) {
  for (const spark of state.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += 520 * dt;
    spark.life -= dt;
  }
  state.sparks = state.sparks.filter((spark) => spark.life > 0);
}

function getPlayerBox() {
  return {
    left: state.player.x - PLAYER_WIDTH * 0.36,
    right: state.player.x + PLAYER_WIDTH * 0.36,
    top: state.player.y - PLAYER_HEIGHT * 0.42,
    bottom: state.player.y + PLAYER_HEIGHT * 0.42,
  };
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function handleCollisions() {
  const playerBox = getPlayerBox();

  for (const vehicle of state.vehicles) {
    const box = {
      left: vehicle.x - vehicle.width * 0.42,
      right: vehicle.x + vehicle.width * 0.42,
      top: vehicle.y - vehicle.height * 0.45,
      bottom: vehicle.y + vehicle.height * 0.45,
    };
    if (overlaps(playerBox, box)) {
      endGame();
      return;
    }
  }

  for (const coin of state.coinsList) {
    const dx = coin.x - state.player.x;
    const dy = coin.y - state.player.y;
    if (Math.hypot(dx, dy) < coin.radius + 34) {
      coin.collected = true;
      state.coins += 1;
      state.score += 150;
      createCoinBurst(coin.x, coin.y);
    }
  }
}

function createCoinBurst(x, y) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * 170,
      vy: Math.sin(angle) * 170,
      life: 0.28,
      size: 3,
      color: "#ffd166",
    });
  }
}

function draw() {
  drawBackground();
  drawRoad();
  drawCoins();
  drawVehicles();
  drawBike();
  drawSparks();

  if (state.status === "playing") {
    drawPointerGuide();
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 94, 102, ${state.flash * 0.32})`;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
  sky.addColorStop(0, "#16343b");
  sky.addColorStop(0.48, "#1f3f36");
  sky.addColorStop(1, "#122521");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  ctx.fillStyle = "#264f38";
  for (let i = 0; i < 18; i += 1) {
    const y = (i * 96 + state.stripeOffset * 0.35) % (DESIGN_HEIGHT + 120) - 80;
    ctx.fillRect(54, y, 34, 28);
    ctx.fillRect(812, y + 34, 42, 24);
  }
}

function drawRoad() {
  ctx.fillStyle = "#30363d";
  roundRect(ROAD_LEFT - 42, -20, ROAD_RIGHT - ROAD_LEFT + 84, DESIGN_HEIGHT + 40, 26);
  ctx.fill();

  ctx.fillStyle = "#252a30";
  ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, DESIGN_HEIGHT);

  ctx.fillStyle = "#e8edf2";
  ctx.fillRect(ROAD_LEFT - 16, 0, 12, DESIGN_HEIGHT);
  ctx.fillRect(ROAD_RIGHT + 4, 0, 12, DESIGN_HEIGHT);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 10;
  ctx.setLineDash([54, 76]);
  ctx.lineDashOffset = state.stripeOffset;
  for (let x = 300; x <= 600; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, -80);
    ctx.lineTo(x, DESIGN_HEIGHT + 80);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255, 209, 102, 0.85)";
  for (let y = -120; y < DESIGN_HEIGHT + 120; y += 150) {
    ctx.fillRect(ROAD_LEFT + 14, y + state.stripeOffset, 18, 62);
    ctx.fillRect(ROAD_RIGHT - 32, y + state.stripeOffset, 18, 62);
  }
}

function drawVehicles() {
  for (const vehicle of state.vehicles) {
    ctx.save();
    ctx.translate(vehicle.x, vehicle.y);
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 12;

    ctx.fillStyle = "#171b20";
    roundRect(-vehicle.width / 2 - 6, -vehicle.height / 2 + 10, vehicle.width + 12, vehicle.height - 20, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = vehicle.color;
    roundRect(-vehicle.width / 2, -vehicle.height / 2, vehicle.width, vehicle.height, 18);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    roundRect(-vehicle.width * 0.28, -vehicle.height * 0.22, vehicle.width * 0.56, vehicle.height * 0.22, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(7, 18, 26, 0.55)";
    roundRect(-vehicle.width * 0.3, vehicle.height * 0.1, vehicle.width * 0.6, vehicle.height * 0.28, 8);
    ctx.fill();

    ctx.fillStyle = "#fff0a8";
    ctx.fillRect(-vehicle.width * 0.34, vehicle.height * 0.39, 15, 8);
    ctx.fillRect(vehicle.width * 0.16, vehicle.height * 0.39, 15, 8);
    ctx.restore();
  }
}

function drawCoins() {
  for (const coin of state.coinsList) {
    const scale = 0.68 + Math.abs(Math.cos(coin.spin)) * 0.32;
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(scale, 1);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff1a6";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#9b6b00";
    ctx.font = "bold 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.restore();
  }
}

function drawBike() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.lean);
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 15;

  ctx.strokeStyle = "#10151a";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, -34, 22, 0, Math.PI * 2);
  ctx.arc(0, 36, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#d9fbff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -34, 15, 0, Math.PI * 2);
  ctx.arc(0, 36, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#4ee0a0";
  roundRect(-18, -48, 36, 96, 18);
  ctx.fill();

  ctx.fillStyle = "#0b1518";
  roundRect(-14, -12, 28, 34, 10);
  ctx.fill();

  ctx.fillStyle = "#ff5e66";
  roundRect(-20, -62, 40, 30, 12);
  ctx.fill();

  ctx.strokeStyle = "#f8fbff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-28, -44);
  ctx.lineTo(28, -44);
  ctx.stroke();

  if (state.boost.active) {
    ctx.fillStyle = "rgba(255, 209, 102, 0.9)";
    ctx.beginPath();
    ctx.moveTo(-14, 66);
    ctx.lineTo(0, 116 + Math.sin(performance.now() / 40) * 8);
    ctx.lineTo(14, 66);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawSparks() {
  for (const spark of state.sparks) {
    ctx.globalAlpha = clamp(spark.life * 2.4, 0, 1);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPointerGuide() {
  ctx.strokeStyle = "rgba(78, 224, 160, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(state.pointer.x, state.pointer.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(78, 224, 160, 0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(state.pointer.x, state.pointer.y, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function frame(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerdown", (event) => {
  movePointer(event);
  if (state.status === "menu" || state.status === "over") {
    resetGame();
  } else {
    startBoost();
  }
});

canvas.addEventListener(
  "touchmove",
  (event) => {
    movePointer(event);
  },
  { passive: false },
);

startButton.addEventListener("click", () => {
  if (state.status === "paused") {
    resumeGame();
  } else {
    resetGame();
  }
});

window.addEventListener("blur", () => {
  if (state.status === "playing") {
    state.status = "paused";
    overlay.querySelector("h1").textContent = "Paused";
    overlay.querySelector("p").textContent = "Click to continue the ride.";
    startButton.textContent = "Resume";
    overlay.classList.add("is-visible");
  }
});

overlay.addEventListener("click", () => {
  resumeGame();
});

showStartOverlay();
draw();
requestAnimationFrame(frame);
