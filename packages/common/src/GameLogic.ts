import { produce } from "immer";
import shuffle from "shuffle-array";

export type UniqueSeqId = string;
export const newId = function(
  this: { next: number },
  letter?: string
): UniqueSeqId {
  return (letter ? "" : letter + "-") + (this.next++).toString();
}.bind({ next: 0 });

export interface TileDef {
  letter: string;
  pointValue: number;
  isBlank?: boolean;
  isPhantom?: boolean;
  isCursor?: boolean;
  id: UniqueSeqId;
}

export interface PlacedTileDef extends TileDef {
  x: number;
  y: number;
}

export enum GameActionType {
  EXCHANGE_TILES = "Exchange Tiles",
  PASS = "Pass",
  REORDER_TRAY_TILES = "Reorder Tiles in Tray",
  PLAY_WORD = "Play Word"
}

export interface Pass {
  actionType: GameActionType.PASS;
  player: number;
}

export interface ExchangeTiles {
  actionType: GameActionType.EXCHANGE_TILES;
  tiles: TileDef[];
  player: number;
}

export interface ReorderTiles {
  actionType: GameActionType.REORDER_TRAY_TILES;
  tray: TileDef[];
  player: number;
}

export interface PlayWord {
  actionType: GameActionType.PLAY_WORD;
  tiles: PlacedTileDef[];
  player: number;
}

export type GameMove = PlayWord | Pass | ExchangeTiles;
export type GameAction = GameMove | ReorderTiles;

export enum IllegalReasonCode {
  OUTSIDE_BOARD,
  TILES_ON_SAME_SQUARE,
  DISALLOWED_OVERWRITE,
  NOT_IN_STRAIGHT_LINE,
  NOT_FORMING_WORD,
  FIRST_MOVE_NOT_ON_CENTER,
  NOT_CONNECTED,
  INVALID_WORD,
  TILE_NOT_IN_TRAY,
  MOVE_NOT_IN_TURN,
  TILE_REORDER_TRAY_NOT_COMPLETE,
  DUPLICATE_TILE
}

export interface IllegalReason {
  code: IllegalReasonCode;
  description: string;
}
/**
 * Just for convenience to avoid repeating field names
 * @param code
 * @param description
 */
function ir(code: IllegalReasonCode, description: string): IllegalReason {
  return { code, description };
}

export interface ScoredWord {
  word: string;
  score: number;
  valid: boolean;
}

export interface ScoredGameMove {
  move: GameMove;
  words: ScoredWord[];
  totalScore: number;
  illegalReasons: IllegalReason[];
}

export enum BonusType {
  LETTER = "letter",
  WORD = "word"
}

export interface BonusCellDef {
  bonusType: BonusType;
  multiplier: number;
}

export interface GameRules {
  traySize: number;
  width: number;
  height: number;
  bingoBonus: number;
  acceptInvalidWords: boolean;
  getCellBonus: (
    x: number,
    y: number,
    state: CommonKnowledgeGameState
  ) => BonusCellDef | null;
  getWordSet: () => Set<string>;
  allowOverwrite: boolean;
}

export interface Player {
  playerId: string;
  name: string;
  email?: string;
}

export const GAME_ENDED = "Game Ended";

export type PlayerToMove = number | typeof GAME_ENDED;

export interface CommonKnowledgeGameState {
  rules: GameRules;
  players: Player[];
  playerToMove: PlayerToMove;
  moves: ScoredGameMove[];
  scores: number[];
}

export interface GameState extends CommonKnowledgeGameState {
  tilesInBag: TileDef[];
  trays: TileDef[][];
}

export function tilesByCell(
  state: CommonKnowledgeGameState,
  moreMoves: GameMove[] = []
): TileDef[][] {
  const cellTiles = Array.from(
    Array(state.rules.width),
    () => new Array(state.rules.height)
  );
  for (const move of Array.from<GameMove>(state.moves.map(sm => sm.move))
    .concat(moreMoves)
    .filter(mv => mv.actionType === GameActionType.PLAY_WORD) as PlayWord[]) {
    for (const tile of move.tiles) {
      if (
        tile.x < state.rules.width &&
        tile.y < state.rules.height &&
        tile.x >= 0 &&
        tile.y >= 0
      )
        cellTiles[tile.x][tile.y] = tile;
    }
  }
  return cellTiles;
}

function validateAllTilesInTray(
  player: number,
  tray: TileDef[],
  actionTiles: TileDef[],
  actionType: GameActionType
): IllegalReason[] {
  const illegalReasons = [];
  if (!actionTiles.every(at => tray.some(tt => at.id === tt.id))) {
    illegalReasons.push(
      ir(
        IllegalReasonCode.TILE_NOT_IN_TRAY,
        `Cannot ${actionType.toLowerCase()} with tile that is not in your tray`
      )
    );
  }
  return illegalReasons;
}

