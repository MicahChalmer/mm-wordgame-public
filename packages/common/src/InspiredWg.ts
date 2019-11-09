import {
  GameState,
  BonusCellDef,
  BonusType,
  TileDef,
  newId,
  Player
} from "./GameLogic";

export enum InspiredWgBonusType {
  DoubleLetter,
  TripleLetter,
  DoubleWord,
  TripleWord
}

interface InspiredWgBonusTypeDef {
  locations: [number, number][];
}

const inspiredWgBonusTypeDefs: [
  InspiredWgBonusType,
  InspiredWgBonusTypeDef
][] = [
  [
    InspiredWgBonusType.TripleWord,
    {
      locations: [
        [0, 0],
        [7, 0],
        [14, 0],
        [0, 7],
        [14, 7],
        [0, 14],
        [7, 14],
        [14, 14]
      ]
    }
  ],

  [
    InspiredWgBonusType.TripleLetter,
    {
      locations: [
        [5, 1],
        [9, 1],
        [1, 5],
        [5, 5],
        [9, 5],
        [13, 5],
        [1, 9],
        [5, 9],
        [9, 9],
        [13, 9],
        [5, 13],
        [9, 13]
      ]
    }
  ],

  [
    InspiredWgBonusType.DoubleWord,
    {
      locations: Array.prototype.concat
        .apply(
          [],
          [1, 2, 3, 4].map(
            n =>
              [[n, n], [14 - n, n], [n, 14 - n], [14 - n, 14 - n]] as [
                number,
                number
              ][]
          )
        )
        .concat([[7, 7]])
    }
  ],

  [
    InspiredWgBonusType.DoubleLetter,
    {
      locations: [
        [3, 0],
        [11, 0],
        [0, 3],
        [6, 2],
        [7, 3],
        [8, 2],
        [14, 3],
        [2, 6],
        [3, 7],
        [2, 8],
        [12, 6],
        [11, 7],
        [12, 8],
        [6, 6],
        [8, 6],
        [6, 8],
        [8, 8],
        [0, 11],
        [6, 12],
        [7, 11],
        [8, 12],
        [14, 11],
        [3, 14],
        [11, 14]
      ]
    }
  ]
];

const typeByCoord: (
  | [InspiredWgBonusType, InspiredWgBonusTypeDef]
  | null)[][] = (function() {
  const res = Array.from(Array(15), () => new Array(15));
  for (const [type, def] of inspiredWgBonusTypeDefs) {
    for (const [x, y] of def.locations) {
      res[x][y] = [type, def];
    }
  }
  return res;
})();

export function inspiredWgBonusCellDef(
  x: number,
  y: number
): BonusCellDef | null {
  const t = typeByCoord[x][y];
  if (!t) return null;
  switch (t[0]) {
    case InspiredWgBonusType.DoubleLetter:
      return { bonusType: BonusType.LETTER, multiplier: 2 };
    case InspiredWgBonusType.TripleLetter:
      return { bonusType: BonusType.LETTER, multiplier: 3 };
    case InspiredWgBonusType.DoubleWord:
      return { bonusType: BonusType.WORD, multiplier: 2 };
    case InspiredWgBonusType.TripleWord:
      return { bonusType: BonusType.WORD, multiplier: 3 };
    default:
      return null;
  }
}

/*2 blank tiles (scoring 0 points)
   1 point: E ×12, A ×9, I ×9, O ×8, N ×6, R ×6, T ×6, L ×4, S ×4, U ×4
   2 points: D ×4, G ×3
   3 points: B ×2, C ×2, M ×2, P ×2
   4 points: F ×2, H ×2, V ×2, W ×2, Y ×2
   5 points: K ×1
   8 points: J ×1, X ×1
   10 points: Q ×1, Z ×1
 */
const letterScores: Map<string, number> = (function() {
  const ls = new Map<string, number>();
  const scores: [string, number][] = [
    ["e a i o n r t l s u", 1],
    ["d g", 2],
    ["b c m p", 3],
    ["f h v w y", 4],
    ["k", 5],
    ["j x", 8],
    ["q z", 10]
  ];
  for (const [str, pv] of scores) {
    for (const ltr of str.split(" ")) ls.set(ltr, pv);
  }
  return ls;
})();

export function inspiredWgLetterPointValue(ltr: string): number {
  return letterScores.get(ltr) || 0;
}

function tileRepeat(n: number, letter: string): TileDef[] {
  return Array.from(Array(n), () => {
    const res: TileDef = {
      letter,
      pointValue: inspiredWgLetterPointValue(letter),
      id: newId(letter)
    };
    if (letter === " ") res.isBlank = true;
    return res;
  });
}

export const INSPIRED_WG_RULE_DEFAULTS = {
  traySize: 7,
  width: 15,
  height: 15,
  bingoBonus: 50,
  allowOverwrite: false,
  acceptInvalidWords: false
};

export function inspiredWgNewGame(
  players: Player[],
  acceptInvalidWords: boolean,
  getWordSet: () => Set<string>
): GameState {
  return {
    players,
    rules: {
      ...INSPIRED_WG_RULE_DEFAULTS,
      getCellBonus: inspiredWgBonusCellDef,
      acceptInvalidWords,
      getWordSet
    },
    moves: [],
    playerToMove: 0,
    scores: [...players.map(() => 0)],
    trays: [...players.map(() => [])],
    tilesInBag: ([] as TileDef[]).concat.apply(
      [],
      ([
        [2, " "],
        [12, "e"],
        [9, "a"],
        [9, "i"],
        [8, "o"],
        [6, "n"],
        [6, "r"],
        [6, "t"],
        [4, "l"],
        [4, "s"],
        [4, "u"],
        [4, "d"],
        [3, "g"],
        [2, "b"],
        [2, "c"],
        [2, "m"],
        [2, "p"],
        [2, "f"],
        [2, "h"],
        [2, "v"],
        [2, "w"],
        [2, "y"],
        [1, "k"],
        [1, "j"],
        [1, "x"],
        [1, "q"],
        [1, "z"]
      ] as [number, string][]).map(([n, letter]: [number, string]) =>
        tileRepeat(n, letter)
      )
    )
  };
}
