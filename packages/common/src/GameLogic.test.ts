import {
  handleGameAction,
  scoreMove,
  BonusType,
  BonusCellDef,
  GAME_ENDED,
  GameActionType,
  GameState,
  GameAction,
  IllegalReasonCode,
  startGame
} from "./GameLogic";
import shuffle from "shuffle-array";
import {
  tileDefSet,
  tilesFromTray,
  getTrayOfPlayer,
  lettersInTray,
  basicStartingState
} from "./GameTestUtils";

function handleLegalGameMove(state: GameState, action: GameAction): GameState {
  const result = handleGameAction(state, action);
  expect(result.illegalReasons).toEqual([]);
  return result.newState;
}

it("mocked shuffle reverses instead of shuffling", () => {
  expect(shuffle(["x", "y", "z"])).toEqual(["z", "y", "x"]);
});

it("scores a basic placement move", () => {
  const sm = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });
  expect(sm.totalScore).toEqual(8);
  expect(sm.words).toEqual([{ word: "pups", score: 8, valid: true }]);
});

it("scores a cross move", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kit", { x: 10, y: 8 }, true, getTrayOfPlayer(gs, 1))
  });
  const lastMove = gs.moves[gs.moves.length - 1];
  expect(lastMove.words).toEqual([{ word: "skit", score: 8, valid: false }]);
});

it("runs with basic placement moves", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });
  expect(gs.scores[0]).toEqual(8);
  expect(gs.scores[1]).toEqual(0);
  expect(gs.playerToMove).toEqual(1);
  expect(lettersInTray(getTrayOfPlayer(gs, 0))).toEqual(
    new Set("ple zyx".split(""))
  );

  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kit", { x: 10, y: 8 }, true, getTrayOfPlayer(gs, 1))
  });
  expect(gs.scores[0]).toEqual(8);
  expect(gs.scores[1]).toEqual(8);
  expect(gs.playerToMove).toEqual(0);
  expect(lettersInTray(getTrayOfPlayer(gs, 1))).toEqual(
    new Set("tehswvu".split(""))
  );
});

it("allows a move going across an existing word", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  const p1Tray = getTrayOfPlayer(gs, 1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("s", { x: 7, y: 6 }, true, p1Tray).concat(
      tilesFromTray("it", { x: 7, y: 8 }, true, p1Tray)
    )
  });
  const lastMove = gs.moves[gs.moves.length - 1];
  expect(lastMove.words).toEqual([{ word: "spit", score: 6, valid: true }]);
});

it("handles bonus tiles", () => {
  const getBonusType = (x: number, y: number): BonusCellDef | null => {
    switch (`${x},${y}`) {
      case "7,7":
        return { bonusType: BonusType.WORD, multiplier: 2 };
      case "7,8":
        return { bonusType: BonusType.LETTER, multiplier: 3 };
      default:
        return null;
    }
  };
  let gs = handleLegalGameMove(
    {
      ...basicStartingState,
      rules: { ...basicStartingState.rules, getCellBonus: getBonusType }
    },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray(
        "pups",
        { x: 7, y: 7 },
        false,
        getTrayOfPlayer(basicStartingState, 0)
      )
    }
  );
  // Should have double word score
  let lastMove = gs.moves[gs.moves.length - 1];
  expect(lastMove.totalScore).toEqual(16);
  expect(lastMove.words).toEqual([{ word: "pups", score: 16, valid: true }]);

  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("it", { x: 7, y: 8 }, true, getTrayOfPlayer(gs, 1))
  });
  lastMove = gs.moves[gs.moves.length - 1];
  // The i gets a triple letter score.  The "p" does NOT get a double word score, it was already placed.
  expect(lastMove.totalScore).toEqual(7);
  expect(lastMove.words).toEqual([{ word: "pit", score: 7, valid: false }]);
});

it("scores new words from adding to existing ones", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pup",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("ktts", { x: 10, y: 4 }, true, getTrayOfPlayer(gs, 1))
  });
  const lastMove = gs.moves[gs.moves.length - 1];
  expect(lastMove.totalScore).toEqual(16);
  expect(new Set(lastMove.words)).toEqual(
    new Set([
      { word: "pups", score: 8, valid: true },
      { word: "ktts", score: 8, valid: false }
    ])
  );
});

