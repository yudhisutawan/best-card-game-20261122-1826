// The card pool for Coin & Crown: starter cards every deck opens with, and
// the market pool the two rivals buy from. A card's `cost` is its price in
// the market (0 for starters, which are never sold); playing a card is free.
export const STARTERS = [
  { id: 'copper-cut', name: 'Copper Cut', suit: 'blade', cost: 0, power: 1, kind: 'attack', text: 'Deal 1 damage.' },
  { id: 'copper-coin', name: 'Copper Coin', suit: 'coin', cost: 0, power: 0, kind: 'coin', coins: 2, text: 'Gain 2 coins.' },
];

export const MARKET = [
  { id: 'silver-slash', name: 'Silver Slash', suit: 'blade', cost: 3, power: 4, kind: 'attack', text: 'Deal 4 damage.' },
  { id: 'golden-guard', name: 'Golden Guard', suit: 'crown', cost: 3, power: 0, kind: 'guard', block: 6, crowns: 1, text: 'Gain 6 shield. +1 crown.' },
  { id: 'mint', name: 'Mint', suit: 'coin', cost: 2, power: 0, kind: 'coin', coins: 4, text: 'Gain 4 coins.' },
  { id: 'jester', name: 'Jester', suit: 'crown', cost: 4, power: 2, kind: 'trick', draw: 2, text: 'Deal 2. Draw 2 cards.' },
  { id: 'royal-blade', name: 'Royal Blade', suit: 'blade', cost: 6, power: 8, kind: 'trick', crowns: 2, text: 'Deal 8. +2 crowns.' },
  { id: 'crown-jewels', name: 'Crown Jewels', suit: 'crown', cost: 5, power: 0, kind: 'trick', crowns: 5, text: '+5 crowns.' },
  { id: 'tax-collector', name: 'Tax Collector', suit: 'coin', cost: 3, power: 2, kind: 'trick', coins: 3, text: 'Deal 2. Gain 3 coins.' },
  { id: 'duelist', name: 'Duelist', suit: 'blade', cost: 4, power: 6, kind: 'attack', text: 'Deal 6 damage.' },
  { id: 'vault', name: 'Vault', suit: 'coin', cost: 5, power: 0, kind: 'coin', coins: 6, text: 'Gain 6 coins.' },
  { id: 'peasant-levy', name: 'Peasant Levy', suit: 'blade', cost: 2, power: 3, kind: 'trick', crowns: 1, text: 'Deal 3. +1 crown.' },
  { id: 'knight', name: 'Knight', suit: 'blade', cost: 5, power: 7, kind: 'attack', text: 'Deal 7 damage.' },
  { id: 'court-bard', name: 'Court Bard', suit: 'coin', cost: 3, power: 0, kind: 'trick', draw: 1, coins: 3, text: 'Draw 1. Gain 3 coins.' },
];

export const CARD_BY_ID = Object.fromEntries([...STARTERS, ...MARKET].map((c) => [c.id, c]));

/** A fresh 10-card starter deck: 6 cuts, 4 coins. */
export function buildDeck() {
  const deck = [];
  for (let i = 0; i < 6; i += 1) deck.push('copper-cut');
  for (let i = 0; i < 4; i += 1) deck.push('copper-coin');
  return deck;
}

/** The market deck: two copies of every market card. */
export function buildMarketDeck() {
  const deck = [];
  for (const card of MARKET) {
    deck.push(card.id);
    deck.push(card.id);
  }
  return deck;
}