function validateNoDuplicateTiles(actionTiles: TileDef[]): IllegalReason[] {
  const illegalReasons = [];
  if (new Set(actionTiles.map(at => at.id)).size < actionTiles.length) {
    illegalReasons.push(
      ir(IllegalReasonCode.DUPLICATE_TILE, `Tile IDs duplicated in tile list`)
    );
  }
  return illegalReasons;
}

export function scoreMove(
  state: CommonKnowledgeGameState,
  move: GameMove
): ScoredGameMove {
  const illegalReasons =
    move.actionType === GameActionType.PASS
      ? []
      : validateNoDuplicateTiles(move.tiles);

  if (move.actionType !== GameActionType.PLAY_WORD)
    return { move, totalScore: 0, words: [], illegalReasons };

  const tbc = tilesByCell(state, [move]);
  const addWordFromTile = (
    tile: PlacedTileDef,
    remaining: PlacedTileDef[],
    vertical: boolean
  ): [PlacedTileDef[], PlacedTileDef[]] => {
    const tilesInWord = [tile];
    for (const incr of [1, -1]) {
      let currTile = tile;
      // This loop does terminate (will always get to the edge where there are no tiles)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // ESLint is warning because the filter funcs created on each loop
        // iteration would refer to the same "currTile".  But that doesn't matter--
        // the function passed to `filter` does not get saved past that call.
        // eslint-disable-next-line no-loop-func
        remaining = remaining.filter(pt => pt.id !== currTile.id);
        const nextX = vertical ? currTile.x : currTile.x + incr;
        const nextY = vertical ? currTile.y + incr : currTile.y;
        const nextTileDef = (tbc[nextX] || [])[nextY];
        if (!nextTileDef) break;

        currTile = { ...nextTileDef, x: nextX, y: nextY };
        if (incr === 1) tilesInWord.push(currTile);
        else tilesInWord.unshift(currTile);
      }
    }
    return [tilesInWord, remaining];
  };

  const tileWords = new Array<PlacedTileDef[]>();
  for (const vertical of [true, false]) {
    let remaining = [...move.tiles];
    while (remaining.length) {
      let tilesInWord;
      [tilesInWord, remaining] = addWordFromTile(
        remaining[0],
        remaining,
        vertical
      );
      if (tilesInWord.length > 1) tileWords.push(tilesInWord);
    }
  }

  const words: ScoredWord[] = [];
  for (const tw of tileWords) {
    let wordMultiple = 1;
    let wordScore = 0;
    let word = "";
    for (const tile of tw) {
      let letterScore = tile.pointValue;
      const bonus =
        move.tiles.some(at => at.id === tile.id) &&
        state.rules.getCellBonus(tile.x, tile.y, state);
      if (bonus) {
        switch (bonus.bonusType) {
          case "letter":
            letterScore *= bonus.multiplier;
            break;
          case "word":
            wordMultiple *= bonus.multiplier;
            break;
          default:
        }
      }
      wordScore += letterScore;
      word = word.concat(tile.letter);
    }
    wordScore *= wordMultiple;
    words.push({
      word,
      score: wordScore,
      valid: state.rules.getWordSet().has(word)
    });
  }

  let totalScore = words.reduce((pv, word) => pv + word.score, 0);

  if (move.tiles.length >= state.rules.traySize)
    totalScore += state.rules.bingoBonus;

  let connectedToBoard = false;

  let sameX = true;
  let sameY = true;
  let minX = state.rules.width,
    maxX = -1,
    minY = state.rules.height,
    maxY = -1;

  for (const [idx, tile] of move.tiles.entries()) {
    if (idx !== 0) {
      const prev = move.tiles[idx - 1];
      sameX = sameX && tile.x === prev.x;
      sameY = sameY && tile.y === prev.y;
    }
    minX = Math.min(minX, tile.x);
    minY = Math.min(minY, tile.y);
    maxX = Math.max(maxX, tile.x);
    maxY = Math.max(maxY, tile.y);

    if (
      tile.x < 0 ||
      tile.x >= state.rules.width ||
      tile.y < 0 ||
      tile.y >= state.rules.height
    ) {
      illegalReasons.push(
        ir(
          IllegalReasonCode.OUTSIDE_BOARD,
          `Cannot place ${tile.letter.toUpperCase()} outside the board`
        )
      );
      continue;
    }

    const sameSquareTile = move.tiles.find(
      (dtile, didx) => didx !== idx && dtile.x === tile.x && dtile.y === tile.y
    );
    if (sameSquareTile)
      illegalReasons.push(
        ir(
          IllegalReasonCode.TILES_ON_SAME_SQUARE,
          `Cannot place ${sameSquareTile.letter.toUpperCase()} and ${tile.letter.toUpperCase()} on the same square`
        )
      );

    connectedToBoard =
      connectedToBoard ||
      [
        tbc[tile.x][tile.y - 1],
        tbc[tile.x][tile.y + 1],
        (tbc[tile.x - 1] || [])[tile.y],
        (tbc[tile.x + 1] || [])[tile.y]
      ].some(t => t && !move.tiles.some(at => at.id === t.id));

    if (!state.rules.allowOverwrite) {
      const overwriteMove: PlayWord | undefined = (x =>
        x && (x.move as PlayWord))(
        state.moves.find(
          mv =>
            mv.move.actionType === GameActionType.PLAY_WORD &&
            mv.move.tiles.some(mt => mt.x === tile.x && mt.y === tile.y)
        )
      );
      const overwriteTile =
        overwriteMove &&
        overwriteMove.tiles.find(mt => mt.x === tile.x && mt.y === tile.y);
      if (overwriteTile)
        illegalReasons.push(
          ir(
            IllegalReasonCode.DISALLOWED_OVERWRITE,
            `Cannot overwrite existing ${overwriteTile.letter.toUpperCase()} with ${tile.letter.toUpperCase()}`
          )
        );
    }
  }
  let inStraightLine = sameX || sameY;
  if (inStraightLine && !(sameX && sameY)) {
    for (
      let tile = { x: minX, y: minY };
      tile.x <= maxX &&
      tile.y <= maxY &&
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x < state.rules.width &&
      tile.y < state.rules.height;
      tile = { x: tile.x + (sameX ? 0 : 1), y: tile.y + (sameY ? 0 : 1) }
    ) {
      if (tbc[tile.x][tile.y] === undefined) {
        inStraightLine = false;
        break;
      }
    }
  }
  if (!inStraightLine) {
    illegalReasons.push(
      ir(
        IllegalReasonCode.NOT_IN_STRAIGHT_LINE,
        "Move must be in one straight line"
      )
    );
  }

  if (!words.length) {
    illegalReasons.push(
      ir(IllegalReasonCode.NOT_FORMING_WORD, "Move must form at least one word")
    );
  } else if (
    !state.moves.some(mv => mv.move.actionType === GameActionType.PLAY_WORD)
  ) {
    const centerX = Math.trunc(state.rules.width / 2);
    const centerY = Math.trunc(state.rules.height / 2);
    if (!move.tiles.some(tile => tile.x === centerX && tile.y === centerY))
      illegalReasons.push(
        ir(
          IllegalReasonCode.FIRST_MOVE_NOT_ON_CENTER,
          "First move must lie on center square"
        )
      );
  } else {
    if (!connectedToBoard)
      illegalReasons.push(
        ir(
          IllegalReasonCode.NOT_CONNECTED,
          "Move must be connected to other tiles on the board"
        )
      );
  }

  if (!state.rules.acceptInvalidWords)
    for (const w of words)
      if (!w.valid)
        illegalReasons.push(
          ir(
            IllegalReasonCode.INVALID_WORD,
            `${w.word.toUpperCase()} is not a valid word`
          )
        );

  return { move, words, totalScore, illegalReasons };
}

