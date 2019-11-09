import * as React from "react";
import {
  useState,
  useImperativeHandle,
  useRef,
  useLayoutEffect,
  Ref,
  useCallback,
  ReactElement,
} from "react";
import Board, {
  CellBackgroundFn,
  squareCoordsFromDroppableId,
  boardInnerTileSize,
  boardSizeInPX,
} from "./Board";
import TileSet from "./TileSet";
import MoveList from "./MoveList";
import produce from "immer";
import { DraggableTileDef } from "./Tile";
import {
  GameActionType,
  tilesByCell,
  TileDef,
  scoreMove,
  GAME_ENDED,
  newId,
  PlayWord,
  GameAction,
  PlayerVisibleGameState,
  IllegalReasonCode,
} from "mm-wordgame-common/src/GameLogic";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import ReactModal from "react-modal";
import BlankLetterChooser from "./BlankLetterChooser";

export enum CursorDirection {
  UP = "\u2191",
  DOWN = "\u2193",
  LEFT = "\u2190",
  RIGHT = "\u2192",
}

function rotateCursorDirection(dir: CursorDirection): CursorDirection {
  return (
    {
      [CursorDirection.LEFT]: CursorDirection.UP,
      [CursorDirection.UP]: CursorDirection.RIGHT,
      [CursorDirection.RIGHT]: CursorDirection.DOWN,
      [CursorDirection.DOWN]: CursorDirection.LEFT,
    }[dir] || CursorDirection.LEFT
  );
}

const CursorTileID = newId("cursor");

export interface GameProps {
  gameState: PlayerVisibleGameState;
  cellBackground: CellBackgroundFn;
  failureMessage?: string;
  dispatch: (value: GameAction) => void;
  topContent?: ReactElement;
}

export interface GameRef {
  simulateTileDragDrop: (_: DropResult) => void;
}

