// Wiring for Coin & Crown: input, screens, animation and the game loop.
// The rules live in engine.js; this file only shows them and talks to the player.
import { TABLE, GAME } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { createGame, playCard, buyCard, startEnemyTurn, finishEnemyTurn, summarize } from './engine.js';
import { baronStepper, autopilotStepper } from './ai.js';
import { drawCard, drawCardBack, drawHpBar, drawCoins, drawTable, roundRect } from './render.js';
import { sfx, ensureAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = TABLE.width;
canvas.height = TABLE.height;
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7);

let screen = 'title'; // title | play
let game = createGame(seed);
let hoverIndex = -1;
let hoverMarket = -1;
let mouse = { x: 0, y: 0 };
let lastPlayed = { player: null, enemy: null };
let lastBought = { player: null, enemy: null };
let stats = { damage: 0, cards: 0, crowns: 0, buys: 0 };
let enemyTimer = null;
let enemyBusy = false;

const fx = { floaters: [], particles: [], shake: 0, fly: null };
let lastTime = performance.now();

function addFloater(x, y, text, color) {
  fx.floaters.push({ x, y, text, color, t: 0, life: 1.1 });
}
function burst(x, y, color, n = 26) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 220;
    fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, color, size: 3 + Math.random() * 5, t: 0, life: 0.9 + Math.random() * 0.5 });
  }
}

function handLayout(count) {
  const w = TABLE.cardW;
  const gap = TABLE.handGap;
  const total = count * w + (count - 1) * gap;
  const x0 = (TABLE.width - total) / 2;
  const out = [];
  for (let i = 0; i < count; i += 1) out.push({ x: x0 + i * (w + gap), y: TABLE.playerHandY });
  return out;
}

function enemyHandLayout(count) {
  const w = 84;
  const gap = 10;
  const total = count * w + (count - 1) * gap;
  const x0 = (TABLE.width - total) / 2;
  const out = [];
  for (let i = 0; i < count; i += 1) out.push({ x: x0 + i * (w + gap), y: 60 });
  return out;
}

function marketLayout() {
  const w = 118;
  const h = 166;
  const gap = 12;
  const total = GAME.marketSize * w + (GAME.marketSize - 1) * gap;
  const x0 = (TABLE.width - total) / 2;
  const out = [];
  for (let i = 0; i < GAME.marketSize; i += 1) out.push({ x: x0 + i * (w + gap), y: 224, w, h });
  return out;
}

function cardAt(x, y) {
  const layout = handLayout(game.player.hand.length);
  for (let i = layout.length - 1; i >= 0; i -= 1) {
    const c = layout[i];
    const lift = i === hoverIndex ? 18 : 0;
    if (x >= c.x && x <= c.x + TABLE.cardW && y >= c.y - lift && y <= c.y + TABLE.cardH) return i;
  }
  return -1;
}

function marketAt(x, y) {
  const layout = marketLayout();
  for (let i = 0; i < layout.length; i += 1) {
    const c = layout[i];
    const lift = i === hoverMarket ? 10 : 0;
    if (game.market[i] && x >= c.x && x <= c.x + c.w && y >= c.y - lift && y <= c.y + c.h) return i;
  }
  return -1;
}

