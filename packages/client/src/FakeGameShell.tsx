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
import { useRef, useState, useEffect, useCallback } from "react";
import {
  AsyncLocalGameImperativeHandle,
  AsyncLocalProgressGame,
} from "./AsyncLocalProgressGame";
import { inspiredWgBonusCellRenderBackground } from "./InspiredWgVisual";
import { inspiredWgNewGame } from "mm-wordgame-common/src/InspiredWg";

export function LocalFakeAsyncGame(props: {
  gameState: GameState;
  player: number;
  onPerformAction: (action: GameAction) => GameEventResult;
}): JSX.Element {
  const [actionSent, setActionSent] = useState<GameActionWithId | null>(null);
  const asyncGameRef = useRef<AsyncLocalGameImperativeHandle>(null);
  const notify = useCallback((): void => {
    if (asyncGameRef.current)
      asyncGameRef.current.receiveGameState(
        gameStateVisibleToPlayer(props.gameState, props.player),
      );
  }, [props.gameState, props.player]);

  const [debugAsyncScenarios, setDebugAsyncScenarios] = useState(false);
  const sendAction = (action: GameActionWithId): void => {
    if (debugAsyncScenarios) setActionSent(action);
    else {
      const result = props.onPerformAction(action);
      setActionSent(null);
      if (asyncGameRef.current)
        asyncGameRef.current.receiveGameState(
          gameStateVisibleToPlayer(result.newState, props.player),
        );
    }
  };

  const returnAction = useCallback((): void => {
    if (!actionSent) return;
    const result = props.onPerformAction(actionSent);
    setActionSent(null);

    if (asyncGameRef.current)
      asyncGameRef.current.receiveGameState(result.newState);
  }, [actionSent, props]);

  const failAction = (): void => {
    if (!actionSent) return;
    setActionSent(null);
  };

  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (!debugAsyncScenarios && actionSent) returnAction();
  }, [debugAsyncScenarios, actionSent, returnAction]);

  useEffect(() => {
    if (!debugAsyncScenarios) notify();
  }, [notify, debugAsyncScenarios]);

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
        <label>
          <input
            type="checkbox"
            onChange={e => setShowDebug(e.target.checked)}
          />
          Show debug
        </label>
        {showDebug ? (
          <>
            <label>
              <input
                type="checkbox"
                onChange={e => setDebugAsyncScenarios(e.target.checked)}
              />
              Debug Async Scnearios
            </label>
            {debugAsyncScenarios ? (
              <>
                {actionSent ? `Action sent: ${actionSent.actionType}` : ""}
                <button disabled={!actionSent} onClick={returnAction}>
                  Return
                </button>
                <button disabled={!actionSent} onClick={failAction}>
                  Fail
                </button>
                <button onClick={notify}>Notify</button>
              </>
            ) : null}
          </>
        ) : null}
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
  children?: React.ReactNode;
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
        {props.children}
        Show view as player:
        <select
          onChange={event => setVisiblePlayer(parseInt(event.target.value))}
        >
          {gameState.players.map((pn, idx) => (
            <option value={idx} key={idx}>
              {pn.name}
            </option>
          ))}
        </select>
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
  const [wordlistError, setWordlistError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readWordList = useCallback(() => {
    setWordlistError("");
    if (
      !fileInputRef.current ||
      !fileInputRef.current.files ||
      !fileInputRef.current.files.length
    ) {
      setWordlistError("Need to choose a word list file");
      return;
    }
    const file = fileInputRef.current.files[0];
    if (!file) {
      setWordlistError("No file");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const s = ev.target ? ev.target.result : null;
      if (s)
        setWordSet(
          new Set(
            s
              .toString()
              .toLowerCase()
              .split("\n")
              .filter(s => s),
          ),
        );
      else setWordlistError("No word list found in file " + file.name);
    };
    reader.readAsText(file);
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
    <>
      {wordSet.size ? (
        <LocalFakeAsyncGameSet initialState={initialState}>
          <button
            onClick={() => {
              setWordSet(new Set());
            }}
          >
            Abort
          </button>
        </LocalFakeAsyncGameSet>
      ) : (
        <>
          <p>
            So, to play the game you need a word list. I&apos;m not publishing
            the word list - try{" "}
            <a href="https://www.google.com/search?q=sowpods+txt+file ">
              googling around for one
            </a>
            . When you have a URL for a word list (one word per line) put it
            here to start the game. This version only plays locally in the
            browser - no back end at all.
          </p>
          <label>
            Word list URL: <input type="file" ref={fileInputRef} />
          </label>
          <button onClick={readWordList}>Get Word List and Start Game</button>
          <div className="non-word">{wordlistError}</div>
        </>
      )}
    </>
  );
}
