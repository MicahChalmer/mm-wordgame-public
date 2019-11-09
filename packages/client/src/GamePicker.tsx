import * as React from "react";
import { ReactElement, useEffect, useContext } from "react";
import { usePromiseToLoad, PromiseToLoadState } from "./PromiseToLoad";
import { GameList } from "./GameList";
import ReactLoading from "react-loading";
import prettyFormat from "pretty-format";
import { Link } from "react-router-dom";
import { fetchFromAPI, API_ENDPOINT_CONTEXT } from "./clientUtil";
import { produce } from "immer";
import {
  GameListEntry,
  Player,
} from "mm-wordgame-common/build_output/src/GameLogic";

interface GameListAPIResult {
  me: Player;
  activeGames: GameListEntry[];
  completedGames: GameListEntry[];
}

export function GamePicker({ userId }: { userId: string }): ReactElement {
  const apiEndpoint = useContext(API_ENDPOINT_CONTEXT).rest;
  const [loadState, loadHandle] = usePromiseToLoad<GameListAPIResult>();
  useEffect(() => {
    const [abort, promise] = fetchFromAPI<GameListAPIResult>(
      `${apiEndpoint}/api/gameList/${userId}`,
    );
    loadHandle.setPromise(
      promise.then(glp =>
        produce(glp, draft => {
          for (const game of [...draft.activeGames, ...draft.completedGames]) {
            game.lastMoveAt = new Date((game.lastMoveAt as unknown) as string);
            game.startedAt = new Date((game.startedAt as unknown) as string);
          }
        }),
      ),
      abort.abort,
    );
  }, [loadHandle, userId, apiEndpoint]);

  const gamesTable = PromiseToLoadState.match(loadState, {
    DONE(data) {
      return (
        <>
          <h3>Active</h3>
          <GameList me={data.me} games={data.activeGames} isActive />
          <hr />
          <h3>Completed</h3>
          <GameList me={data.me} games={data.completedGames} isActive={false} />
        </>
      );
    },
    ERROR(reason) {
      return <div>Error loading game list: {prettyFormat(reason)}</div>;
    },
    WAITING() {
      return <ReactLoading type="cubes" />;
    },
  });
  return (
    <>
      <Link to="/newGame">
        <button>New Game</button>
      </Link>
      <p />
      {gamesTable}
    </>
  );
}