function endTurnButton() {
  return { x: 1072, y: 596, w: 168, h: 56 };
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function applyEvents(events, who) {
  for (const ev of events) {
    if (ev.type === 'play') {
      const card = CARD_BY_ID[ev.card];
      if (who === 'player') lastPlayed.player = card;
      else lastPlayed.enemy = card;
      sfx.play();
    } else if (ev.type === 'buy') {
      const card = CARD_BY_ID[ev.card];
      if (who === 'player') { lastBought.player = card; stats.buys += 1; }
      else lastBought.enemy = card;
      addFloater(TABLE.width / 2, 210, `BOUGHT ${card.name.toUpperCase()}`, '#fde68a');
      sfx.draw();
    } else if (ev.type === 'damage') {
      const target = ev.target === 'player' ? { x: 220, y: 540 } : { x: 220, y: 40 };
      if (ev.blocked > 0) { addFloater(target.x, target.y + 30, `BLOCKED ${ev.blocked}`, '#7dd3fc'); sfx.block(); }
      if (ev.landed > 0) {
        addFloater(target.x, target.y, `-${ev.landed}`, ev.target === 'player' ? '#ff5d73' : '#4ade80');
        fx.shake = Math.min(10, 4 + ev.landed);
        sfx.hit();
        if (who === 'player') stats.damage += ev.landed;
      }
    } else if (ev.type === 'guard') {
      addFloater(ev.who === 'player' ? 220 : 220, ev.who === 'player' ? 540 : 40, `+${ev.block} SHIELD`, '#7dd3fc');
      sfx.block();
    } else if (ev.type === 'coins') {
      addFloater(ev.who === 'player' ? 560 : 900, ev.who === 'player' ? 520 : 40, `+${ev.coins} COINS`, '#fde68a');
      sfx.draw();
    } else if (ev.type === 'crowns') {
      addFloater(TABLE.width / 2, 420, `+${ev.crowns} CROWNS!`, '#c084fc');
      sfx.heal();
      if (who === 'player') stats.crowns += ev.crowns;
    } else if (ev.type === 'draw') {
      sfx.draw();
    }
  }
}

function tryPlayCard(index) {
  if (screen !== 'play' || game.phase !== 'player' || game.winner || enemyBusy) return;
  const layout = handLayout(game.player.hand.length);
  const card = CARD_BY_ID[game.player.hand[index]];
  if (!card) return;
  const from = layout[index];
  fx.fly = { card, x0: from.x, y0: from.y, t: 0, dur: 0.28 };
  const events = playCard(game, 'player', index);
  if (!events) { fx.fly = null; return; }
  stats.cards += 1;
  applyEvents(events, 'player');
  announce(`${card.name} played. ${summarize(game)}`);
  if (game.winner) endGame();
}

function tryBuy(index) {
  if (screen !== 'play' || game.phase !== 'player' || game.winner || enemyBusy) return;
  const events = buyCard(game, 'player', index);
  if (!events) return;
  applyEvents(events, 'player');
  announce(`Bought ${CARD_BY_ID[game.market[index]]?.name || 'a card'}. ${summarize(game)}`);
  if (game.winner) endGame();
}

let enemyStepFn = null;
function stepEnemy() {
  if (game.winner) return;
  const action = enemyStepFn();
  if (!action) {
    enemyBusy = false;
    finishEnemyTurn(game);
    sfx.turn();
    announce(`Turn ${game.turn}. Your move.`);
    return;
  }
  let events = null;
  if (action.type === 'play') events = playCard(game, 'enemy', action.index);
  else if (action.type === 'buy') events = buyCard(game, 'enemy', action.index);
  if (!events) {
    enemyBusy = false;
    finishEnemyTurn(game);
    return;
  }
  applyEvents(events, 'enemy');
  if (game.winner) { endGame(); return; }
  enemyTimer = setTimeout(stepEnemy, 520);
}

function endTurn() {
  if (screen !== 'play' || game.phase !== 'player' || game.winner || enemyBusy) return;
  enemyBusy = true;
  startEnemyTurn(game);
  enemyStepFn = baronStepper(game);
  sfx.click();
  enemyTimer = setTimeout(stepEnemy, 420);
}

function endGame() {
  enemyBusy = false;
  if (enemyTimer) clearTimeout(enemyTimer);
  if (game.winner === 'player') {
    sfx.win();
    burst(TABLE.width / 2, 300, '#ffd166', 60);
    burst(TABLE.width / 2, 300, '#a855f7', 40);
  } else {
    sfx.lose();
  }
  announce(game.winner === 'player' ? 'Victory! The crown is yours.' : 'Defeat. The Baron keeps his crown.');
}

function newGame(newSeed) {
  game = createGame(newSeed ?? Math.floor(Math.random() * 100000));
  lastPlayed = { player: null, enemy: null };
  lastBought = { player: null, enemy: null };
  stats = { damage: 0, cards: 0, crowns: 0, buys: 0 };
  fx.floaters = [];
  fx.particles = [];
  fx.fly = null;
  enemyBusy = false;
  screen = 'play';
}

function startFromTitle() {
  ensureAudio();
  sfx.click();
  newGame(seed);
}

// ---------- drawing ----------

function drawPlayScreen() {
  drawTable(ctx, TABLE.width, TABLE.height);
  // Baron identity + bars.
  ctx.save();
  ctx.fillStyle = '#2d1a12';
  ctx.beginPath();
  ctx.arc(1116, 40, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', 1116, 42);
  ctx.restore();
  drawHpBar(ctx, 40, 26, 360, `BARON VEX · ${game.enemy.crowns} CROWNS`, game.enemy.hp, game.enemy.maxHp, game.enemy.shield);
  drawCoins(ctx, 800, 40, game.enemy.coins, 10);
  drawHpBar(ctx, 40, 506, 360, `YOU · ${game.player.crowns} CROWNS`, game.player.hp, game.player.maxHp, game.player.shield);
  drawCoins(ctx, 440, 520, game.player.coins, 10);

  // Turn banner.
  ctx.save();
  ctx.fillStyle = '#ffe9c9';
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.winner ? '— DUEL OVER —' : `TURN ${game.turn} — ${game.phase === 'player' ? 'YOUR MOVE' : "BARON'S TURN"}`, TABLE.width / 2, 30);
  ctx.restore();

  // Enemy hand, face down.
  const eLayout = enemyHandLayout(game.enemy.hand.length);
  for (const c of eLayout) drawCardBack(ctx, c.x, c.y, 84, 118);
  ctx.save();
  ctx.fillStyle = '#cbbd9f';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${game.enemy.hand.length} cards in hand`, TABLE.width / 2, 192);
  ctx.restore();

  // Market row.
  ctx.save();
  ctx.fillStyle = '#ffe9c9';
  ctx.font = 'bold 16px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('— THE MARKET —', TABLE.width / 2, 214);
  ctx.restore();
  const mLayout = marketLayout();
  mLayout.forEach((c, i) => {
    const cardId = game.market[i];
    if (!cardId) return;
    const card = CARD_BY_ID[cardId];
    const affordable = card.cost <= game.player.coins && game.player.buysLeft > 0;
    drawCard(ctx, card, c.x, c.y, c.w, c.h, {
      hover: i === hoverMarket && game.phase === 'player' && !game.winner,
      dim: !affordable && game.phase === 'player',
    });
  });

  // Last played, flanking the market.
  ctx.save();
  ctx.fillStyle = '#cbbd9f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOU PLAYED', 119, 214);
  ctx.fillText('BARON PLAYED', 1161, 214);
  ctx.restore();
  if (lastPlayed.player) drawCard(ctx, lastPlayed.player, 60, 224, 118, 166);
  if (lastPlayed.enemy) drawCard(ctx, lastPlayed.enemy, 1102, 224, 118, 166);

  // Hint + log.
  ctx.save();
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    game.phase === 'player'
      ? (game.player.buysLeft > 0
        ? `Click a market card to buy it — 1 buy left, ${game.player.coins} coins in hand`
        : 'Buy used — play your cards, then end the turn')
      : 'Baron Vex is choosing his cards…',
    TABLE.width / 2, 414,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const lines = game.log.slice(-3);
  lines.forEach((line, i) => ctx.fillText(line, 40, 436 + i * 18));
  ctx.restore();

  // Deck / discard counts.
  ctx.save();
  ctx.fillStyle = '#cbbd9f';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Deck: ${game.player.deck.length}   Discard: ${game.player.discard.length}`, 40, 758);
  ctx.textAlign = 'right';
  ctx.fillText(`Market deck: ${game.marketDeck.length}`, TABLE.width - 40, 758);
  ctx.restore();

  // Player hand.
  const layout = handLayout(game.player.hand.length);
  game.player.hand.forEach((cardId, i) => {
    const card = CARD_BY_ID[cardId];
    const pos = layout[i];
    drawCard(ctx, card, pos.x, pos.y, TABLE.cardW, TABLE.cardH, {
      hover: i === hoverIndex && game.phase === 'player' && !game.winner,
    });
  });

  // End Turn button.
  const btn = endTurnButton();
  ctx.save();
  const canEnd = game.phase === 'player' && !game.winner && !enemyBusy;
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fillStyle = canEnd ? '#d97706' : '#57534e';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = canEnd ? '#fde68a' : '#a8a29e';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END TURN', btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  ctx.restore();

  drawFx();
  if (game.winner) drawOverScreen();
}

