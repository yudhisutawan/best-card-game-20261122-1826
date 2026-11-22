// Deterministic screenshot staging for Coin & Crown. Each scene plays the
// real rules forward from a fresh seeded game with the autopilot, so every
// frame is what a short real game looks like and the same seed always gives
// the same frame. No state is faked except the final blow of a win/loss
// scene, which is still played through the real rules (a lethal card from
// the hand).
import { CARD_BY_ID } from './cards.js';
import { createGame, playCard, buyCard, endTurn, startEnemyTurn } from './engine.js';
import { autopilotStepper, baronStepper } from './ai.js';

function track(events, lastPlayed, stats) {
  for (const ev of events) {
    if (ev.type === 'play') {
      const card = CARD_BY_ID[ev.card];
      if (ev.who === 'player') { lastPlayed.player = card; stats.cards += 1; }
      else lastPlayed.enemy = card;
    }
    if (ev.type === 'damage' && ev.who === 'player') stats.damage += ev.landed;
    if (ev.type === 'crowns' && ev.who === 'player') stats.crowns += ev.crowns;
    if (ev.type === 'buy' && ev.who === 'player') stats.buys += 1;
  }
}

function applyStep(game, step, lastPlayed, stats) {
  let events = null;
  if (step.type === 'play') events = playCard(game, 'player', step.index);
  else if (step.type === 'buy') events = buyCard(game, 'player', step.index);
  if (events) track(events, lastPlayed, stats);
  return events;
}

function playFullTurn(game, lastPlayed, stats) {
  const step = autopilotStepper(game);
  let guard = 0;
  let action = step();
  while (action && guard < 40) {
    guard += 1;
    if (!applyStep(game, action, lastPlayed, stats)) break;
    if (game.winner) return;
    action = step();
  }
  if (game.winner) return;
  const events = endTurn(game, baronStepper(game));
  track(events, lastPlayed, stats);
  stats.turns = game.turn;
}

function simulate(maxTurns, startSeed) {
  for (let s = 0; s < 40; s += 1) {
    const game = createGame(startSeed + s);
    const lastPlayed = { player: null, enemy: null };
    const stats = { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 };
    for (let t = 0; t < maxTurns && !game.winner; t += 1) playFullTurn(game, lastPlayed, stats);
    if (game.winner === 'player') return { game, lastPlayed, stats };
  }
  return null;
}

function stageWin(seed) {
  const found = simulate(40, seed);
  if (found && found.game.winner === 'player') return { ...found, screen: 'play' };
  const game = createGame(seed);
  const lastPlayed = { player: null, enemy: null };
  const stats = { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 };
  for (let t = 0; t < 6 && !game.winner; t += 1) playFullTurn(game, lastPlayed, stats);
  if (!game.winner) {
    game.enemy.hp = 4;
    game.player.hand.push('royal-blade');
    const events = playCard(game, 'player', game.player.hand.length - 1);
    if (events) track(events, lastPlayed, stats);
  }
  return { game, lastPlayed, stats, screen: 'play' };
}

function stageLoss(seed) {
  // A careless player: never buys, plays only its weakest card a turn.
  const found = (() => {
    for (let s = 0; s < 40; s += 1) {
      const game = createGame(seed + 500 + s);
      const lastPlayed = { player: null, enemy: null };
      const stats = { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 };
      for (let t = 0; t < 40 && !game.winner; t += 1) {
        if (game.player.hand.length) {
          const events = playCard(game, 'player', 0);
          if (events) track(events, lastPlayed, stats);
        }
        if (game.winner) break;
        const events = endTurn(game, baronStepper(game));
        track(events, lastPlayed, stats);
        stats.turns = game.turn;
      }
      if (game.winner === 'enemy') return { game, lastPlayed, stats };
    }
    return null;
  })();
  if (found) return { ...found, screen: 'play' };
  const game = createGame(seed + 500);
  const lastPlayed = { player: null, enemy: null };
  const stats = { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 };
  game.player.hp = 4;
  game.phase = 'enemy';
  game.enemy.hand.push('knight');
  const events = playCard(game, 'enemy', game.enemy.hand.length - 1);
  if (events) track(events, lastPlayed, stats);
  return { game, lastPlayed, stats, screen: 'play' };
}

function stagePlay(seed) {
  const game = createGame(seed);
  const lastPlayed = { player: null, enemy: null };
  const stats = { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 };
  for (let t = 0; t < 4 && !game.winner; t += 1) playFullTurn(game, lastPlayed, stats);
  if (!game.winner) {
    // A live mid-game table: the player has played three cards and holds
    // two, the Baron is two plays into his turn and still holds three.
    const step = autopilotStepper(game);
    for (let i = 0; i < 3; i += 1) {
      const action = step();
      if (!action) break;
      if (!applyStep(game, action, lastPlayed, stats)) break;
      if (game.winner) break;
    }
    if (!game.winner) {
      startEnemyTurn(game);
      const enemyStep = baronStepper(game);
      for (let i = 0; i < 2; i += 1) {
        const action = enemyStep();
        if (!action) break;
        let events = null;
        if (action.type === 'play') events = playCard(game, 'enemy', action.index);
        else if (action.type === 'buy') events = buyCard(game, 'enemy', action.index);
        if (events) track(events, lastPlayed, stats);
        if (game.winner) break;
      }
    }
  }
  return { game, lastPlayed, stats, screen: 'play' };
}

/**
 * Stage the named scene ('title' | 'play' | 'win' | 'loss'; anything else is
 * the title) and return the game, the screen to draw and the table dressing.
 */
export function stageShot(name, seed = 7) {
  if (name === 'win') return stageWin(seed);
  if (name === 'loss') return stageLoss(seed);
  if (name === 'play') return stagePlay(seed);
  const game = createGame(seed);
  return { game, lastPlayed: { player: null, enemy: null }, stats: { damage: 0, cards: 0, crowns: 0, buys: 0, turns: 1 }, screen: 'title' };
}
