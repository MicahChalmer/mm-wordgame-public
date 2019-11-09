import {
  PlayerVisibleGameState,
  TileDef,
  GameAction,
  UniqueSeqId,
  IllegalReason,
  GameActionType,
  ReorderTiles,
  newId,
  handleGameEventAsKnownToPlayer,
} from "mm-wordgame-common/src/GameLogic";
import produce from "immer";
import { Union, of } from "ts-union";

export type GameActionWithId = GameAction & { id: UniqueSeqId };

export const LocalGameEvent = Union({
  REORDER_TRAY_LOCAL: of<TileDef[]>(),
  SEND: of<GameActionWithId>(),
  RECEIVE_GAME_STATE: of<PlayerVisibleGameState>(),
  SEND_ACTION_FAILED: of<{
    action: GameActionWithId;
    reason: string;
  }>(),
});

export type LocalGameEvent = typeof LocalGameEvent.T;

interface LocalAsyncGameState {
  gameStateAsKnown: PlayerVisibleGameState;
  gameStateAfterSentAction?: PlayerVisibleGameState;
  localTray: TileDef[];
  actionsToSend: GameActionWithId[];
  lastFailureReason?: string;
}

export function newLocalAsyncState(
  initialState: PlayerVisibleGameState,
): LocalAsyncGameState {
  return {
    gameStateAsKnown: initialState,
    localTray: initialState.myTray,
    actionsToSend: [],
  };
}

function sameTiles(t1: TileDef[], t2: TileDef[]): boolean {
  return t1.length === t2.length && t1.every((t, i) => t.id === t2[i].id);
}

export function localAsyncGameStateReducer(
  state: LocalAsyncGameState,
  event: LocalGameEvent,
): LocalAsyncGameState {
  const illegalReasons: IllegalReason[] = [];
  const newState = produce(state, draft => {
    LocalGameEvent.match(event, {
      REORDER_TRAY_LOCAL: tray => {
        if (!sameTiles(tray, draft.localTray)) {
          draft.localTray = tray;
        }
      },
      SEND: action => {
        draft.actionsToSend = draft.actionsToSend.filter(
          a => a.id !== action.id,
        );
        const result = handleGameEventAsKnownToPlayer(
          draft.gameStateAsKnown,
          action,
        );
        illegalReasons.push(...result.illegalReasons);
        draft.gameStateAfterSentAction = result.newState;
      },
      RECEIVE_GAME_STATE: newState => {
        // Ignore new states coming in that are older in terms of moves
        // than what we have
        if (newState.moves.length < draft.gameStateAsKnown.moves.length) return;
        draft.gameStateAsKnown = newState;
        if (
          draft.gameStateAfterSentAction &&
          newState.moves.length >= draft.gameStateAfterSentAction.moves.length
        )
          draft.gameStateAfterSentAction = undefined;

        draft.lastFailureReason = undefined;
      },
      SEND_ACTION_FAILED: ({ reason }) => {
        // Something failed - we therefore don't think we know the new state
        // more than what we've already got back.
        draft.gameStateAfterSentAction = undefined;
        draft.lastFailureReason = reason;
        draft.localTray = draft.gameStateAsKnown.myTray;
      },
    });

    // Set the local tray preserving order, but ensuring it contains only
    // tiles from the known state
    const stateTray = (draft.gameStateAfterSentAction || draft.gameStateAsKnown)
      .myTray;
    const tilesNotInTray = stateTray.filter(
      std => !draft.localTray.find(ltd => std.id === ltd.id),
    );
    const newLocalTray = [];
    for (const ltd of draft.localTray) {
      if (stateTray.find(std => std.id === ltd.id)) newLocalTray.push(ltd);
      else {
        const std = tilesNotInTray.shift();
        if (std) newLocalTray.push(std);
      }
    }

    draft.localTray = newLocalTray.concat(tilesNotInTray);

    if (
      !draft.gameStateAfterSentAction &&
      !sameTiles(draft.localTray, draft.gameStateAsKnown.myTray)
    ) {
      const pendingReorder = draft.actionsToSend.find(
        a => a.actionType === GameActionType.REORDER_TRAY_TILES,
      );
      if (pendingReorder)
        (pendingReorder as ReorderTiles).tray = draft.localTray;
      else
        draft.actionsToSend.push({
          actionType: GameActionType.REORDER_TRAY_TILES,
          tray: draft.localTray,
          player: draft.gameStateAsKnown.me,
          id: newId(),
        });
    }
  });
  if (illegalReasons.length) {
    return {
      ...state,
      lastFailureReason: `Cannot ${event}: ${illegalReasons
        .map(ir => ir.description)
        .join(", ")}`,
    };
  } else return newState;
}
