import { TileDef, PlacedTileDef, GameState, newId } from "./GameLogic";

export function tileDefSet(s: string): TileDef[] {
  const testPointValues: { [key: string]: number | undefined } = {
    k: 5,
    p: 3,
    h: 4
  };
  return s.split("").map(c => ({
    letter: c,
    pointValue: testPointValues[c] || 1,
    isBlank: c === " ",
    id: newId(c)
  }));
}

export function tilesFromTray(
  word: string,
  startingAt: { x: number; y: number },
  vertical: boolean,
  tray: TileDef[]
): PlacedTileDef[] {
  let { x, y } = startingAt;
  return word.split("").map(c => {
    const res: PlacedTileDef = {
      x,
      y,
      ...(tray.find(td => td.letter === c) ||
        (() => {
          throw new Error(`Can't find ${c} in tray`);
        })())
    };
    tray = tray.filter(td => td.id !== res.id);
    if (vertical) {
      y++;
    } else {
      x++;
    }
    return res;
  });
}

export function lettersInTray(tray: TileDef[]): Set<string> {
  return new Set(tray.map(td => td.letter));
}

export function getTrayOfPlayer(gs: GameState, player: number): TileDef[] {
  return (
    gs.trays[player] ||
    (() => {
      throw new Error(`Can't find player ${player} (${gs.players[player]})`);
    })()
  );
}

export const basicStartingState: GameState = {
  rules: {
    width: 15,
    height: 15,
    traySize: 7,
    bingoBonus: 50,
    getCellBonus: () => null,
    getWordSet: () =>
      new Set(["pup", "kit", "pupple", "pups", "kits", "puppples", "spit"]),
    acceptInvalidWords: true,
    allowOverwrite: false
  },
  players: [
    { name: "Lucy", playerId: "woof" },
    { name: "Jack", playerId: "meow" }
  ],
  tilesInBag: tileDefSet("abcdefghijklmnopqrstuvwxyz "),
  playerToMove: 0,
  trays: [tileDefSet("pupples"), tileDefSet("kittehs")],
  moves: [],
  scores: [0, 0]
};