it("combines bonuses with multi-word moves", () => {
  const getBonusType = (x: number, y: number): BonusCellDef | null => {
    switch (`${x},${y}`) {
      case "10,7":
        return { bonusType: BonusType.WORD, multiplier: 2 };
      case "10,4":
        return { bonusType: BonusType.WORD, multiplier: 3 };
      case "10,5":
        return { bonusType: BonusType.LETTER, multiplier: 2 };
      default:
        return null;
    }
  };
  let gs = handleLegalGameMove(
    {
      ...basicStartingState,
      rules: { ...basicStartingState.rules, getCellBonus: getBonusType }
    },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray(
        "pup",
        { x: 7, y: 7 },
        false,
        getTrayOfPlayer(basicStartingState, 0)
      )
    }
  );

  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("ktts", { x: 10, y: 4 }, true, getTrayOfPlayer(gs, 1))
  });
  const lastMove = gs.moves[gs.moves.length - 1];
  // The i gets a double letter score.  The "k" gets a triple word score and the "s" gets a double word score,
  // which should apply to both words.
  expect(new Set(lastMove.words)).toEqual(
    new Set([
      { word: "pups", score: 16, valid: true },
      { word: "ktts", score: 54, valid: false }
    ])
  );
});

it("requires the first move to be on the center square", () => {
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 6 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.FIRST_MOVE_NOT_ON_CENTER,
    description: "First move must lie on center square"
  });

  const goodMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });
  expect(goodMove.illegalReasons).toEqual([]);
});

it("requires subsequent moves to be connected to the existing words", () => {
  const gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pup",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  const badMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kits", { x: 11, y: 4 }, true, getTrayOfPlayer(gs, 1))
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_CONNECTED,
    description: "Move must be connected to other tiles on the board"
  });

  const goodMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kits", { x: 10, y: 4 }, true, getTrayOfPlayer(gs, 1))
  });
  expect(goodMove.illegalReasons).toEqual([]);
});

it("disallows or allows invalid words depending on rule in effect", () => {
  const badMove = scoreMove(
    {
      ...basicStartingState,
      rules: { ...basicStartingState.rules, acceptInvalidWords: false }
    },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray(
        "pusp",
        { x: 7, y: 7 },
        false,
        getTrayOfPlayer(basicStartingState, 0)
      )
    }
  );
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.INVALID_WORD,
    description: "PUSP is not a valid word"
  });

  const goodMove = scoreMove(
    {
      ...basicStartingState,
      rules: { ...basicStartingState.rules, acceptInvalidWords: true }
    },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray(
        "pusp",
        { x: 7, y: 7 },
        false,
        getTrayOfPlayer(basicStartingState, 0)
      )
    }
  );
  expect(goodMove.illegalReasons).toEqual([]);
});

it("disallows or allows overwriting based on rule in effect", () => {
  const gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pup",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  const badMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kits", { x: 9, y: 4 }, true, getTrayOfPlayer(gs, 1))
  });
  expect(new Set(badMove.words.map(w => w.word))).toEqual(
    new Set(["kits", "pus"])
  );
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.DISALLOWED_OVERWRITE,
    description: "Cannot overwrite existing P with S"
  });

  const goodMove = scoreMove(
    { ...gs, rules: { ...gs.rules, allowOverwrite: true } },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 1,
      tiles: tilesFromTray("kits", { x: 9, y: 4 }, true, getTrayOfPlayer(gs, 1))
    }
  );
  expect(goodMove.illegalReasons).toEqual([]);
});

it("disallows moves not in a line", () => {
  const tiles = tilesFromTray(
    "pup",
    { x: 7, y: 7 },
    false,
    getTrayOfPlayer(basicStartingState, 0)
  );
  tiles[2].x -= 1;
  tiles[2].y += 1;
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
    description: "Move must be in one straight line"
  });
});

it("disallows moves in a line with one disconnected letter (horizontal)", () => {
  const playerTray = getTrayOfPlayer(basicStartingState, 0);
  const tiles = tilesFromTray("pup", { x: 7, y: 7 }, false, playerTray).concat(
    tilesFromTray("e", { x: 12, y: 7 }, false, playerTray)
  );
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
    description: "Move must be in one straight line"
  });
});

it("disallows moves in a line with one disconnected letter (vertical)", () => {
  const playerTray = getTrayOfPlayer(basicStartingState, 0);
  const tiles = tilesFromTray("pup", { x: 7, y: 7 }, true, playerTray).concat(
    tilesFromTray("e", { x: 7, y: 12 }, true, playerTray)
  );
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
    description: "Move must be in one straight line"
  });
});

