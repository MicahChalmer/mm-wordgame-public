import {
  GameState,
  GameAction,
  GameEventResult,
  gameStateVisibleToPlayer,
  handleGameAction,
  startGame,
} from "mm-wordgame-common/src/GameLogic";
import { GameActionWithId } from "./AsyncGameClientLogic";
import * as React from "react";
import { useRef, useState } from "react";
import {
  AsyncLocalGameImperativeHandle,
  AsyncLocalProgressGame,
} from "./AsyncLocalProgressGame";
import { inspiredWgBonusCellRenderBackground } from "./InspiredWgVisual";
import { Auth } from "aws-amplify";
import { inspiredWgNewGame } from "mm-wordgame-common/src/InspiredWg";

export function LocalFakeAsyncGame(props: {
  gameState: GameState;
  player: number;
  onPerformAction: (action: GameAction) => GameEventResult;
}): JSX.Element {
  const [actionSent, setActionSent] = useState<GameActionWithId | null>(null);
  const asyncGameRef = useRef<AsyncLocalGameImperativeHandle>(null);
  const notify = (): void => {
    if (asyncGameRef.current)
      asyncGameRef.current.receiveGameState(
        gameStateVisibleToPlayer(props.gameState, props.player),
      );
  };

  const sendAction = (action: GameActionWithId): void => {
    setActionSent(action);
  };

  const returnAction = (): void => {
    if (!actionSent) return;
    const result = props.onPerformAction(actionSent);
    setActionSent(null);

    if (asyncGameRef.current)
      asyncGameRef.current.receiveGameState(result.newState);
  };

  const failAction = (): void => {
    if (!actionSent) return;
    setActionSent(null);
  };

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexFlow: "column",
        justifyContent: "stretch",
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <div style={{ flexGrow: 0 }}>
        {actionSent ? `Action sent: ${actionSent.actionType}` : ""}
        <button disabled={!actionSent} onClick={returnAction}>
          Return
        </button>
        <button disabled={!actionSent} onClick={failAction}>
          Fail
        </button>
        <button onClick={notify}>Notify</button>
        <label>
          <input
            type="checkbox"
            onChange={e => setShowDebug(e.target.checked)}
          />
          Show debug
        </label>
      </div>
      <div style={{ position: "relative", flexGrow: 1 }}>
        <AsyncLocalProgressGame
          initialGameState={gameStateVisibleToPlayer(
            props.gameState,
            props.player,
          )}
          sendAction={sendAction}
          cellBackground={inspiredWgBonusCellRenderBackground}
          debug={showDebug}
          ref={asyncGameRef}
        />
      </div>
    </div>
  );
}

function LocalFakeAsyncGameSet(props: {
  initialState: GameState;
}): JSX.Element {
  const [gameState, setGameState] = React.useState(props.initialState);
  const [visiblePlayer, setVisiblePlayer] = useState(0);

  const performAction = (action: GameAction): GameEventResult => {
    const result = handleGameAction(gameState, action);
    setGameState(result.newState);
    return result;
  };

  return (
    <>
      <div style={{ position: "fixed", right: 0, top: 0, zIndex: 2 }}>
        <select
          onChange={event => setVisiblePlayer(parseInt(event.target.value))}
        >
          {gameState.players.map((pn, idx) => (
            <option value={idx} key={idx}>
              {pn.name}
            </option>
          ))}
        </select>
        <button onClick={() => Auth.signOut()}>Log Out</button>
      </div>
      {gameState.players.map((name, idx) => (
        <div
          style={{
            display: idx === visiblePlayer ? "block" : "none",
          }}
          key={idx}
        >
          <LocalFakeAsyncGame
            gameState={gameState}
            key={idx}
            player={idx}
            onPerformAction={performAction}
          />
        </div>
      ))}
    </>
  );
}

export function FakeGameShell(): React.ReactElement {
  const [wordSet, setWordSet] = useState(new Set<string>());

  React.useEffect(() => {
    const wordSetAbort: AbortController = new AbortController();
    fetch("/wordlist.txt", { method: "get", signal: wordSetAbort.signal })
      .then(r => r.text())
      .then(t => {
        if (!wordSetAbort.signal.aborted)
          setWordSet(new Set(t.split("\n").filter(s => s)));
      });
    return () => wordSetAbort.abort();
  }, []);

  const initialState: GameState = React.useMemo(
    () =>
      startGame(
        inspiredWgNewGame(
          [
            { name: "Micah", playerId: "1979-05-10" },
            { name: "Melissa", playerId: "1980-05-08" },
          ],
          false,
          () => wordSet,
        ),
      ),
    [wordSet],
  );

  return (
    <React.Fragment>
      {wordSet.size ? (
        <LocalFakeAsyncGameSet initialState={initialState} />
      ) : null}
    </React.Fragment>
  );
}