function drawFx() {
  if (fx.fly) {
    const f = fx.fly;
    const t = Math.min(1, f.t / f.dur);
    const x = f.x0 + (60 - f.x0) * t;
    const y = f.y0 + (224 - f.y0) * t;
    ctx.save();
    ctx.globalAlpha = 1 - t * 0.4;
    drawCard(ctx, f.card, x, y, TABLE.cardW, TABLE.cardH);
    ctx.restore();
  }
  for (const p of fx.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fl of fx.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - fl.t / fl.life);
    ctx.fillStyle = fl.color;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(fl.text, fl.x, fl.y - fl.t * 46);
  }
  ctx.restore();
}

function drawOverScreen() {
  const win = game.winner === 'player';
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,8,0.72)';
  ctx.fillRect(0, 0, TABLE.width, TABLE.height);
  roundRect(ctx, 390, 220, 500, 330, 20);
  ctx.fillStyle = '#1c1917';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = win ? '#ffd166' : '#ef4444';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#ffd166' : '#ff5d73';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(win ? 'VICTORY!' : 'DEFEAT', TABLE.width / 2, 300);
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '20px Georgia, serif';
  ctx.fillText(game.overReason || '', TABLE.width / 2, 350);
  ctx.fillStyle = '#cbbd9f';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`Turns: ${game.turn}    Cards played: ${stats.cards}    Buys: ${stats.buys}    Crowns: ${game.player.crowns}`, TABLE.width / 2, 400);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press R or click to play again', TABLE.width / 2, 480);
  ctx.restore();
}

