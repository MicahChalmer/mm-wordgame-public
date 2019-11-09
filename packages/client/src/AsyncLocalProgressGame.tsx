import React, {
  useEffect,
  useReducer,
  useImperativeHandle,
  useCallback,
  ReactElement,
} from "react";
import {
  PlayerVisibleGameState,
  GameAction,
  GameActionType,
  newId,
} from "mm-wordgame-common/src/GameLogic";
import { CellBackgroundFn } from "./Board";
import Game from "./Game";
import {
  newLocalAsyncState,
  localAsyncGameStateReducer,
  GameActionWithId,
  LocalGameEvent,
} from "./AsyncGameClientLogic";

export interface AsyncLocalProgressGameProps {
  initialGameState: PlayerVisibleGameState;
  cellBackground: CellBackgroundFn;
  sendAction: (action: GameActionWithId) => void;
  debug?: boolean;
  furtherDebugInfo?: () => React.ReactNode;
  topContent?: ReactElement;
}

export interface AsyncLocalGameImperativeHandle {
  receiveGameState: (state: Partial<PlayerVisibleGameState>) => void;
}

export const AsyncLocalProgressGame = React.forwardRef(
  function AsyncLocalProgressGame(props: AsyncLocalProgressGameProps, ref) {
    const [localState, localDispatch] = useReducer(
      localAsyncGameStateReducer,
      newLocalAsyncState(props.initialGameState),
    );

    const sendActionCb = props.sendAction;

    // Don't call this from render - only from effects/handlers
    const doSendAction = useCallback(
      (action: GameAction | GameActionWithId): void => {
        const actionWithId: GameActionWithId = {
          ...action,
          id: "id" in action ? action.id : newId(`action-${action.player}`),
        };

        localDispatch(LocalGameEvent.SEND(actionWithId));

        sendActionCb(actionWithId);
      },
      [sendActionCb],
    );

    const handleGameAction = (action: GameAction): void => {
      if (action.actionType === GameActionType.REORDER_TRAY_TILES)
        localDispatch(LocalGameEvent.REORDER_TRAY_LOCAL(action.tray));
      else doSendAction(action);
    };

    useImperativeHandle(ref, () => ({
      receiveGameState(state: Partial<PlayerVisibleGameState>) {
        localDispatch(
          LocalGameEvent.RECEIVE_GAME_STATE({
            ...localState.gameStateAsKnown,
            ...state,
          }),
        );
      },
    }));

    useEffect(() => {
      if (
        localState.actionsToSend.length &&
        !localState.gameStateAfterSentAction
      )
        doSendAction(localState.actionsToSend[0]);
    }, [localState, doSendAction]);

    return (
      <>
        {props.debug ? (
          <div
            style={{
              position: "fixed",
              width: "auto",
              height: "auto",
              right: "10px",
              bottom: "10px",
            }}
          >
            Pending actions:{" "}
            {localState.actionsToSend.map(a => a.actionType).join(", ")}. Target
            Local tray: {localState.localTray.map(t => t.letter).join("")}; Has
            state after sent:{" "}
            {localState.gameStateAfterSentAction ? "Yes" : "No"}
            {props.furtherDebugInfo ? props.furtherDebugInfo() : null}
          </div>
        ) : null}
        <Game
          gameState={{
            ...(localState.gameStateAfterSentAction ||
              localState.gameStateAsKnown),
            myTray: localState.localTray,
          }}
          dispatch={handleGameAction}
          cellBackground={props.cellBackground}
          failureMessage={localState.lastFailureReason}
          topContent={props.topContent}
        />
      </>
    );
  },
);
AsyncLocalProgressGame.displayName = "AsyncLocalProgressGame";
