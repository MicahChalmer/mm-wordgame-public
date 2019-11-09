import * as React from "react";
import {
  useContext,
  useEffect,
  ReactElement,
  useRef,
  useCallback,
  useState,
} from "react";
import {
  PlayerVisibleGameState,
  GameMetadata,
} from "mm-wordgame-common/src/GameLogic";
import { API_ENDPOINT_CONTEXT, getWordSet } from "./clientUtil";
import { Union, of } from "ts-union";
import {
  AsyncLocalProgressGame,
  AsyncLocalGameImperativeHandle,
} from "./AsyncLocalProgressGame";
import { inspiredWgBonusCellRenderBackground } from "./InspiredWgVisual";
import ReactLoading from "react-loading";
import { GameActionWithId } from "./AsyncGameClientLogic";
import { CognitoUserSession } from "amazon-cognito-identity-js";
import { Auth } from "aws-amplify";
import { AVAILABLE_RULES } from "mm-wordgame-common/src/AvailableGameRules";
import { Link } from "react-router-dom";

const WSState = Union({
  Start: of(null),
  Opening: of<{ connAttempts: number }>(),
  Open: of(null),
  Closed: of<{ connAttempts: number }>(),
  RetryWaiting: of<{ connAttempts: number; retryTimeoutID: number }>(),
});
type WSState = typeof WSState.T;

const WSAction = Union({
  WSOpening: of(null),
  WSOpen: of(null),
  WSClose: of(null),
  RetryWait: of<{ retryTimeoutID: number }>(),
});
type WSAction = typeof WSAction.T;

export function GameFromServer({ gameId }: { gameId: string }): ReactElement {
  const endpoints = useContext(API_ENDPOINT_CONTEXT);
  const wsRef = useRef<WebSocket>();
  const [gameState, setGameState] = useState<
    PlayerVisibleGameState | undefined
  >();
  const nextConnAttempt = (s: WSState): number =>
    WSState.match(s, {
      RetryWaiting: ({ connAttempts }) => connAttempts + 1,
      Opening: ({ connAttempts }) => connAttempts + 1,
      default: () => 1,
    });
  const [wsState, dispatch] = React.useReducer(
    (s: WSState, action: WSAction): WSState => {
      return WSAction.match(action, {
        WSOpening: () =>
          WSState.Opening({
            connAttempts: nextConnAttempt(s),
          }),
        WSOpen: () => WSState.Open,
        WSClose: () => WSState.Closed({ connAttempts: nextConnAttempt(s) }),
        RetryWait: ({ retryTimeoutID }) =>
          WSState.RetryWaiting({
            retryTimeoutID,
            connAttempts: nextConnAttempt(s),
          }),
      });
    },
    WSState.Start,
  );

  const alpgRef = useRef<AsyncLocalGameImperativeHandle>(null);
  const setupWebSocket = useCallback(
    function setupWebSocket(session: CognitoUserSession): void {
      const url =
        endpoints.ws +
        "?Authorization=" +
        encodeURIComponent(session.getIdToken().getJwtToken()) +
        "&gameId=" +
        encodeURIComponent(gameId);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (ws === wsRef.current) {
          dispatch(WSAction.WSOpen);
          ws.send(JSON.stringify({ action: "refresh" }));
        }
      };
      ws.onclose = () => {
        if (ws === wsRef.current) {
          wsRef.current = undefined;
          dispatch(WSAction.WSClose);
        }
      };
      ws.onmessage = async evt => {
        if (ws === wsRef.current) {
          const msg:
            | {
                gameState: PlayerVisibleGameState;
                gameMetadata: GameMetadata;
              }
            | { message: string } = JSON.parse(evt.data);
          if ("message" in msg) {
            console.log("Server error message: ", msg.message);
            return;
          }
          msg.gameState.rules = AVAILABLE_RULES[
            msg.gameMetadata.rulesName
          ].restoreGameRules(msg.gameState.rules);
          const wordSet = await getWordSet(
            endpoints.rest,
            msg.gameMetadata.wordSetName,
          );
          msg.gameState.rules.getWordSet = () => wordSet;
          setGameState(msg.gameState);
          if (alpgRef.current) alpgRef.current.receiveGameState(msg.gameState);
        }
      };
      dispatch(WSAction.WSOpening);
    },
    [endpoints.rest, endpoints.ws, gameId],
  );

  useEffect(() => {
    WSState.match(wsState, {
      Start: () => {
        Auth.currentSession().then(setupWebSocket);
      },
      Closed: ({ connAttempts }) => {
        const reconnectInterval =
          Math.min(30, Math.pow(2, connAttempts) - 1) * 1000;
        const retryTimeoutID = setTimeout(
          (() => Auth.currentSession().then(setupWebSocket)) as TimerHandler,
          reconnectInterval,
        );
        dispatch(WSAction.RetryWait({ retryTimeoutID }));
      },
      default: () => {},
    });

    return () => {
      WSState.match(wsState, {
        Open: () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
            wsRef.current = undefined;
          }
        },
        RetryWaiting: ({ retryTimeoutID }) => clearTimeout(retryTimeoutID),
        default: () => {},
      });
    };
  }, [setupWebSocket, wsState]);

  const sendAction = useCallback(
    (gameAction: GameActionWithId): void => {
      WSState.if.Open(wsState, () => {
        if (wsRef.current)
          wsRef.current.send(
            JSON.stringify({ action: "gameAction", gameId, gameAction }),
          );
      });
    },
    [gameId, wsState],
  );

  if (gameState)
    return (
      <>
        <AsyncLocalProgressGame
          cellBackground={inspiredWgBonusCellRenderBackground} // TODO switchable?
          initialGameState={gameState}
          sendAction={sendAction}
          ref={alpgRef}
          furtherDebugInfo={() =>
            `WS state: ${wsState}; ${nextConnAttempt(wsState) -
              1} connection attempts`
          }
          topContent={
            <>
              <p>
                Playing as <b>{gameState.players[gameState.me].name}</b>
              </p>
              <Link to="/">Home</Link>
            </>
          }
        />
      </>
    );
  else
    return (
      <>
        <ReactLoading type="bars" />
      </>
    );
}