const trayBorderColor = "rgb(221, 221, 204)";
const Game = React.forwardRef(function Game(
  {
    gameState,
    cellBackground,
    failureMessage,
    dispatch,
    topContent,
  }: GameProps,
  ref: Ref<{}>,
) {
  const cellTiles = tilesByCell(gameState);

  const cellSize = 54;
  const [tileWidth, tileHeight] = boardInnerTileSize(cellSize, cellSize);

  const blankPendingMove: PlayWord = {
    actionType: GameActionType.PLAY_WORD,
    player: gameState.me,
    tiles: [],
  };

  const [pendingMove, setPendingMove] = useState<PlayWord>(blankPendingMove);
  const cellTilesWithPending = tilesByCell(gameState, [pendingMove]);

  const [isExchangingTiles, setIsExchangingTiles] = useState(false);
  const [tilesToExchange, setTilesToExchange] = useState<DraggableTileDef[]>(
    [],
  );

  const noCursor = {
    direction: CursorDirection.RIGHT,
    x: 0,
    y: 0,
    active: false,
  };
  const [cursor, setCursor] = useState(noCursor);
  if (cursor.active && cellTilesWithPending[cursor.x][cursor.y])
    setCursor(noCursor);

  const clearPendingMove = (): void => {
    setPendingMove(blankPendingMove);
    setCursor(noCursor);
  };
  if (gameState.me !== pendingMove.player) clearPendingMove();

  const advanceCursor = (by: number): void => {
    if (!cursor.active) return;

    setCursor(
      produce(cursor, dftCursor => {
        do {
          switch (cursor.direction) {
            case CursorDirection.DOWN:
              dftCursor.y += by;
              break;
            case CursorDirection.UP:
              dftCursor.y -= by;
              break;
            case CursorDirection.LEFT:
              dftCursor.x -= by;
              break;
            case CursorDirection.RIGHT:
              dftCursor.x += by;
              break;
            default:
              throw new Error("Invalid cursor direction");
          }
        } while ((cellTilesWithPending[dftCursor.x] || [])[dftCursor.y]);

        if (
          dftCursor.y < 0 ||
          dftCursor.y >= gameState.rules.height ||
          dftCursor.x < 0 ||
          dftCursor.x >= gameState.rules.width
        ) {
          dftCursor.x = 0;
          dftCursor.y = 0;
          dftCursor.active = false;
        }
      }),
    );
  };

  const getCellTile = (x: number, y: number): DraggableTileDef | null => {
    if (cursor.active && x === cursor.x && y === cursor.y) {
      return {
        id: CursorTileID,
        isCursor: true,
        letter: cursor.direction,
        pointValue: 0,
      };
    }

    let ct = cellTiles[x][y];
    if (ct) return ct;

    ct = cellTilesWithPending[x][y];
    if (ct)
      return {
        ...ct,
        isPhantom: true,
        isDraggable: true,
      };

    return null;
  };

  const boardCellClick = (
    evt: React.MouseEvent,
    x: number,
    y: number,
  ): void => {
    if (gameState.rules.allowOverwrite || !cellTilesWithPending[x][y]) {
      setCursor(
        produce(cursor, dftCursor => {
          if (x === cursor.x && y === cursor.y && cursor.active)
            dftCursor.direction = rotateCursorDirection(dftCursor.direction);
          else {
            dftCursor.x = x;
            dftCursor.y = y;
          }
          dftCursor.active = true;
        }),
      );
    }
    evt.stopPropagation();
  };

  const trayTiles =
    gameState.playerToMove === GAME_ENDED
      ? []
      : gameState.myTray.filter(
        tile =>
          ![...pendingMove.tiles, ...tilesToExchange].some(
            pmt => pmt.id === tile.id,
          ),
      );

  const performPendingMove = (): void => {
    dispatch(pendingMove);
  };

  const scoredPendingMove = scoreMove(gameState, pendingMove);
  const legalMove = scoredPendingMove.illegalReasons.length === 0;
  const shouldBeImpossibleReasons = [
    IllegalReasonCode.OUTSIDE_BOARD,
    IllegalReasonCode.TILES_ON_SAME_SQUARE,
    IllegalReasonCode.DISALLOWED_OVERWRITE,
  ];
  if (
    scoredPendingMove.illegalReasons.some(
      ir =>
        shouldBeImpossibleReasons.find(irc => irc === ir.code) !== undefined,
    ) ||
    // Clear the pending move if not all tiles are still in the tray
    !pendingMove.tiles.every(t => !!gameState.myTray.find(tt => t.id === tt.id))
  ) {
    clearPendingMove();
  }

  const CPT_ID = "current-player-tray";

  const canCellDrop = (x: number, y: number): boolean => {
    return !isExchangingTiles && !cellTilesWithPending[x][y];
  };

  const passTurn = (): void => {
    dispatch({
      actionType: GameActionType.PASS,
      player: gameState.me,
    });
  };

  const blankPendingMoveTile: TileDef | undefined = pendingMove.tiles.find(
    tile => tile.letter === " ",
  );

  const chooseBlankLetter = (letter: string): void => {
    if (!blankPendingMoveTile) return;

    setPendingMove(
      produce(pendingMove, newPM => {
        const blankTile = newPM.tiles.find(
          tile => tile.id === blankPendingMoveTile.id,
        );
        if (blankTile) blankTile.letter = letter;
      }),
    );
  };

  const cancelBlankLetter = (): void => {
    if (!blankPendingMoveTile) return;

    setPendingMove({
      ...pendingMove,
      tiles: pendingMove.tiles.filter(
        tile => tile.id !== blankPendingMoveTile.id,
      ),
    });
  };

  const toggleExchangingTiles = (): void => {
    clearPendingMove();
    setTilesToExchange([]);
    setIsExchangingTiles(!isExchangingTiles);
  };

  const performTileExchange = (): void => {
    if (!isExchangingTiles) return;

    dispatch({
      actionType: GameActionType.EXCHANGE_TILES,
      player: gameState.me,
      tiles: tilesToExchange,
    });
    toggleExchangingTiles();
  };

  const trayContainerStyle: React.CSSProperties = {
    display: "inline-block",
    borderColor: trayBorderColor,
    borderWidth: "4px",
    borderStyle: "solid",
    margin: "4px",
    width: `${(tileWidth + 8) * gameState.rules.traySize}px`,
    borderRadius: "4px",
  };

  const TILES_TO_EXCHANGE_ID = "tiles-to-exchange";
  const tileExchangeOverlay = isExchangingTiles ? (
    <div
      style={{
        position: "absolute",
        top: 0,
        height: boardSizeInPX(cellSize, gameState.rules.height),
        left: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        display: "flex",
        flexFlow: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <div
        style={{
          borderRadius: "4px",
          borderColor: "black",
          padding: "10px",
          margin: "10px",
          backgroundColor: "#aaaa99",
        }}
      >
        <div style={{ margin: "10px", fontWeight: "bold" }}>
          Tiles to exchange:
        </div>
        <div style={trayContainerStyle}>
          <TileSet
            id={TILES_TO_EXCHANGE_ID}
            canDrop={true}
            wrap={false}
            tileDefs={tilesToExchange}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
          />
        </div>
        <div>
          <button
            onClick={performTileExchange}
            data-testid="performExchangeBtn"
          >
            Exchange
          </button>
          <button onClick={toggleExchangingTiles}>Cancel</button>
        </div>
      </div>
    </div>
  ) : null;

  const handleDragEnd = useCallback(
    (result: DropResult): void => {
      if (result.reason === "CANCEL" || !result.destination) return;

      if (result.destination.droppableId === CPT_ID) {
        const pendingMoveTile = pendingMove.tiles.find(
          tile => tile.id === result.draggableId,
        );
        if (pendingMoveTile) {
          setPendingMove({
            ...pendingMove,
            tiles: pendingMove.tiles.filter(
              tile => tile.id !== result.draggableId,
            ),
          });
        }

        const exchangingTile = tilesToExchange.find(
          tile => tile.id === result.draggableId,
        );
        if (exchangingTile) {
          setTilesToExchange(
            tilesToExchange.filter(tile => tile.id !== result.draggableId),
          );
        }

        const cptray = gameState.myTray;
        const trayTileIndex = cptray.findIndex(
          tile => tile.id === result.draggableId,
        );
        if (trayTileIndex >= 0) {
          const newTray = [...cptray];
          // The destination index is given in terms of the visible tiles - need
          // to translate that into an index in the whole tray, including the
          // ones that are shown on the board instead in the pending move
          let newIndex = 0;
          for (
            let i = 0, visibleTileCount = 0;
            visibleTileCount < result.destination.index &&
            newIndex < newTray.length &&
            i < newTray.length;
            ++i
          ) {
            // The currently dragged tile isn't one of the ones to look for
            if (newTray[i].id === result.draggableId) continue;

            if (
              // This is OK - function does not outlive the loop iteration
              // eslint-disable-next-line no-loop-func
              !pendingMove.tiles.find(pmt => pmt.id === newTray[i].id)
            ) {
              ++visibleTileCount;
            }

            ++newIndex;
          }
          newTray.splice(newIndex, 0, newTray.splice(trayTileIndex, 1)[0]);
          dispatch({
            actionType: GameActionType.REORDER_TRAY_TILES,
            player: gameState.me,
            tray: newTray,
          });
        }
      } else if (result.destination.droppableId === TILES_TO_EXCHANGE_ID) {
        const ttxTileIndex = tilesToExchange.findIndex(
          tile => tile.id === result.draggableId,
        );
        const newTTX = [...tilesToExchange];
        if (ttxTileIndex >= 0) {
          newTTX.splice(
            result.destination.index,
            0,
            newTTX.splice(ttxTileIndex, 1)[0],
          );
        } else {
          const cptray = gameState.myTray;
          const trayTile = cptray.find(tile => tile.id === result.draggableId);
          if (trayTile)
            newTTX.splice(result.destination.index, 0, {
              ...trayTile,
              isDraggable: true,
            });
        }
        setTilesToExchange(newTTX);
      } else {
        const [x, y] = squareCoordsFromDroppableId(
          result.destination.droppableId,
        );
        setPendingMove(
          produce(pendingMove, draftPendingMove => {
            const pendingMoveTile = draftPendingMove.tiles.find(
              tile => tile.id === result.draggableId,
            );
            if (pendingMoveTile) {
              pendingMoveTile.x = x;
              pendingMoveTile.y = y;
            } else {
              const trayTile = trayTiles.find(
                tile => tile.id === result.draggableId,
              );
              if (trayTile) draftPendingMove.tiles.push({ x, y, ...trayTile });
            }
          }),
        );
      }
    },
    [
      dispatch,
      gameState.me,
      gameState.myTray,
      pendingMove,
      tilesToExchange,
      trayTiles,
    ],
  );

  const handleKeyDown = (evt: React.KeyboardEvent): void => {
    if (evt.key === "Backspace") {
      evt.preventDefault();
      if (isExchangingTiles) {
        if (!tilesToExchange.length) return;
        const newTTX = [...tilesToExchange];
        newTTX.splice(newTTX.length - 1, 1);
        setTilesToExchange(newTTX);
      } else {
        if (!pendingMove.tiles.length) return;
        const lastTile = pendingMove.tiles[pendingMove.tiles.length - 1];
        setPendingMove({
          ...pendingMove,
          tiles: pendingMove.tiles.slice(0, -1),
        });
        setCursor({ ...cursor, x: lastTile.x, y: lastTile.y });
      }
      return;
    }

    if (evt.key === "Enter") {
      evt.preventDefault();
      if (isExchangingTiles && tilesToExchange.length) performTileExchange();
      else if (legalMove) performPendingMove();
      return;
    }

    if (evt.key === "Escape" && isExchangingTiles) toggleExchangingTiles();

    if (evt.key === "Tab") return;

    if (!(cursor.active || isExchangingTiles)) return;
    evt.stopPropagation();
    evt.preventDefault();

    const tileFromTray = trayTiles.find(
      tile => tile.letter === evt.key.toLowerCase(),
    );
    if (!tileFromTray) return;

    if (isExchangingTiles) {
      setTilesToExchange([
        ...tilesToExchange,
        { ...tileFromTray, isDraggable: true },
      ]);
    } else {
      setPendingMove({
        ...pendingMove,
        tiles: [
          ...pendingMove.tiles,
          { x: cursor.x, y: cursor.y, ...tileFromTray },
        ],
      });
      advanceCursor(1);
    }
  };

  // For testing, we want to be able to simulate drag-and-drop actions.  Not sophisticated enough to do them
  // properly with in-browser testing and such - will trust react-beautiful-dnd to do its thing correctly, and
  // I just want to test my own logic in response to it.  So this is here just to be used inside the test
  // to be able to simulate drags and drops on the rendered game.
  useImperativeHandle(
    ref,
    (): GameRef => ({
      simulateTileDragDrop: (result: DropResult) => {
        handleDragEnd(result);
      },
    }),
    [handleDragEnd], // Work around bug where defaults to [] as deps
  );

  const isMyTurn = gameState.playerToMove === gameState.me;

  const moveButtons = (
    <div
      style={{
        display: "flex",
        flexFlow: "row",
        justifyContent: "stretch",
        flexGrow: 1,
      }}
    >
      <button
        onClick={clearPendingMove}
        disabled={isExchangingTiles || !pendingMove.tiles.length}
      >
        Clear
      </button>
      <button onClick={passTurn} disabled={isExchangingTiles || !isMyTurn}>
        Pass
      </button>
      <button
        onClick={toggleExchangingTiles}
        disabled={isExchangingTiles || !isMyTurn}
      >
        Exchange
      </button>
      <button
        onClick={performPendingMove}
        disabled={isExchangingTiles || !legalMove || !isMyTurn}
        type="button"
        style={{
          flexGrow: 1,
          backgroundColor:
            isExchangingTiles || !legalMove ? undefined : "#88ff88",
        }}
      >
        Go
      </button>
    </div>
  );

  const pendingMoveSummary = scoredPendingMove.words.length ? (
    <div>
      <span
        className={legalMove ? "word" : "non-word"}
        style={{ fontWeight: "bold" }}
      >
        {scoredPendingMove.totalScore}
      </span>
      -
      {scoredPendingMove.words.map((w, idx, a) => {
        const wordCls = gameState.rules.acceptInvalidWords
          ? undefined
          : w.valid
            ? "word"
            : "non-word";
        return (
          <span key={idx} className={wordCls}>
            {w.word} ({w.score}){idx === a.length - 1 ? "" : ","}
          </span>
        );
      })}
      {scoredPendingMove.illegalReasons.length ? " | " : null}
      {scoredPendingMove.illegalReasons.length
        ? scoredPendingMove.illegalReasons.map((ir, idx, a) => (
          <span className="non-word" key={idx}>
            {ir.description}
            {idx === a.length - 1 ? "" : ", "}
          </span>
        ))
        : null}
    </div>
  ) : (
      <div>&nbsp;</div>
    );

  const playerAnnotations = [...gameState.players.entries()].map(([player]) => {
    if (gameState.playerToMove === player)
      return <span className="arrowUi">{"\u2192"}</span>;

    if (
      gameState.playerToMove === GAME_ENDED &&
      !gameState.scores.some(
        (score, idx) => idx !== player && score > gameState.scores[player],
      )
    )
      return (
        <>
          Winner <span className="arrowUi">{"\u2192"}</span>
        </>
      );

    return null;
  });

  const scoreSummary = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3,auto)",
        gridGap: "4px",
      }}
    >
      {[...gameState.players.entries()].map(
        ([player, { name: playerName }]) => (
          <React.Fragment key={player}>
            <div>{playerAnnotations[player]}</div>
            <div style={{ fontWeight: "bold" }}>{playerName}</div>
            <div>
              {gameState.moves.length
                ? gameState.moves
                  .map(move =>
                    move.move.player === player ? move.totalScore : 0,
                  )
                  .reduce((prev, curr) => prev + curr)
                : 0}
            </div>
          </React.Fragment>
        ),
      )}
    </div>
  );

  const modalStyle = {
    overlay: {
      zIndex: 2,
      display: "flex",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.75)",
    },
    content: {
      width: undefined,
      height: undefined,
      top: undefined,
      bottom: undefined,
      right: undefined,
      left: undefined,
      margin: "20px",
    },
  };

  const gameRootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (
      gameRootRef.current &&
      (document.activeElement === document.body ||
        document.activeElement === null)
    )
      gameRootRef.current.focus();
  });

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        ref={gameRootRef}
        onClick={() => setCursor({ ...cursor, active: false })}
        style={{
          display: "flex",
          flexDirection: "column",
          outline: 0,
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "stretch",
          touchAction: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexFlow: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            flexGrow: 0,
            maxWidth: `${boardSizeInPX(cellSize, gameState.rules.width)}px`,
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "scroll",
              touchAction: "manipulation",
              height: "66px",
              backgroundColor: "rgb(221, 221, 204)",
              marginTop: "4px",
              marginLeft: "4px",
            }}
          >
            <MoveList moves={gameState.moves} players={gameState.players} />
          </div>
          <div>
            {topContent || null}
            {failureMessage ? (
              <div className="non-word">{failureMessage}</div>
            ) : null}
          </div>
          {scoreSummary}
        </div>
        {pendingMoveSummary}
        <div
          style={{
            flexShrink: 1,
            flexGrow: 1,
            maxWidth: `${boardSizeInPX(cellSize, gameState.rules.width)}px`,
            maxHeight: `${boardSizeInPX(cellSize, gameState.rules.height)}px`,
            position: "relative",
          }}
        >
          {tileExchangeOverlay}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: isExchangingTiles ? "hidden" : "auto",
            }}
          >
            <Board
              cellWidth={cellSize}
              cellHeight={cellSize}
              width={gameState.rules.width}
              height={gameState.rules.height}
              cellBackground={cellBackground}
              cellTile={getCellTile}
              onCellClick={boardCellClick}
              canCellDrop={canCellDrop}
            />
          </div>
        </div>
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexFlow: "row wrap",
            justifyContent: "stretch",
            maxWidth: `${boardSizeInPX(cellSize, gameState.rules.width)}px`,
          }}
        >
          <div style={{ ...trayContainerStyle, flexGrow: 0 }}>
            <TileSet
              id={CPT_ID}
              data-testid="current-player-tray"
              tileWidth={tileWidth}
              tileHeight={tileHeight}
              tileDefs={trayTiles.map(tdef => ({
                ...tdef,
                isDraggable: !tdef.isPhantom,
              }))}
              canDrop={true}
            />
          </div>
          {moveButtons}
        </div>
      </div>
      <ReactModal
        style={modalStyle}
        isOpen={!!blankPendingMoveTile}
        appElement={gameRootRef.current || undefined}
      >
        <BlankLetterChooser
          tileWidth={tileWidth}
          tileHeight={tileHeight}
          onLetterChosen={chooseBlankLetter}
          onCancel={cancelBlankLetter}
        />
      </ReactModal>
    </DragDropContext>
  );
});
Game.displayName = "Game";

export default Game;
