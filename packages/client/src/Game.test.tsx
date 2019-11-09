import * as React from "react";
import Game, { CursorDirection, GameRef } from "./Game";
import {
  render,
  cleanup,
  fireEvent,
  RenderResult,
  act,
} from "@testing-library/react";
import {
  GameState,
  handleGameAction,
  GameActionType,
  gameStateVisibleToPlayer,
  GAME_ENDED,
  GameAction,
  PlayerVisibleGameState,
  startGame,
} from "mm-wordgame-common/src/GameLogic";
import {
  tileDefSet,
  tilesFromTray,
  getTrayOfPlayer,
  basicStartingState,
} from "mm-wordgame-common/src/GameTestUtils";
import { produce } from "immer";
import { useState, useReducer } from "react";

afterEach(cleanup);

it("renders without crashing", () => {
  render(
    <Game
      gameState={gameStateVisibleToPlayer(basicStartingState, 0)}
      dispatch={x => x}
      cellBackground={() => null}
    />,
  );
});

export const LocalGame = React.forwardRef(function LocalGame(
  props: { initialState: GameState; playerLock?: number },
  ref: React.Ref<{}>,
) {
  const [gameState, dispatch] = useReducer(
    (state: GameState, action: GameAction) =>
      handleGameAction(state, action).newState,
    startGame(props.initialState),
  );

  return (
    <Game
      gameState={gameStateVisibleToPlayer(
        gameState,
        props.playerLock === undefined
          ? gameState.playerToMove === GAME_ENDED
            ? gameState.moves[gameState.moves.length - 1].move.player
            : gameState.playerToMove
          : props.playerLock,
      )}
      dispatch={dispatch}
      cellBackground={() => null}
      ref={ref}
    />
  );
});
LocalGame.displayName = "LocalGame";

function getCursor(renderedGame: RenderResult): HTMLElement {
  return renderedGame.getByText(/^(?:\u2191|\u2193|\u2190|\u2192)$/, {
    selector: ".tile *",
  });
}

function noNulls<T>(x: T | null | undefined): T {
  if (x === null || x === undefined)
    throw new Error("null/undef not expected here!");
  return x;
}

function tileElementLetters(tiles: NodeListOf<Element>): string[] {
  return [...tiles].map(tEl =>
    noNulls(noNulls(tEl.querySelector("[data-testid='letter']")).textContent),
  );
}

it("lets you enter the first move by cursor", () => {
  const renderedGame = render(<LocalGame initialState={basicStartingState} />);
  const boardEl = renderedGame.getByTestId("board");

  const playerTray = renderedGame.getByTestId("current-player-tray");
  expect(playerTray.childElementCount).toBeGreaterThan(0);
  let tiles = playerTray.querySelectorAll(".tile");
  expect(tileElementLetters(tiles).join(",")).toEqual("P,U,P,P,L,E,S");

  fireEvent.click(renderedGame.getByTestId("square-7-7"));
  const cursor = getCursor(renderedGame);
  expect(cursor.textContent).toEqual(CursorDirection.RIGHT);
  for (const c of "pups".split("")) fireEvent.keyDown(boardEl, { key: c });
  tiles = playerTray.querySelectorAll(".tile");
  expect(tileElementLetters(tiles).join(",")).toEqual("P,L,E");
  fireEvent.click(boardEl);
  expect(
    tileElementLetters(boardEl.querySelectorAll(".tile")).join(""),
  ).toEqual("PUPS");
});

it("lets you drag a tile from the tray to the board", async () => {
  const gameRef = React.createRef<{}>();
  const renderedGame = render(
    <LocalGame initialState={basicStartingState} ref={gameRef} />,
  );

  const centerCell = renderedGame.getByTestId("square-7-7");

  const grc = (): GameRef => gameRef.current as GameRef;

  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][0].id,
      destination: {
        droppableId: "square-7-7",
        index: 0,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });

  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPPLES");
  expect(
    tileElementLetters(centerCell.querySelectorAll(".tile")).join(""),
  ).toEqual("P");
});

it("lets you reorder the tiles by dragging", async () => {
  const gameRef = React.createRef<{}>();
  render(<LocalGame initialState={basicStartingState} ref={gameRef} />);
  const grc = (): GameRef => gameRef.current as GameRef;

  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][0].id,
      destination: {
        droppableId: "current-player-tray",
        index: 5,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPPLEPS");
});