it("disallows moves with multiple words in a line (horizontal)", () => {
  const playerTray = getTrayOfPlayer(basicStartingState, 0);
  const tiles = tilesFromTray("pup", { x: 7, y: 7 }, false, playerTray).concat(
    tilesFromTray("el", { x: 12, y: 7 }, false, playerTray)
  );
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
    description: "Move must be in one straight line"
  });
});

it("disallows moves with multiple words in a line (vertical)", () => {
  const playerTray = getTrayOfPlayer(basicStartingState, 0);
  const tiles = tilesFromTray("pup", { x: 7, y: 7 }, true, playerTray).concat(
    tilesFromTray("el", { x: 7, y: 12 }, true, playerTray)
  );
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
    description: "Move must be in one straight line"
  });
});

it("disallows moves with tiles off the board", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pupples",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  let badMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kits", { x: 14, y: 7 }, false, getTrayOfPlayer(gs, 1))
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.OUTSIDE_BOARD,
    description: "Cannot place S outside the board"
  });

  gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pupples",
      { x: 1, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  badMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("kits", { x: -3, y: 7 }, false, getTrayOfPlayer(gs, 1))
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.OUTSIDE_BOARD,
    description: "Cannot place K outside the board"
  });
});

it("disallows moves putting two tiles on the same square", () => {
  const tiles = tilesFromTray(
    "pup",
    { x: 7, y: 7 },
    false,
    getTrayOfPlayer(basicStartingState, 0)
  );
  tiles[2].x -= 1;
  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.TILES_ON_SAME_SQUARE,
    description: "Cannot place U and P on the same square"
  });
});

it("scores the bingo bonus when a player uses all tiles from a full rack", () => {
  const bingoMove = scoreMove(
    {
      ...basicStartingState,
      rules: {
        ...basicStartingState.rules,
        getWordSet: () => new Set(["pupples"])
      }
    },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray(
        "pupples",
        { x: 7, y: 7 },
        false,
        getTrayOfPlayer(basicStartingState, 0)
      )
    }
  );

  expect(bingoMove.words).toEqual([
    { word: "pupples", score: 13, valid: true }
  ]);
  expect(bingoMove.totalScore).toEqual(63);
});

it("ends the game when a player uses all tiles and the bag is empty", () => {
  const gameEndTrays = [...basicStartingState.trays];
  const lucyTray = tileDefSet("pups");
  gameEndTrays[0] = lucyTray;
  const gs = handleLegalGameMove(
    { ...basicStartingState, tilesInBag: [], trays: gameEndTrays },
    {
      actionType: GameActionType.PLAY_WORD,
      player: 0,
      tiles: tilesFromTray("pups", { x: 7, y: 7 }, false, lucyTray)
    }
  );
  expect(gs.moves[0].totalScore).toEqual(8);
  expect(gs.trays[0]).toEqual([]);
  expect(gs.playerToMove).toEqual(GAME_ENDED);
});

it("allows the second player to make the first move after the first one passes", () => {
  const gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PASS,
    player: 0
  });

  const badMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray(
      "kits",
      { x: 7, y: 6 },
      false,
      getTrayOfPlayer(basicStartingState, 1)
    )
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.FIRST_MOVE_NOT_ON_CENTER,
    description: "First move must lie on center square"
  });

  const goodMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray(
      "kits",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 1)
    )
  });
  expect(goodMove.illegalReasons).toEqual([]);
});

it("moves tray tiles", () => {
  const gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.REORDER_TRAY_TILES,
    player: 0,
    tray: tilesFromTray(
      "upplesp",
      { x: 0, y: 0 },
      false,
      basicStartingState.trays[0]
    )
  });
  expect(gs.trays[0].map(t => t.letter).join("")).toEqual("upplesp");
});

it("does not end the game when a player passes twice in a row", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: basicStartingState.trays[0]
  });
  expect(gs.playerToMove).toEqual(1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PASS,
    player: 1
  });
  expect(gs.playerToMove).toEqual(0);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: gs.trays[0]
  });
  expect(gs.playerToMove).toEqual(1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PASS,
    player: 1
  });
  expect(gs.playerToMove).not.toEqual(GAME_ENDED);
});

it("does not end the game when a player passes twice but not in a row", () => {
  let gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: basicStartingState.trays[0]
  });
  expect(gs.playerToMove).toEqual(1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PASS,
    player: 1
  });
  expect(gs.playerToMove).toEqual(0);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: gs.trays[0]
  });
  expect(gs.playerToMove).toEqual(1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 1,
    tiles: gs.trays[1]
  });
  expect(gs.playerToMove).toEqual(0);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: gs.trays[0]
  });
  expect(gs.playerToMove).toEqual(1);
  gs = handleLegalGameMove(gs, {
    actionType: GameActionType.PASS,
    player: 1
  });
  expect(gs.playerToMove).toEqual(0);
});

