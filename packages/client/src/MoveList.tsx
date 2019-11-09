import * as React from "react";
import { ScoredGameMove, Player } from "mm-wordgame-common/src/GameLogic";

export function moveDescription(move: ScoredGameMove): string {
  return move.words.length === 0
    ? `(${move.move.actionType})`
    : move.words.map(w => `${w.word} (${w.score})`).join(", ");
}

export default function MoveList(props: {
  moves: ScoredGameMove[];
  players: Player[];
}): JSX.Element {
  const totalsPerPlayer: number[] = [];
  const moveRows = props.moves
    .map((move, idx) => {
      const runningTotal =
        move.totalScore + (totalsPerPlayer[move.move.player] || 0);
      totalsPerPlayer[move.move.player] = runningTotal;
      return (
        <React.Fragment key={`move-${idx}`}>
          <div>{idx + 1}</div>
          <div>{props.players[move.move.player].name}</div>
          <div>{move.totalScore}</div>
          <div>{runningTotal}</div>
          <div>{moveDescription(move)}</div>
        </React.Fragment>
      );
    })
    .reverse();

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
        gridTemplateColumns: "repeat(4,auto) 1fr",
        gridGap: "5px",
        width: "100%",
      }}
    >
      <div style={{ ...gridHeaderStyle }}>#</div>
      <div style={{ ...gridHeaderStyle }}>Player</div>
      <div style={{ ...gridHeaderStyle }}>Score</div>
      <div style={{ ...gridHeaderStyle }}>Total</div>
      <div style={{ ...gridHeaderStyle }}>Words</div>
      {moveRows}
    </div>
  );
}
