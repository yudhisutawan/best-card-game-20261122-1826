// Pure rules for Coin & Crown: no DOM, no canvas, so Node can simulate whole
// games headlessly. The browser wires this engine to the renderer and input.
//
// A turn: play any cards from your hand for free (attacks hurt the rival,
// coins pay for the market, crowns score), then buy ONE card from the market
// row, then draw back up to five cards. Unplayed cards stay in hand, so a
// hand can be saved for the right moment. First to 15 crowns, or the last
// rival standing, takes the crown.
import { GAME } from './config.js';
import { CARD_BY_ID, buildDeck, buildMarketDeck } from './cards.js';
import { mulberry32, shuffled } from './rng.js';

function newSide(rand, hp) {
  return {
    hp,
    maxHp: hp,
    coins: GAME.income,
    crowns: 0,
    shield: 0,
    buysLeft: 1,
    deck: shuffled(buildDeck(), rand),
    hand: [],
    discard: [],
  };
}

export function createGame(seed = 1) {
  const rand = mulberry32(seed);
  const state = {
    seed,
    rand,
    turn: 1,
    phase: 'player',
    winner: null,
    overReason: null,
    marketDeck: shuffled(buildMarketDeck(), rand),
    market: [],
    player: newSide(rand, GAME.startHp),
    enemy: newSide(rand, GAME.enemyHp),
    log: [],
  };
  for (let i = 0; i < GAME.marketSize; i += 1) state.market.push(state.marketDeck.pop());
  drawCards(state, state.player, GAME.handSize);
  drawCards(state, state.enemy, GAME.handSize);
  return state;
}

export function other(who) {
  return who === 'player' ? 'enemy' : 'player';
}

function drawCards(state, side, count) {
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) break;
      side.deck = shuffled(side.discard, state.rand);
      side.discard = [];
    }
    side.hand.push(side.deck.pop());
    drawn += 1;
  }
  return drawn;
}

/** Begin `who`'s turn: fresh coins, one buy, shield fades, draw to five.
 * Unplayed cards stay in hand from turn to turn, so a hand can be saved
 * for the right moment. */
export function beginTurn(state, who) {
  const side = state[who];
  side.coins = GAME.income;
  side.buysLeft = 1;
  side.shield = 0;
  const drawn = drawCards(state, side, Math.max(0, GAME.handSize - side.hand.length));
  return { type: 'turn-start', who, coins: side.coins, drawn };
}

/** Played cards go straight to the discard pile. */

function dealDamage(state, who, amount) {
  const side = state[who];
  const blocked = Math.min(side.shield, amount);
  side.shield -= blocked;
  const landed = amount - blocked;
  side.hp -= landed;
  return { blocked, landed };
}

function checkWin(state) {
  if (state.player.hp <= 0 && state.enemy.hp <= 0) {
    state.winner = 'enemy';
    state.overReason = 'both fell — the Baron struck last';
  } else if (state.enemy.hp <= 0) {
    state.winner = 'player';
    state.overReason = 'the Baron’s vault is empty';
  } else if (state.player.hp <= 0) {
    state.winner = 'enemy';
    state.overReason = 'your vault is empty';
  } else if (state.player.crowns >= GAME.crownTarget) {
    state.winner = 'player';
    state.overReason = `you reached ${GAME.crownTarget} crowns first`;
  } else if (state.enemy.crowns >= GAME.crownTarget) {
    state.winner = 'enemy';
    state.overReason = `the Baron reached ${GAME.crownTarget} crowns first`;
  }
  if (state.winner) state.phase = 'over';
  return state.winner;
}

/**
 * Play the card at `handIndex` from `who`'s hand. Playing is free; the card
 * pays for itself in damage, coins or crowns. Returns its events, or null
 * when the play is illegal.
 */
