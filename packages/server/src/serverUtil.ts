import middy from "middy";
import { cors } from "middy/middlewares";
import prettyFormat from "pretty-format";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
  AuthResponseContext,
} from "aws-lambda";
import { GameState, GameMetadata } from "mm-wordgame-common/src/GameLogic";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import ServerlessDynamoDBClient from "serverless-dynamodb-client";
import { AVAILABLE_RULES } from "mm-wordgame-common/src/AvailableGameRules";
import { S3, ApiGatewayManagementApi, AWSError } from "aws-sdk";
import memoize from "fast-memoize";
import { PromiseResult } from "aws-sdk/lib/request";

export type DatesAsString<T> = {
  [k in keyof T]: T[k] extends Date ? string : T[k];
};
export function datesAsString<T>(t: T): DatesAsString<T> {
  const dt = {} as DatesAsString<T>;
  for (const k in t) {
    const tk = t[k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dt[k] = (tk instanceof Date ? tk.toISOString() : tk) as any;
  }
  return dt;
}

export function coveringMiddleware(
  handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult>,
): middy.Middy<APIGatewayProxyEvent, APIGatewayProxyResult> {
  return middy(handler)
    .onError((handler, next) => {
      const errFmted = prettyFormat(handler.error);
      console.log("Got error:", errFmted);
      handler.response = {
        statusCode: 500,
        body: errFmted,
      };
      return next();
    })
    .use(cors());
}

export interface User {
  userId: string;
  name: string;
  email: string;
}

export function validateUser(
  authorizer: AuthResponseContext,
  userId?: string,
): User {
  if (authorizer.principalId !== "offlineContext_authorizer_principalId") {
    // Typescript types appear to be wrong here
    const claims = (authorizer.claims as unknown) as {
      sub: string;
      name: string;
      email: string;
    };
    if (userId !== undefined && userId != claims.sub)
      throw new Error("User ID does not match signed in user");
    return { userId: claims.sub, name: claims.name, email: claims.email };
  } else
    return {
      userId: userId || "dummy-user-id",
      name: `(Dummy username ${userId})`,
      email: "dummy@example.com",
    };
}

function envOrError(envVar: string, name: string): string {
  const envVal = process.env[envVar];
  if (envVal === undefined)
    throw new Error(`Cannot find ${name} in environment`);
  return envVal;
}

export function dynamoDbTableName(): string {
  return envOrError("DYNAMODB_TABLE", "DynamoDB Table Name");
}

export function wordListsBucketName(): string {
  return envOrError("WORDLISTS_BUCKET", "Word Lists Bucket Name");
}

function lastMoveDescription(game: GameState): string {
  if (game.moves.length == 0) return "No moves yet";
  const lastMove = game.moves[game.moves.length - 1];
  return `${game.players[lastMove.move.player].name}: ${lastMove.move.actionType}`;
}

export async function dbUpdateGameState(
  game: GameState & GameMetadata,
): Promise<void> {
  const doc = ServerlessDynamoDBClient.doc;
  const TableName = dynamoDbTableName();
  const saveableGame = datesAsString(game);
  await doc
    .transactWrite({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: {
              pk: `GAME-${game.gameId}`,
              sk: "STATE",
              ...saveableGame,
            },
          },
        },
        ...game.players.map(player => ({
          Put: {
            TableName,
            Item: {
              pk: `USER-${player.playerId}`,
              sk: `GAME-${game.gameId}`,
              gameId: game.gameId,
              lastMoveAt: saveableGame.lastMoveAt,
              lastMoveDescription: lastMoveDescription(game),
              playerToMove: game.playerToMove,
              players: game.players,
              startedAt: saveableGame.startedAt,
              scores: saveableGame.scores,
            },
          },
        })),
      ],
    })
    .promise();
}

export const getWordListStr = memoize(async function getWordListStr(
  wordSetName: string,
): Promise<string> {
  const s3 = new S3();
  const ws = await s3
    .getObject({
      Bucket: wordListsBucketName(),
      Key: wordSetName,
    })
    .promise();
  if (ws.Body === undefined) throw Error("No body");
  return ws.Body.toString();
});

