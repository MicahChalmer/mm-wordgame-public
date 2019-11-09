import {
  inspiredWgNewGame,
  inspiredWgBonusCellDef,
  INSPIRED_WG_RULE_DEFAULTS
} from "./InspiredWg";
import { GameState, Player, GameRules } from "./GameLogic";
export interface NewGameOptions {
  players: Player[];
  getWordSet: () => Set<string>;
  acceptInvalidWords: boolean;
}
export interface AvailableGameType {
  name: string;
  newGame: (ng: NewGameOptions) => GameState;
  restoreGameRules: (pgr: Partial<GameRules>) => GameRules;
}
export const AVAILABLE_RULES: { [index: string]: AvailableGameType } = {
  Original: {
    name: "Original",
    newGame: ({ players, acceptInvalidWords, getWordSet }) =>
      inspiredWgNewGame(players, acceptInvalidWords, getWordSet),
    restoreGameRules(pgr): GameRules {
      return {
        ...INSPIRED_WG_RULE_DEFAULTS,
        ...pgr,
        getCellBonus: inspiredWgBonusCellDef,
        getWordSet: () => new Set()
      };
    }
  }
};
