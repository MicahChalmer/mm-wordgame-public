import {
  basicStartingState,
  tilesFromTray,
} from "mm-wordgame-common/src/GameTestUtils";
import {
  gameStateVisibleToPlayer,
  GameActionType,
  newId,
  PlayerVisibleGameState,
  handleGameAction,
} from "mm-wordgame-common/src/GameLogic";
import {
  newLocalAsyncState,
  localAsyncGameStateReducer,
  LocalGameEvent,
  GameActionWithId,
} from "./AsyncGameClientLogic";

const basicStartingLocalAsyncState = newLocalAsyncState(
  gameStateVisibleToPlayer(basicStartingState, 0),
);

it("allows locally reordering the tray", () => {
  const las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.REORDER_TRAY_LOCAL(
      tilesFromTray(
        "lupsepp",
        { x: 0, y: 0 },
        false,
        basicStartingLocalAsyncState.localTray,
      ),
    ),
  );
  expect(las.localTray.map(t => t.letter).join("")).toEqual("lupsepp");
  expect(las.actionsToSend[0].actionType).toEqual(
    GameActionType.REORDER_TRAY_TILES,
  );
});

it("accepts an action and can shows the results speculatively", () => {
  const las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.SEND({
      actionType: GameActionType.PASS,
      id: newId(),
      player: 0,
    }),
  );
  expect(las.gameStateAfterSentAction).toBeDefined();
  const gsas = las.gameStateAfterSentAction as PlayerVisibleGameState;
  expect(gsas.playerToMove).toEqual(1);
});

it("clears the action from the queue when sent", () => {
  let las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.REORDER_TRAY_LOCAL(
      tilesFromTray(
        "lupsepp",
        { x: 0, y: 0 },
        false,
        basicStartingLocalAsyncState.localTray,
      ),
    ),
  );

  las = localAsyncGameStateReducer(
    las,
    LocalGameEvent.SEND({ ...las.actionsToSend[0] }),
  );

  expect(las.actionsToSend).toEqual([]);
});

it("accepts state updates, clearing speculative results", () => {
  const passAction: GameActionWithId = {
    actionType: GameActionType.PASS,
    id: newId(),
    player: 0,
  };
  let las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.SEND(passAction),
  );
  las = localAsyncGameStateReducer(
    las,
    LocalGameEvent.RECEIVE_GAME_STATE(
      gameStateVisibleToPlayer(
        handleGameAction(basicStartingState, passAction).newState,
        0,
      ),
    ),
  );
  expect(las.gameStateAfterSentAction).toBeUndefined();
  expect(las.gameStateAsKnown.playerToMove).toEqual(1);
});

it("ignores state updates that are behind what is already known", () => {
  const las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.RECEIVE_GAME_STATE(
      gameStateVisibleToPlayer(
        handleGameAction(basicStartingState, {
          actionType: GameActionType.PASS,
          player: 0,
        }).newState,
        0,
      ),
    ),
  );

  const outdatedState = gameStateVisibleToPlayer(
    handleGameAction(basicStartingState, {
      actionType: GameActionType.REORDER_TRAY_TILES,
      player: 0,
      tray: tilesFromTray(
        "lupsepp",
        { x: 0, y: 0 },
        false,
        basicStartingLocalAsyncState.localTray,
      ),
    }).newState,
    0,
  );

  expect(
    localAsyncGameStateReducer(
      las,
      LocalGameEvent.RECEIVE_GAME_STATE(outdatedState),
    ),
  ).toEqual(las);
});

it("accepts a state update logically after what's known, equal to the speculative", () => {
  let las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.RECEIVE_GAME_STATE(
      gameStateVisibleToPlayer(
        handleGameAction(basicStartingState, {
          actionType: GameActionType.PASS,
          player: 0,
        }).newState,
        0,
      ),
    ),
  );

  las = localAsyncGameStateReducer(
    basicStartingLocalAsyncState,
    LocalGameEvent.SEND({
      actionType: GameActionType.REORDER_TRAY_TILES,
      id: newId(),
      tray: tilesFromTray(
        "lupsepp",
        { x: 0, y: 0 },
        false,
        basicStartingLocalAsyncState.localTray,
      ),
      player: 0,
    }),
  );

  expect(
    las.gameStateAfterSentAction &&
      las.gameStateAfterSentAction.myTray.map(t => t.letter).join(""),
  ).toEqual("lupsepp");
});