export async function dbGetGameState(
  gameId: string,
  withWordSet = false,
): Promise<GameState & GameMetadata> {
  const doc = ServerlessDynamoDBClient.doc;
  const TableName = dynamoDbTableName();
  const qres = await doc
    .query({
      TableName,
      KeyConditionExpression: "pk = :pk and sk = :sk",
      ExpressionAttributeValues: { ":pk": `GAME-${gameId}`, ":sk": "STATE" },
    })
    .promise();
  if (qres.Count === 0 || qres.Count === undefined || !qres.Items)
    throw new Error(`Could not find game with ID ${gameId}`);
  else if (qres.Count > 1)
    throw new Error(`Multiple states found for game with ID ${gameId}`);
  const item = qres.Items[0];
  const wordSet = withWordSet
    ? new Set(
        (await getWordListStr(item.wordSetName))
          .split("\n")
          .filter(s => s.length >= 1),
      )
    : new Set<string>();
  return {
    tilesInBag: item.tilesInBag,
    moves: item.moves,
    playerToMove: item.playerToMove,
    players: item.players,
    rules: {
      ...AVAILABLE_RULES[item.rulesName].restoreGameRules(item.rules),
      getWordSet: () => wordSet,
    },
    scores: item.scores,
    trays: item.trays,
    gameId,
    lastMoveAt: new Date(item.lastMoveAt),
    startedAt: new Date(item.startedAt),
    rulesName: item.rulesName,
    wordSetName: item.wordSetName,
  };
}

export interface ConnectionData {
  userId: string;
  gameId: string;
  connectionId: string;
}

export async function dbGetGameConnections(
  gameId: string,
): Promise<ConnectionData[]> {
  const doc = ServerlessDynamoDBClient.doc;
  const TableName = dynamoDbTableName();
  const qresult = await doc
    .query({
      TableName,
      IndexName: "ConnectionsByGame",
      KeyConditionExpression: "gameId = :gameId",
      ExpressionAttributeValues: { ":gameId": gameId },
      ProjectionExpression: "userId,connectionId,gameId",
    })
    .promise();
  if (qresult.Items === undefined) return [];
  return qresult.Items.map(item => ({
    userId: item.userId,
    connectionId: item.connectionId,
    gameId: item.gameId,
  }));
}

export function dbDeleteConnection(
  connectionId: string,
  gameId: string,
): Promise<PromiseResult<DocumentClient.DeleteItemOutput, AWSError>> {
  const doc = ServerlessDynamoDBClient.doc;
  return doc
    .delete({
      TableName: dynamoDbTableName(),
      Key: { pk: `CONN-${connectionId}`, sk: `CONN-GAME-${gameId}` },
    })
    .promise();
}

export async function postMessageToConnectedPlayers(
  apigwManagementApi: ApiGatewayManagementApi,
  gameState: GameState & GameMetadata,
  constructMessage: (
    playerNumber: number,
    connData: ConnectionData,
    gameState: GameState & GameMetadata,
  ) => string,
): Promise<void> {
  await Promise.all(
    (await dbGetGameConnections(gameState.gameId)).map(connData => {
      const playerNumber = gameState.players.findIndex(
        p => p.playerId === connData.userId,
      );
      if (playerNumber === -1) {
        console.log(
          `Found connection id ${connData.connectionId} from user ${
            connData.userId
          } who is not a player in game ${
            gameState.gameId
          } (Players are ${gameState.players
            .map(p => `${p.playerId} (${p.name})`)
            .join(", ")})`,
        );
        return dbDeleteConnection(connData.connectionId, connData.gameId).then(
          () => {},
        );
      }

      console.log(
        `Trying to push update to connection id ${connData.connectionId} (${connData.userId})..`,
      );
      return apigwManagementApi
        .postToConnection({
          ConnectionId: connData.connectionId,
          Data: constructMessage(playerNumber, connData, gameState),
        })
        .promise()
        .then(
          () =>
            console.log(
              `Successfully pushed new state to connection ID ${connData.connectionId} (${connData.userId})`,
            ),
          async postErr => {
            if (postErr.statusCode === 410 || postErr.statusCode == 504) {
              console.log(
                `Tried to post to disconnected connection with id ${connData.connectionId}: `,
                postErr,
              );
              console.log(`Deleting connection id ${connData.connectionId}`);
              await dbDeleteConnection(connData.connectionId, connData.gameId);
              console.log(`Deleted connection id ${connData.connectionId}`);
            } else
              console.log(
                `Error posting to connection with id ${connData.connectionId}: `,
                postErr,
              );
          },
        );
    }),
  );
}