it("does not allow a move by a player out of turn", () => {
  const tiles = tilesFromTray(
    "kit",
    { x: 7, y: 7 },
    false,
    getTrayOfPlayer(basicStartingState, 1)
  );

  const result = handleGameAction(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles
  });
  expect(result.illegalReasons).toEqual([
    {
      code: IllegalReasonCode.MOVE_NOT_IN_TURN,
      description: "Cannot play word when it is not your turn"
    }
  ]);
  expect(result.newState).toEqual(basicStartingState);
});

it("does not allow reordering the tray to remove tiles from the tray", () => {
  const newTray = [...basicStartingState.trays[0]];
  newTray.pop();
  const result = handleGameAction(basicStartingState, {
    actionType: GameActionType.REORDER_TRAY_TILES,
    player: 0,
    tray: newTray
  });
  expect(result.illegalReasons).toEqual([
    {
      code: IllegalReasonCode.TILE_REORDER_TRAY_NOT_COMPLETE,
      description: "Cannot reorder tiles without all tiles in tray"
    }
  ]);
});

it("does not allow reordering the tray to add new tiles to the tray", () => {
  const newTray = [...basicStartingState.trays[0]];
  newTray[0] = basicStartingState.tilesInBag[0];
  const result = handleGameAction(basicStartingState, {
    actionType: GameActionType.REORDER_TRAY_TILES,
    player: 0,
    tray: newTray
  });
  expect(result.illegalReasons).toEqual([
    {
      code: IllegalReasonCode.TILE_NOT_IN_TRAY,
      description:
        "Cannot reorder tiles in tray with tile that is not in your tray"
    }
  ]);
});

it("does not allow you to play tiles not in your tray", () => {
  const result = handleGameAction(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "fax",
      { x: 7, y: 7 },
      false,
      basicStartingState.tilesInBag
    )
  });
  expect(result.illegalReasons).toEqual([
    {
      code: IllegalReasonCode.TILE_NOT_IN_TRAY,
      description: "Cannot play word with tile that is not in your tray"
    }
  ]);
});

it("does not allow you to exchange tiles not in your tray", () => {
  const result = handleGameAction(basicStartingState, {
    actionType: GameActionType.EXCHANGE_TILES,
    player: 0,
    tiles: tilesFromTray(
      "fax",
      { x: 7, y: 7 },
      false,
      basicStartingState.tilesInBag
    )
  });

  expect(result.illegalReasons).toEqual([
    {
      code: IllegalReasonCode.TILE_NOT_IN_TRAY,
      description: "Cannot exchange tiles with tile that is not in your tray"
    }
  ]);
});

it("draws tiles and randomizes at start", () => {
  const gs = startGame({ ...basicStartingState, trays: [[], []] });
  expect(gs.trays).toEqual([
    tilesFromTray(
      "abcdefg",
      { x: 0, y: 0 },
      false,
      basicStartingState.tilesInBag
    ).map(t => ({
      id: t.id,
      letter: t.letter,
      pointValue: t.pointValue,
      isBlank: t.isBlank
    })),
    tilesFromTray(
      "hijklmn",
      { x: 0, y: 0 },
      false,
      basicStartingState.tilesInBag
    ).map(t => ({
      id: t.id,
      letter: t.letter,
      pointValue: t.pointValue,
      isBlank: t.isBlank
    }))
  ]);
});

it("disallows moves with a single tile", () => {
  const playerTray = getTrayOfPlayer(basicStartingState, 0);
  const tiles = tilesFromTray("e", { x: 12, y: 7 }, false, playerTray);

  const badMove = scoreMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tiles
  });
  expect(badMove.illegalReasons).toContainEqual({
    code: IllegalReasonCode.NOT_FORMING_WORD,
    description: "Move must form at least one word"
  });
});

it("allows moves that add a single tile to make a valid word", () => {
  const gs = handleLegalGameMove(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pup",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0)
    )
  });

  const goodMove = scoreMove(gs, {
    actionType: GameActionType.PLAY_WORD,
    player: 1,
    tiles: tilesFromTray("s", { x: 10, y: 7 }, false, getTrayOfPlayer(gs, 1))
  });
  expect(goodMove.illegalReasons).toEqual([]);
});
