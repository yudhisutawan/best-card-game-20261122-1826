// Table and game constants for Coin & Crown. One place holds every number
// the renderer and the input code agree on.
export const TABLE = {
  width: 1280,
  height: 800,
  enemyHandY: 96,
  playerHandY: 560,
  cardW: 132,
  cardH: 186,
  handGap: 14,
  centreY: 330,
};

export const GAME = {
  startHp: 40,
  enemyHp: 46, // Baron Vex moves second, so he opens with a fuller vault: +6 HP.
  income: 5,
  handSize: 5,
  crownTarget: 15,
  marketSize: 5,
};

// A card's suit: what it is for, told by colour and shape, never by text alone.
export const SUITS = {
  blade: { name: 'Blade', color: '#dc2626', dark: '#991b1b', light: '#fecaca', glyph: 'sword' },
  coin: { name: 'Coin', color: '#d97706', dark: '#92400e', light: '#fde68a', glyph: 'coin' },
  crown: { name: 'Crown', color: '#7c3aed', dark: '#5b21b6', light: '#ddd6fe', glyph: 'crown' },
};