function drawTitleScreen() {
  drawTable(ctx, TABLE.width, TABLE.height);
  const fan = ['royal-blade', 'crown-jewels', 'knight', 'vault', 'jester'];
  fan.forEach((id, i) => {
    ctx.save();
    ctx.translate(360 + i * 140, 250);
    ctx.rotate((i - 2) * 0.07);
    drawCard(ctx, CARD_BY_ID[id], -66, -93, 132, 186);
    ctx.restore();
  });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 88px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText('COIN & CROWN', TABLE.width / 2, 470);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '26px Georgia, serif';
  ctx.fillText('Build a deck, buy the market, take the crown from Baron Vex', TABLE.width / 2, 516);
  ctx.fillStyle = '#cbbd9f';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Play cards free  •  Buy 1 market card a turn  •  First to 15 crowns, or last vault standing, wins', TABLE.width / 2, 556);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', TABLE.width / 2, 640);
  ctx.fillStyle = '#cbbd9f';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Click a card to play it  •  Click a market card to buy it  •  Space ends your turn', TABLE.width / 2, 676);
  ctx.restore();
}

function draw(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  for (const fl of fx.floaters) fl.t += dt;
  fx.floaters = fx.floaters.filter((fl) => fl.t < fl.life);
  for (const p of fx.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
  }
  fx.particles = fx.particles.filter((p) => p.t < p.life);
  if (fx.fly) {
    fx.fly.t += dt;
    if (fx.fly.t >= fx.fly.dur) fx.fly = null;
  }
  fx.shake = Math.max(0, fx.shake - dt * 26);

  ctx.save();
  if (fx.shake > 0.2) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  ctx.clearRect(-20, -20, TABLE.width + 40, TABLE.height + 40);
  if (screen === 'title') drawTitleScreen();
  else drawPlayScreen();
  ctx.restore();
  if (!shotName) requestAnimationFrame(draw);
  else if (fx.fly || fx.particles.length) requestAnimationFrame(draw);
}

function loop(now) {
  draw(now);
  if (!shotName) requestAnimationFrame(loop);
}

// ---------- input ----------

canvas.addEventListener('mousemove', (ev) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * TABLE.width;
  mouse.y = ((ev.clientY - rect.top) / rect.height) * TABLE.height;
  hoverIndex = screen === 'play' ? cardAt(mouse.x, mouse.y) : -1;
  hoverMarket = screen === 'play' ? marketAt(mouse.x, mouse.y) : -1;
  canvas.style.cursor = hoverIndex >= 0 || hoverMarket >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * TABLE.width;
  const y = ((ev.clientY - rect.top) / rect.height) * TABLE.height;
  ensureAudio();
  if (screen === 'title') { startFromTitle(); return; }
  if (game.winner) { newGame(); return; }
  const btn = endTurnButton();
  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) { endTurn(); return; }
  const mi = marketAt(x, y);
  if (mi >= 0) { tryBuy(mi); return; }
  const index = cardAt(x, y);
  if (index >= 0) tryPlayCard(index);
});

window.addEventListener('keydown', (ev) => {
  if (screen === 'title' && (ev.key === 'Enter' || ev.key === ' ')) { startFromTitle(); return; }
  if (game.winner && (ev.key === 'r' || ev.key === 'R' || ev.key === 'Enter')) { newGame(); return; }
  if (screen !== 'play' || game.winner) return;
  if (ev.key >= '1' && ev.key <= '5') {
    const index = Number(ev.key) - 1;
    if (index < game.player.hand.length) tryPlayCard(index);
  } else if (ev.key === ' ' || ev.key === 'Enter') {
    ev.preventDefault();
    endTurn();
  }
});

// ---------- boot ----------

if (shotName) {
  const staged = stageShot(shotName, seed);
  game = staged.game;
  screen = staged.screen;
  lastPlayed = staged.lastPlayed;
  stats = staged.stats;
  requestAnimationFrame(loop);
} else {
  requestAnimationFrame(loop);
}