export interface GameEventResult {
  newState: GameState;
  illegalReasons: IllegalReason[];
}

/**
 * Note: this MUTATES the GameState.  Intended to be used inside immer
 * producer functions.  Hence not exported.
 */
function drawTiles(state: GameState): void {
  for (const [player] of state.players.entries()) {
    const ptray = state.trays[player] || [];
    // Draw more tiles from the bag replacing the ones used/exchanged
    while (ptray.length < state.rules.traySize && state.tilesInBag.length > 0) {
      const nextTile = state.tilesInBag.pop();
      if (nextTile === undefined)
        throw new Error(`Tried to draw from empty bag`);
      ptray.push(nextTile);
    }
    state.trays[player] = ptray;
  }
}

export function handleGameAction(
  prevState: GameState,
  action: GameAction
): GameEventResult {
  const illegalReasons: IllegalReason[] = [];
  let newState = produce(prevState, state => {
    const recordMove = (move: GameMove, endingMove: boolean): void => {
      const scoredMove = scoreMove(prevState, move);
      illegalReasons.push(...scoredMove.illegalReasons);
      state.moves.push(scoredMove);
      state.scores[move.player] =
        (state.scores[move.player] || 0) + scoredMove.totalScore;
      state.playerToMove =
        state.playerToMove === GAME_ENDED || endingMove
          ? GAME_ENDED
          : (state.playerToMove + 1) % state.players.length;
    };

    const removeActionTiles = (
      player: number,
      actionTiles: TileDef[]
    ): void => {
      state.trays[player] = (state.trays[player] || []).filter(
        td => !actionTiles.some(tile => tile.id === td.id)
      );
    };

    const checkCurrentPlayer = (player: number): void => {
      if (player !== state.playerToMove)
        illegalReasons.push(
          ir(
            IllegalReasonCode.MOVE_NOT_IN_TURN,
            `Cannot ${action.actionType.toLowerCase()} when it is not your turn`
          )
        );
    };

    switch (action.actionType) {
      case GameActionType.REORDER_TRAY_TILES:
        {
          const aptray = state.trays[action.player];
          if (aptray) {
            illegalReasons.push(
              ...validateAllTilesInTray(
                action.player,
                aptray,
                action.tray,
                action.actionType
              )
            );
            if (action.tray.length !== aptray.length)
              illegalReasons.push(
                ir(
                  IllegalReasonCode.TILE_REORDER_TRAY_NOT_COMPLETE,
                  "Cannot reorder tiles without all tiles in tray"
                )
              );
            state.trays[action.player] = action.tray;
          }
        }
        break;

      case GameActionType.PASS:
        {
          checkCurrentPlayer(action.player);
          recordMove(action, false);
        }
        break;

      case GameActionType.EXCHANGE_TILES:
      case GameActionType.PLAY_WORD:
        checkCurrentPlayer(action.player);

        if (action.actionType === GameActionType.EXCHANGE_TILES) {
          for (const tile of action.tiles) {
            state.tilesInBag.push(tile);
          }
          shuffle(state.tilesInBag);
        }
        illegalReasons.push(
          ...validateAllTilesInTray(
            action.player,
            state.trays[action.player],
            action.tiles,
            action.actionType
          )
        );
        removeActionTiles(action.player, action.tiles);
        drawTiles(state);

        recordMove(action, state.trays[action.player].length === 0);
        break;
      default:
        throw new Error("Unexpected action type");
    }
  });

  // Don't advance the game from an illegal move
  if (illegalReasons.length) newState = prevState;

  return { newState, illegalReasons };
}