it("lets you put tiles back in a different spot than you found them", async () => {
  const gameRef = React.createRef<{}>();
  render(<LocalGame initialState={basicStartingState} ref={gameRef} />);
  const grc = (): GameRef => gameRef.current as GameRef;
  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][0].id,
      destination: {
        droppableId: "square-7-7",
        index: 0,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPPLES");

  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][0].id,
      destination: {
        droppableId: "current-player-tray",
        index: 5,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "square-7-7", index: 0 },
    });
  });

  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPPLEPS");
});

it("lets you pick the letter of a blank tile when adding it to the board", () => {
  const renderedGame = render(
    <LocalGame
      initialState={produce(basicStartingState, state => {
        state.trays[0] = tileDefSet("pupple ");
      })}
    />,
  );
  const boardEl = renderedGame.getByTestId("board");
  fireEvent.click(renderedGame.getByTestId("square-7-7"));
  fireEvent.keyDown(boardEl, { key: " " });
  const blankChooserLabel = renderedGame.getByText(
    "Choose the letter for your blank tile:",
  );
  // At this point the blank tile selector should be up
  expect(window.getComputedStyle(blankChooserLabel).display).not.toEqual(
    "none",
  );

  fireEvent.keyDown(blankChooserLabel, { key: "a" });
  const boardTile = noNulls(
    [...noNulls(boardEl.querySelectorAll(".tile"))].find(
      te =>
        noNulls(te.querySelector("[data-testid='letter']")).textContent === "A",
    ),
  );
  expect(
    noNulls(boardTile.querySelector("[data-testid='score']")).textContent,
  ).toEqual("");
});

it("cancels the blank tile placement if asked", () => {
  const renderedGame = render(
    <LocalGame
      initialState={produce(basicStartingState, state => {
        state.trays[0] = tileDefSet("pupple ");
      })}
    />,
  );
  const boardEl = renderedGame.getByTestId("board");
  fireEvent.click(renderedGame.getByTestId("square-7-7"));
  fireEvent.keyDown(boardEl, { key: "p" });
  fireEvent.keyDown(boardEl, { key: " " });
  const blankChooserLabel = renderedGame.getByText(
    "Choose the letter for your blank tile:",
  );
  // At this point the blank tile selector should be up
  expect(window.getComputedStyle(blankChooserLabel).display).not.toEqual(
    "none",
  );

  fireEvent.click(renderedGame.getByText("Cancel"));
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toContain(" ");

  // Get rid of the cursor
  fireEvent.click(boardEl);

  expect(
    tileElementLetters(
      noNulls(document.querySelectorAll("[data-testid='board'] .tile")),
    ),
  ).toEqual(["P"]);
});

it("allows you to exchange tiles by typing", () => {
  const renderedGame = render(<LocalGame initialState={basicStartingState} />);
  fireEvent.click(renderedGame.getByText("Exchange", { exact: true }));
  const tilesToExchangeLabel = renderedGame.getByText("Tiles to exchange:");
  expect(window.getComputedStyle(tilesToExchangeLabel).display).not.toEqual(
    "none",
  );
  fireEvent.keyDown(tilesToExchangeLabel, { key: "p" });
  fireEvent.keyDown(tilesToExchangeLabel, { key: "p" });
  fireEvent.click(renderedGame.getByTestId("performExchangeBtn"));
  fireEvent.click(renderedGame.getByText("Pass", { exact: true }));
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPLES Z");
});

it("allows you to exchange tiles by dragging", async () => {
  const gameRef = React.createRef<{}>();
  const renderedGame = render(
    <LocalGame initialState={basicStartingState} ref={gameRef} />,
  );
  fireEvent.click(renderedGame.getByText("Exchange", { exact: true }));
  const tilesToExchangeLabel = renderedGame.getByText("Tiles to exchange:");
  expect(window.getComputedStyle(tilesToExchangeLabel).display).not.toEqual(
    "none",
  );
  const grc = (): GameRef => gameRef.current as GameRef;

  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][0].id,
      destination: {
        droppableId: "tiles-to-exchange",
        index: 0,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });
  fireEvent.click(renderedGame.getByTestId("performExchangeBtn"));
  fireEvent.click(renderedGame.getByText("Pass", { exact: true }));
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("UPPLES ");
});

