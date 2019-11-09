import * as React from "react";
import {
  GAME_ENDED,
  Player,
  GameListEntry,
} from "mm-wordgame-common/src/GameLogic";
import { ReactElement } from "react";
import { Link } from "react-router-dom";

export interface GameListProps {
  me: Player;
  games: GameListEntry[];
  isActive: boolean;
}

export function GameList(props: GameListProps): ReactElement {
  const gameRows = props.games.map(gm => {
    const isMyTurn =
      gm.playerToMove !== GAME_ENDED &&
      gm.players[gm.playerToMove].playerId === props.me.playerId;
    const [_winnerScore, winnerIdx] = gm.scores.reduce(
      ([prevScore, prevIdx], currScore, currIdx) =>
        currScore > prevScore ? [currScore, currIdx] : [prevScore, prevIdx],
      [-1, -1],
    );
    const imWinning = gm.players[winnerIdx].playerId === props.me.playerId;
    const cellStyle: React.CSSProperties = {
      backgroundColor: props.isActive
        ? isMyTurn
          ? "#aaaacc"
          : undefined
        : imWinning
        ? "#aacc99"
        : "#ccaa99",
    };
    const players = gm.players.map((p, idx) => {
      return (
        <React.Fragment key={p.playerId}>
          {idx === 0 ? null : ", "}
          {p.name} ({gm.scores[idx]})
        </React.Fragment>
      );
    });
    const playerNameToMove =
      gm.playerToMove === GAME_ENDED
        ? GAME_ENDED
        : gm.players[gm.playerToMove].name;
    return (
      <React.Fragment key={gm.gameId}>
        <div style={{ ...cellStyle }}>
          <Link to={"/game/" + gm.gameId}>
            {gm.playerToMove === GAME_ENDED ? "View" : "Play"}
          </Link>
        </div>
        <div style={{ ...cellStyle }}>{players}</div>
        <div style={{ ...cellStyle }}>{gm.startedAt.toLocaleString()}</div>
        <div style={{ ...cellStyle }}>{gm.lastMoveAt.toLocaleString()}</div>
        <div style={{ ...cellStyle }}>{gm.lastMoveDescription}</div>
        <div style={{ ...cellStyle }}>
          {props.isActive ? playerNameToMove : gm.players[winnerIdx].name}
        </div>
      </React.Fragment>
    );
  });

  const gridHeaderStyle: React.CSSProperties = {
    fontWeight: "bold",
    position: "sticky",
    top: 0,
    backgroundColor: "inherit",
  };

  return (
    <div
      style={{
        display: "inline-grid",
        gridTemplateColumns: "repeat(6,auto)",
        gridGap: "5px",
        width: "100%",
      }}
    >
      <div style={{ ...gridHeaderStyle }}>#</div>
      <div style={{ ...gridHeaderStyle }}>Players</div>
      <div style={{ ...gridHeaderStyle }}>Started At</div>
      <div style={{ ...gridHeaderStyle }}>Last Moved At</div>
      <div style={{ ...gridHeaderStyle }}>Last Move</div>
      <div style={{ ...gridHeaderStyle }}>
        {props.isActive ? "Player To Move" : "Winner"}
      </div>
      {gameRows}
    </div>
  );
}