export function startGame(state: GameState): GameState {
  return produce(state, draft => {
    shuffle(draft.tilesInBag);
    drawTiles(draft);
  });
}

/** Game state as visible to a single player
 */
export interface PlayerVisibleGameState extends CommonKnowledgeGameState {
  me: number;
  myTray: TileDef[];
}

export function gameStateVisibleToPlayer(
  state: GameState,
  player: number
): PlayerVisibleGameState {
  return {
    rules: state.rules,
    players: state.players,
    playerToMove: state.playerToMove,
    moves: state.moves,
    scores: state.scores,
    me: player,
    myTray: state.trays[player]
  };
}

export function handleGameEventAsKnownToPlayer(
  state: PlayerVisibleGameState,
  event: GameAction
): { newState: PlayerVisibleGameState; illegalReasons: IllegalReason[] } {
  const trays = state.players.map((_, idx) =>
    idx === state.me ? state.myTray : []
  );

  const dummyBag: TileDef[] = Array.from(
    Array(state.players.length * state.rules.traySize + 1)
  ).map((_, idx) => ({
    id: `dummy-tile-${idx}`,
    letter: "?",
    isBlank: true,
    pointValue: 0,
    isPhantom: true
  }));

  const dummyGS: GameState = {
    rules: state.rules,
    players: state.players,
    playerToMove: state.playerToMove,
    scores: state.scores,
    trays,
    tilesInBag: dummyBag,
    moves: state.moves
  };
  const result = handleGameAction(dummyGS, event);
  const newState = gameStateVisibleToPlayer(result.newState, state.me);
  newState.myTray = newState.myTray.filter(td => !td.isPhantom);
  return { newState, illegalReasons: result.illegalReasons };
}

export interface GameMetadata {
  gameId: string;
  startedAt: Date;
  lastMoveAt: Date;
  rulesName: string;
  wordSetName: string;
}

export interface GameListEntry extends GameMetadata {
  playerToMove: PlayerToMove;
  players: Player[];
  lastMoveDescription: string;
  scores: number[];
}

export interface DataForNewGameView {
  availablePlayers: Player[];
  availableWordSetNames: string[];
}