it("does not allow submitting moves when it's not your turn", () => {
  const gameRef = React.createRef<{}>();

  const gs = handleGameAction(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0),
    ),
  }).newState;

  const renderedGame = render(
    <LocalGame initialState={gs} ref={gameRef} playerLock={0} />,
  );
  const boardEl = renderedGame.getByTestId("board");
  fireEvent.click(renderedGame.getByTestId("square-10-8"));
  fireEvent.keyDown(boardEl, { key: "e" });
  fireEvent.keyDown(boardEl, { key: "x" });

  expect(
    (renderedGame.getByText("Go") as HTMLButtonElement).disabled,
  ).toBeTruthy();
});

const AdvancingGame = React.forwardRef(function AdvancingGame(
  props: { states: PlayerVisibleGameState[]; player: number },
  ref,
) {
  const [stateIdx, setStateIdx] = useState(0);
  React.useImperativeHandle(ref, () => ({
    nextState: () => {
      setStateIdx((stateIdx + 1) % props.states.length);
    },
  }));

  return (
    <Game
      cellBackground={() => null}
      dispatch={() => {}}
      gameState={props.states[stateIdx]}
    />
  );
});
AdvancingGame.displayName = "AdvancingGame";

it("clears the pending move when it conflicts with new moves", () => {
  const gameRef = React.createRef<{ nextState: () => void }>();

  const gs = handleGameAction(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0),
    ),
  }).newState;

  const renderedGame = render(
    <AdvancingGame
      player={1}
      ref={gameRef}
      states={[basicStartingState, gs].map(s => gameStateVisibleToPlayer(s, 1))}
    />,
  );
  let centerSquare = renderedGame.getByTestId("square-7-7");
  fireEvent.click(centerSquare);
  fireEvent.click(centerSquare);
  fireEvent.keyDown(centerSquare, { key: "k" });
  fireEvent.keyDown(centerSquare, { key: "i" });

  act(() => {
    noNulls(gameRef.current).nextState();
  });

  centerSquare = renderedGame.getByTestId("square-7-7");
  expect(
    tileElementLetters(noNulls(centerSquare.querySelectorAll(".tile"))),
  ).toEqual(["P"]);
  expect(
    renderedGame.getByTestId("square-7-8").querySelector(".tile"),
  ).toBeNull();
});

it("clears the pending move when it involves tiles no longer in the tray", () => {
  const gameRef = React.createRef<{ nextState: () => void }>();

  const gs = handleGameAction(basicStartingState, {
    actionType: GameActionType.PLAY_WORD,
    player: 0,
    tiles: tilesFromTray(
      "pups",
      { x: 7, y: 7 },
      false,
      getTrayOfPlayer(basicStartingState, 0),
    ),
  }).newState;

  const renderedGame = render(
    <AdvancingGame
      player={0}
      ref={gameRef}
      states={[basicStartingState, gs].map(s => gameStateVisibleToPlayer(s, 0))}
    />,
  );
  const entrySquare = renderedGame.getByTestId("square-7-13");
  fireEvent.click(entrySquare);
  fireEvent.keyDown(entrySquare, { key: "l" });
  fireEvent.keyDown(entrySquare, { key: "u" });
  fireEvent.keyDown(entrySquare, { key: "p" });
  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("PPES");
  expect(entrySquare.querySelector(".tile")).not.toBeNull();

  act(() => noNulls(gameRef.current).nextState());

  expect(
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join(""),
  ).toEqual("PLE ZYX");
  expect(entrySquare.querySelector(".tile")).toBeNull();
});

it("lets you drag remaining tiles while a move is pending with ones in the middle", async () => {
  const gameRef = React.createRef<{}>();
  render(<LocalGame initialState={basicStartingState} ref={gameRef} />);
  const grc = (): GameRef => gameRef.current as GameRef;
  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][4].id,
      destination: {
        droppableId: "square-7-7",
        index: 0,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });
  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][5].id,
      destination: {
        droppableId: "square-8-7",
        index: 0,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-player-tray", index: 0 },
    });
  });
  const trayLetters = (): string =>
    tileElementLetters(
      noNulls(
        document.querySelectorAll("[data-testid='current-player-tray'] .tile"),
      ),
    ).join("");
  expect(trayLetters()).toEqual("PUPPS");
  await act(async () => {
    grc().simulateTileDragDrop({
      type: "",
      draggableId: basicStartingState.trays[0][1].id,
      destination: {
        droppableId: "current-player-tray",
        index: 4,
      },
      reason: "DROP",
      mode: "SNAP",
      source: { droppableId: "current-plaer-tray", index: 1 },
    });
  });
  expect(trayLetters()).toEqual("PPPSU");
});
