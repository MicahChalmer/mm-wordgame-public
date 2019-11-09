import * as React from "react";
import { useLayoutEffect, useRef } from "react";
import TileSet from "./TileSet";
import { TileDef } from "mm-wordgame-common/src/GameLogic";

export default function BlankLetterChooser(props: {
  onLetterChosen: (letter: string) => void;
  onCancel: () => void;
  tileWidth: number;
  tileHeight: number;
}): JSX.Element {
  const handleBlankLetterChoiceKeyDown = (
    event: React.KeyboardEvent<{}>,
  ): void => {
    if (event.key === "Escape") props.onCancel();
    if (/^[a-z]|[A-Z]$/.test(event.key)) props.onLetterChosen(event.key);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.focus();
  });

  return (
    <div
      tabIndex={0}
      onKeyDown={handleBlankLetterChoiceKeyDown}
      ref={rootRef}
      style={{ outline: 0 }}
    >
      <div>Choose the letter for your blank tile:</div>
      <TileSet
        wrap
        id="blank-chooser"
        tileWidth={props.tileWidth}
        tileHeight={props.tileHeight}
        tileDefs={"abcdefghijklmnopqrstuvwxyz"
          .split("")
          .map<TileDef>(letter => ({
            id: "blankchooser-" + letter,
            isBlank: true,
            letter: letter,
            pointValue: 0,
          }))}
        canDrop={false}
        onTileClick={tile => props.onLetterChosen(tile.letter)}
      />
      <button onClick={props.onCancel} type="button">
        Cancel
      </button>
    </div>
  );
}
