import {
  Player,
  GAME_ENDED,
  GameListEntry,
} from "mm-wordgame-common/src/GameLogic";
import ServerlessDynamoDBClient from "serverless-dynamodb-client";
import {
  coveringMiddleware,
  validateUser,
  dynamoDbTableName,
} from "./serverUtil";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

function queryResultToGameListEntries(
  queryResult: DocumentClient.QueryOutput,
): GameListEntry[] {
  return queryResult.Items
    ? queryResult.Items.map(row => ({
        gameId: row.gameId,
        lastMoveAt: row.lastMoveAt,
        lastMoveDescription: row.lastMoveDescription,
        playerToMove: row.playerToMove,
        players: row.players,
        startedAt: new Date(row.startedAt),
        scores: row.scores,
        rulesName: row.rulesName,
        wordSetName: row.wordSetName,
      }))
    : [];
}

export const gameList = coveringMiddleware(async function gameList(event) {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) throw new Error("No authorizer");
  if (!event.pathParameters) throw new Error("No path parameters");
  const userId = event.pathParameters.userId;
  const user = validateUser(authorizer, userId);

  const TableName = dynamoDbTableName();

  const doc = ServerlessDynamoDBClient.doc;
  const userPK = `USER-${userId}`;
  const gamesQR = await doc
    .query({
      TableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": userPK },
    })
    .promise();

  const me: Player = {
    playerId: userId,
    name: user.name,
  };
  const games = queryResultToGameListEntries(gamesQR).sort(
    ({ startedAt: a }, { startedAt: b }) => (a < b ? 1 : a > b ? -1 : 0),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      activeGames: games.filter(ge => ge.playerToMove !== GAME_ENDED),
      completedGames: games.filter(ge => ge.playerToMove === GAME_ENDED),
      me,
    }),
  };
});
