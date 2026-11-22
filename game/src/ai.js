// Opponent brains for Coin & Crown. Baron Vex and the autopilot share one
// policy: draw first (more cards to play), hit hard, mint coins, then spend
// the turn's last coin on the best card in the market. Neither plans beyond
// this turn, so a human who builds an engine — mint, vault, then royal
// blades — outscales both.
import { CARD_BY_ID } from './cards.js';
import { legalBuys } from './engine.js';

/** What a market card is worth to a deck: damage, crowns and economy. */
function buyValue(card) {
  let value = (card.power || 0) * 1.0;
  value += (card.crowns || 0) * 2.4;
  value += (card.coins || 0) * 0.9;
  value += (card.draw || 0) * 1.4;
  value += (card.block || 0) * 0.45;
  return value;
}

function bestBuy(state, who) {
  const buys = legalBuys(state, who);
  if (buys.length === 0) return null;
  let best = null;
  let bestValue = -Infinity;
  for (const index of buys) {
    const card = CARD_BY_ID[state.market[index]];
    const value = buyValue(card) - card.cost * 0.35;
    if (value > bestValue) {
      bestValue = value;
      best = index;
    }
  }
  return best;
}

/**
 * A stepper for engine.endTurn and the browser's animated enemy turn: each
 * call returns the next action ({type:'play',index} / {type:'buy',index}) or
 * null when the turn is done.
 */
export function makeStepper(state, who, rand = null) {
  return function step() {
    const side = state[who];
    // Draw cards first: they put more cards in the hand.
    for (let i = 0; i < side.hand.length; i += 1) {
      const card = CARD_BY_ID[side.hand[i]];
      if (card.draw) return { type: 'play', index: i };
    }
    // Then the hardest hit.
    let bestAttack = -1;
    let bestPower = -1;
    for (let i = 0; i < side.hand.length; i += 1) {
      const card = CARD_BY_ID[side.hand[i]];
      if (card.power > bestPower) {
        bestPower = card.power;
        bestAttack = i;
      }
    }
    if (bestAttack >= 0 && bestPower > 0) return { type: 'play', index: bestAttack };
    // Then everything else in hand: coins, guards, crowns.
    if (side.hand.length > 0) {
      let pick = 0;
      if (rand) pick = Math.floor(rand() * side.hand.length);
      return { type: 'play', index: pick };
    }
    // Hand empty: spend the turn's coins on the best market card.
    const buy = bestBuy(state, who);
    if (buy !== null && buy !== undefined) return { type: 'buy', index: buy };
    return null;
  };
}

/** Baron Vex's stepper: greedy, with his own seeded jitter. */
export function baronStepper(state) {
  return makeStepper(state, 'enemy', state.rand);
}

/** The autopilot that plays the player's seat in tests and screenshots. */
export function autopilotStepper(state) {
  return makeStepper(state, 'player', state.rand);
}