export function playCard(state, who, handIndex) {
  if (state.phase === 'over') return null;
  if ((who === 'player') !== (state.phase === 'player')) return null;
  const side = state[who];
  if (handIndex < 0 || handIndex >= side.hand.length) return null;
  const card = CARD_BY_ID[side.hand[handIndex]];
  if (!card) return null;

  side.hand.splice(handIndex, 1);
  side.discard.push(card.id);
  const events = [{ type: 'play', who, card: card.id, suit: card.suit, cost: card.cost }];

  if (card.kind === 'guard') {
    side.shield += card.block;
    events.push({ type: 'guard', who, block: card.block });
  } else if (card.kind === 'coin') {
    side.coins += card.coins;
    events.push({ type: 'coins', who, coins: card.coins });
  } else {
    if (card.power > 0) {
      const hit = dealDamage(state, other(who), card.power);
      events.push({ type: 'damage', who, target: other(who), amount: card.power, blocked: hit.blocked, landed: hit.landed });
    }
    if (card.coins) {
      side.coins += card.coins;
      events.push({ type: 'coins', who, coins: card.coins });
    }
    if (card.draw) {
      const drawn = drawCards(state, side, card.draw);
      events.push({ type: 'draw', who, drawn });
    }
  }
  if (card.crowns) {
    side.crowns += card.crowns;
    events.push({ type: 'crowns', who, crowns: card.crowns });
  }
  state.log.push(`${who} played ${card.name}`);
  checkWin(state);
  return events;
}

/** Cards in the market `who` can afford with their one buy this turn. */
export function legalBuys(state, who) {
  const side = state[who];
  if (side.buysLeft <= 0) return [];
  const out = [];
  for (let i = 0; i < state.market.length; i += 1) {
    const card = CARD_BY_ID[state.market[i]];
    if (card && card.cost <= side.coins) out.push(i);
  }
  return out;
}

/**
 * Buy the market card at `marketIndex` into `who`'s discard pile. Returns its
 * events, or null when the buy is illegal.
 */
export function buyCard(state, who, marketIndex) {
  if (state.phase === 'over') return null;
  if ((who === 'player') !== (state.phase === 'player')) return null;
  const side = state[who];
  if (side.buysLeft <= 0) return null;
  if (marketIndex < 0 || marketIndex >= state.market.length) return null;
  const cardId = state.market[marketIndex];
  const card = CARD_BY_ID[cardId];
  if (!card || card.cost > side.coins) return null;

  side.coins -= card.cost;
  side.buysLeft -= 1;
  side.discard.push(cardId);
  state.market[marketIndex] = state.marketDeck.length ? state.marketDeck.pop() : null;
  state.log.push(`${who} bought ${card.name} for ${card.cost}`);
  return [{ type: 'buy', who, card: cardId, cost: card.cost }];
}

/**
 * End the player's turn: clean up, run the enemy's turn through `enemyStep`
 * (which returns the next action, {play, index} / {buy, index} / null), then
 * start the next turn. Returns all events.
 */
export function endTurn(state, enemyStep) {
  if (state.phase !== 'player' || state.winner) return [];
  const events = [{ type: 'turn-end', who: 'player' }];
  state.phase = 'enemy';
  events.push(beginTurn(state, 'enemy'));
  let guard = 0;
  while (!state.winner && guard < 60) {
    guard += 1;
    const action = enemyStep(state);
    if (!action) break;
    let played = null;
    if (action.type === 'play') played = playCard(state, 'enemy', action.index);
    else if (action.type === 'buy') played = buyCard(state, 'enemy', action.index);
    if (!played) break;
    events.push(...played);
  }
  if (state.winner) return events;
  state.turn += 1;
  state.phase = 'player';
  events.push(beginTurn(state, 'player'));
  return events;
}

/**
 * The same turn split in two for the browser, so the enemy's plays can be
 * shown one at a time: start the enemy's turn, then finish it.
 */
export function startEnemyTurn(state) {
  state.phase = 'enemy';
  return beginTurn(state, 'enemy');
}

export function finishEnemyTurn(state) {
  state.turn += 1;
  state.phase = 'player';
  return beginTurn(state, 'player');
}

/** One-line summary for tests and the log. */
export function summarize(state) {
  return `turn ${state.turn} ${state.phase} P ${state.player.hp}hp/${state.player.coins}c/${state.player.crowns}cr ` +
    `E ${state.enemy.hp}hp/${state.enemy.coins}c/${state.enemy.crowns}cr` +
    (state.winner ? ` winner=${state.winner}` : '');
}
