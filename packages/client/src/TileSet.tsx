import * as React from "react";
import Tile, { DraggableTileDef, TILE_DRAG_TYPE } from "./Tile";
import { Droppable } from "react-beautiful-dnd";
import { TileDef } from "mm-wordgame-common/src/GameLogic";

interface TileSetProps {
  tileDefs: DraggableTileDef[];
  tileWidth: number;
  tileHeight: number;
  margin?: string;
  "data-testid"?: string;
  id: string;
  canDrop?: boolean;
  wrap?: boolean;
  onTileClick?: (clickedTileDef: TileDef) => void;
}

export default function TileSet(props: TileSetProps): JSX.Element {
  const onTileClick = (td: TileDef): (() => void) | undefined => {
    return props.onTileClick
      ? () => {
          props.onTileClick && props.onTileClick(td);
        }
      : undefined;
  };

  const tileMargin = props.margin || "4px";

  const tiles = props.tileDefs.length ? (
    props.tileDefs.map((td, index) => (
      <Tile
        key={td.id}
        {...td}
        height={props.tileHeight}
        width={props.tileWidth}
        margin={tileMargin}
        index={index}
        onClick={onTileClick(td)}
      />
    ))
  ) : (
    <div style={{ display: "inline-block", opacity: 0 }}>
      <Tile
        key={"fake-tile-for-size"}
        height={props.tileHeight}
        width={props.tileWidth}
        margin={tileMargin}
        index={1}
        id="fake-tile-for-size"
        letter="X"
        pointValue={0}
      />
    </div>
  );
  return (
    <Droppable
      droppableId={props.id}
      isDropDisabled={!props.canDrop}
      direction="horizontal"
      type={TILE_DRAG_TYPE}
    >
      {provided => (
        <div
          data-testid={props["data-testid"]}
          style={{
            display: "flex",
            flexWrap: props.wrap ? "wrap" : undefined,
          }}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {tiles}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
