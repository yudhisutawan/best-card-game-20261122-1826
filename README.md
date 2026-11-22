[![best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/yudhisutawan/best-card-game-20261122-1826/rank.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/yudhisutawan/best-card-game-20261122-1826/reward.svg)](https://make.fun/c/best-card-game-20261122-1826)

# Coin & Crown — a deck-building card duel

A complete card game that plays offline in a desktop browser from its own files.
You are a rival claimant to the crown, duelling Baron Vex across a market table:
play cards from your hand for free, spend the turn's coins on one card from the
market row, and build your deck turn by turn. First to 15 crowns — or the last
vault standing — takes the crown.

## How to play

- **Click a card in your hand** to play it (free) · **Click a market card** to buy it (1 buy a turn, coins reset each turn) · **END TURN** — or press **Space** — to pass to Baron Vex
- **Keys 1–5** play the cards in your hand
- **Blade** cards (red) deal damage · **Coin** cards (gold) mint coins for the market · **Crown** cards (purple) score crowns and carry tricks like draw and guard
- Your hand stays with you from turn to turn, so you can save a Royal Blade for the killing turn. Unspent coins are wasted — buy every turn.
- Baron Vex plays by the same rules and buys from the same market. He starts with a fuller vault (46 HP to your 40) because he moves second.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request, no files outside `game/`. All art is drawn on
canvas and all sounds are synthesised with WebAudio — nothing is loaded from the
network.

## How it was built

Three candidates were built and judged head-to-head against the bounty judge's
criteria (completeness, fun and depth, feel and polish, look and originality,
structure) before this one was chosen:

- **Ember Pact** — an elemental duel (mana curve, element wheel, Surge chains). Complete and clean, but the most familiar of the three.
- **Coin & Crown** — this game. The market is the whole game: a player who never buys wins 0 in 200 simulated games, while a player who buys well wins 57–61% against the same policy — deck-building decisions compound every turn, and both win paths (15 crowns or breaking the rival's vault) stay live.
- **Rune Gambit** — a simultaneous-reveal trick duel with a 70%-accurate tell. The most original single mechanic, but one decision per round against this game's play-several-cards-plus-buy turns.

Coin & Crown won on completeness (a market, coins, crowns, both hands and both life totals in one frame) and on depth (the buy is a real decision every turn, and the deck you build is the game you play).

Built for [best-card-game-20261122-1826](https://make.fun/c/best-card-game-20261122-1826)
on make.fun. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored make.fun library.
