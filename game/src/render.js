// Canvas drawing for Coin & Crown: the table, the cards, the bars and the
// screens. Every glyph is drawn with canvas paths (no image files), so the
// game loads nothing over the network.
import { TABLE, GAME, SUITS } from './config.js';
import { CARD_BY_ID } from './cards.js';

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glyph(ctx, kind, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'sword') {
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(size * 0.14, -size * 0.1);
    ctx.lineTo(size * 0.14, size * 0.28);
    ctx.lineTo(-size * 0.14, size * 0.28);
    ctx.lineTo(-size * 0.14, -size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-size * 0.24, size * 0.28, size * 0.48, size * 0.1);
    ctx.fillRect(-size * 0.07, size * 0.38, size * 0.14, size * 0.18);
  } else if (kind === 'coin') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.round(size * 0.5)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', 0, 1);
  } else if (kind === 'crown') {
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.4);
    ctx.lineTo(-size * 0.5, -size * 0.1);
    ctx.lineTo(-size * 0.25, size * 0.12);
    ctx.lineTo(0, -size * 0.42);
    ctx.lineTo(size * 0.25, size * 0.12);
    ctx.lineTo(size * 0.5, -size * 0.1);
    ctx.lineTo(size * 0.5, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-size * 0.5, size * 0.4, size, size * 0.1);
  }
  ctx.restore();
}

/** One card face. `opts`: hover lifts it, dim greys it (unaffordable). */
export function drawCard(ctx, card, x, y, w, h, opts = {}) {
  const suit = SUITS[card.suit];
  ctx.save();
  if (opts.hover) {
    ctx.translate(0, -18);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
  }
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = '#fdf6e3';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = suit.color;
  ctx.stroke();
  // Suit band.
  roundRect(ctx, x + 4, y + 4, w - 8, 34, 8);
  ctx.fillStyle = suit.color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(w * 0.105)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit.name.toUpperCase(), x + w / 2, y + 22);
  // Glyph.
  glyph(ctx, suit.glyph, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.34, suit.dark);
  // Name.
  ctx.fillStyle = '#2b2118';
  ctx.font = `bold ${Math.round(w * 0.115)}px Georgia, serif`;
  ctx.fillText(card.name, x + w / 2, y + h * 0.62, w - 12);
  // Effect text, wrapped to two lines.
  ctx.fillStyle = '#5b4a35';
  ctx.font = `${Math.round(w * 0.095)}px system-ui, sans-serif`;
  const words = card.text.split(' ');
  let line = '';
  let ly = y + h * 0.74;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w - 16 && line) {
      ctx.fillText(line, x + w / 2, ly);
      ly += Math.round(w * 0.11);
      line = word;
    } else line = test;
  }
  if (line) ctx.fillText(line, x + w / 2, ly);
  // Price gem, top-left (gold coin with the market price).
  ctx.beginPath();
  ctx.arc(x + 16, y + 40, 15, 0, Math.PI * 2);
  ctx.fillStyle = card.cost > 0 ? '#b45309' : '#78716c';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fde68a';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(String(card.cost), x + 16, y + 41);
  // Power, big, bottom-right.
  if (card.power > 0 || card.kind === 'attack') {
    ctx.beginPath();
    ctx.arc(x + w - 18, y + h - 20, 17, 0, Math.PI * 2);
    ctx.fillStyle = suit.dark;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(String(card.power), x + w - 18, y + h - 19);
  }
  // Guard value instead of power.
  if (card.kind === 'guard') {
    ctx.beginPath();
    ctx.arc(x + w - 18, y + h - 20, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#3f6212';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`+${card.block}`, x + w - 18, y + h - 19);
  }
  // Crown bounty, top-right.
  if (card.crowns) {
    ctx.beginPath();
    ctx.arc(x + w - 16, y + 40, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ddd6fe';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`+${card.crowns}`, x + w - 16, y + 41);
  }
  if (opts.dim) {
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(20,16,10,0.45)';
    ctx.fill();
  }
  ctx.restore();
}

/** Face-down card back. */
export function drawCardBack(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = '#2d1a12';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d97706';
  ctx.stroke();
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 8);
  ctx.strokeStyle = 'rgba(217,119,6,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  glyph(ctx, 'coin', x + w / 2, y + h / 2, Math.min(w, h) * 0.4, '#d97706');
}

/** HP bar with a heart and numbers, big enough to read at thumbnail size. */
export function drawHpBar(ctx, x, y, w, label, hp, maxHp, shield) {
  const h = 26;
  ctx.save();
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5d73';
  ctx.textAlign = 'left';
  ctx.fillText('♥', x, y + h / 2 + 1);
  const barX = x + 26;
  const barW = w - 26;
  roundRect(ctx, barX, y, barW, h, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  const frac = Math.max(0, hp / maxHp);
  if (frac > 0) {
    roundRect(ctx, barX + 2, y + 2, (barW - 4) * frac, h - 4, 6);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.max(0, hp)} / ${maxHp}`, barX + barW / 2, y + h / 2 + 1);
  if (shield > 0) {
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🛡 ${shield}`, barX - 10, y + h / 2 + 1);
  }
  ctx.fillStyle = '#ffe9c9';
  ctx.font = 'bold 19px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 14);
  ctx.restore();
}

/** Coins as a row of gold discs: filled = in hand. */
export function drawCoins(ctx, x, y, coins, maxCoins = 12, label = 'COINS') {
  ctx.save();
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(label, x, y);
  for (let i = 0; i < maxCoins; i += 1) {
    const cx = x + 62 + i * 20;
    ctx.beginPath();
    ctx.arc(cx, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < coins ? '#f59e0b' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.strokeStyle = i < coins ? '#fde68a' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(String(coins), x + 62 + maxCoins * 20 + 6, y);
  ctx.restore();
}

/** Dark felt table with a warm glow in the middle. */
export function drawTable(ctx, width, height) {
  const g = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.62);
  g.addColorStop(0, '#1d5c38');
  g.addColorStop(0.6, '#123d24');
  g.addColorStop(1, '#0a2416');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,215,130,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, width * 0.46, height * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,215,130,0.14)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, width * 0.4, height * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
}
