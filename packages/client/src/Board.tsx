import * as React from "react";
import Tile, { DraggableTileDef, TILE_DRAG_TYPE } from "./Tile";
import { Droppable } from "react-beautiful-dnd";

export interface CellBackgroundFn {
  (x: number, y: number): React.ReactNode | null;
}

declare type OnCellClick = (
  event: React.MouseEvent,
  x: number,
  y: number,
) => void;

declare type CanCellDrop = (x: number, y: number) => boolean;

interface BoardProps {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  cellBackground: CellBackgroundFn;
  cellTile: (x: number, y: number) => DraggableTileDef | null;
  onCellClick?: OnCellClick;
  canCellDrop?: CanCellDrop;
}

interface BoardSquareProps {
  x: number;
  y: number;
  boardProps: BoardProps;
  canDropTile: boolean;
  "data-testid": string;
  tile?: DraggableTileDef;
  background?: React.ReactNode;
}

const borderType = "1px solid white";

export function squareCoordsFromDroppableId(
  dropableId: string,
): [number, number] {
  const [, x, y] = dropableId.split("-");
  return [parseInt(x), parseInt(y)];
}

const tilePadding = 4;
export function boardInnerTileSize(
  cellWidth: number,
  cellHeight: number,
): [number, number] {
  return [cellWidth - tilePadding * 2 - 2, cellHeight - tilePadding * 2 - 2];
}

export function boardSizeInPX(cellSize: number, cellCount: number): number {
  return cellSize * cellCount + 12;
}

function BoardSquare(props: BoardSquareProps): JSX.Element {
  const [tileWidth, tileHeight] = boardInnerTileSize(
    props.boardProps.cellWidth,
    props.boardProps.cellHeight,
  );
  return (
    <Droppable
      droppableId={`square-${props.x}-${props.y}`}
      direction="horizontal"
      isDropDisabled={!props.canDropTile}
      type={TILE_DRAG_TYPE}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          data-testid={props["data-testid"]}
          onClick={evt => {
            if (props.boardProps.onCellClick)
              props.boardProps.onCellClick(evt, props.x, props.y);
          }}
          style={{
            border: borderType,
            backgroundColor: "#ddddcc",
            position: "relative",
          }}
        >
          {props.tile && (
            <div
              style={{
                display: "inline-block",
                zIndex: 1,
                position: "absolute",
              }}
            >
              <Tile
                width={tileWidth}
                height={tileHeight}
                {...props.tile}
                index={0}
                margin={`${tilePadding}px`}
              />
            </div>
          )}
          {provided.placeholder}
          {props.background && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: "100%",
              }}
            >
              {props.background}
            </div>
          )}
          {snapshot.isDraggingOver ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: "100%",
                zIndex: 2,
                opacity: 0.5,
                backgroundColor: props.canDropTile ? "#ff00ff" : "#444444",
              }}
            />
          ) : null}
        </div>
      )}
    </Droppable>
  );
}

export default function Board(props: BoardProps): JSX.Element {
  const squares = [...Array(props.height).keys()].map(y =>
    [...Array(props.width).keys()].map(x => {
      const squareId = `square-${x}-${y}`;
      const tile = props.cellTile(x, y);
      return (
        <BoardSquare
          canDropTile={!!props.canCellDrop && props.canCellDrop(x, y)}
          key={squareId}
          data-testid={squareId}
          x={x}
          y={y}
          boardProps={props}
          tile={tile || undefined}
          background={props.cellBackground(x, y)}
        />
      );
    }),
  );
  return (
    <div
      style={{ display: "inline-block", userSelect: "none" }}
      data-testid="board"
    >
      <div style={{ border: "2px solid white", display: "inline-block" }}>
        <div style={{ border: "2px solid black", display: "inline-block" }}>
          <div style={{ border: "1px solid white", display: "inline-block" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${props.width},${
                  props.cellWidth
                }px)`,
                gridTemplateRows: `repeat(${props.height},${
                  props.cellHeight
                }px)`,
                border: borderType,
              }}
            >
              {squares}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
