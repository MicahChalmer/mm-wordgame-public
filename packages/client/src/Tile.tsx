import * as React from "react";
import { TileDef } from "mm-wordgame-common/src/GameLogic";
import {
  Draggable,
  DraggingStyle,
  NotDraggingStyle,
} from "react-beautiful-dnd";

export interface DraggableTileDef extends TileDef {
  isDraggable?: boolean;
}

export interface TileProps extends DraggableTileDef {
  width: number;
  height: number;
  margin?: string;
  index: number;
  onClick?: React.MouseEventHandler<{}>;
}

export const TILE_DRAG_TYPE = "Tile";

function Tile(props: TileProps): JSX.Element {
  return (
    <Draggable
      draggableId={props.id}
      index={props.index}
      isDragDisabled={!props.isDraggable}
      type={TILE_DRAG_TYPE}
    >
      {(provided, snapshot) => {
        const adjustDraggableStyle = (
          dps: DraggingStyle | NotDraggingStyle | undefined,
        ): React.CSSProperties => {
          const result: React.CSSProperties = { ...dps };
          if (snapshot.dropAnimation) {
            result.transitionDuration = "0.125s";
          }
          return result;
        };

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className="tile"
            style={{
              fontFamily: "Gothic A1",
              fontWeight: "bold",
              backgroundColor: "#d2bc7f",
              border: "1px solid black",
              display: "flex",
              width: props.width - 2,
              height: props.height - 2,
              fontSize: `${props.height * 0.75}px`,
              position: "relative",
              alignItems: "center",
              justifyContent: "center",
              color: props.isBlank ? "#880000" : "black",
              flexShrink: 0,
              flexGrow: 0,
              margin: props.margin,
              opacity: props.isPhantom || props.isCursor ? 0.7 : 1,
              userSelect: "none",
              ...adjustDraggableStyle(provided.draggableProps.style),
            }}
            onClick={props.onClick}
          >
            <span data-testid="letter">{props.letter.toUpperCase()}</span>
            <div
              data-testid="score"
              style={{
                position: "absolute",
                fontSize: "25%",
                bottom: "2px",
                right: "2px",
                textAlign: "right",
              }}
            >
              {props.isBlank || props.isCursor ? null : props.pointValue}
            </div>
          </div>
        );
      }}
    </Draggable>
  );
}

export default Tile;
