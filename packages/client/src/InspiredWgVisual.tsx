import * as React from "react";
import { inspiredWgBonusCellDef } from "mm-wordgame-common/src/InspiredWg";
import { BonusType } from "mm-wordgame-common/src/GameLogic";

export function inspiredWgBonusCellRenderBackground(
  x: number,
  y: number,
): React.ReactNode | null {
  const bonusCellDef = inspiredWgBonusCellDef(x, y);
  if (bonusCellDef) {
    let color: string, text: string;
    switch (bonusCellDef.bonusType) {
      case BonusType.LETTER:
        switch (bonusCellDef.multiplier) {
          case 2:
            color = "#90d7de";
            text = "DOUBLE LETTER SCORE";
            break;
          case 3:
            color = "#00b2c9";
            text = "TRIPLE LETTER SCORE";
            break;
          default:
            throw new Error(
              `Unexpected bonus amount ${bonusCellDef.multiplier}`,
            );
        }
        break;
      case BonusType.WORD:
        switch (bonusCellDef.multiplier) {
          case 2:
            color = "#f1a7a2";
            text = "DOUBLE WORD SCORE";
            break;
          case 3:
            color = "#fd4c40";
            text = "TRIPLE WORD SCORE";
            break;
          default:
            throw new Error(
              `Unexpected bonus amount ${bonusCellDef.multiplier}`,
            );
        }
        break;
      default:
        throw new Error("Invalid bonus type");
    }
    const isStar = x === 7 && y === 7;
    // Special case for the center
    if (isStar) {
      text = "\u2605";
    }
    const contentStyle: React.CSSProperties = {
      backgroundColor: color,
      width: "100%",
      height: "100%",
      fontSize: isStar ? "47px" : "6pt",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontFamily: "Arial",
      fontWeight: "bold",
    };
    return <div style={contentStyle}>{text}</div>;
  }
  return null;
}
