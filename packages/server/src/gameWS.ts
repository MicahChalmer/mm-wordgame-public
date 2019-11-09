import {
  handleGameAction,
  gameStateVisibleToPlayer,
} from "mm-wordgame-common/src/GameLogic";
import ServerlessDynamoDBClient from "serverless-dynamodb-client";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Handler,
  Context,
  CustomAuthorizerEvent,
  CustomAuthorizerResult,
} from "aws-lambda";
import {
  dynamoDbTableName,
  dbGetGameState,
  dbUpdateGameState,
  postMessageToConnectedPlayers,
  ConnectionData,
  dbDeleteConnection,
} from "./serverUtil";
import prettyFormat from "pretty-format";
import middy from "middy";
import { ApiGatewayManagementApi } from "aws-sdk";
import jose from "node-jose";
import fetch from "node-fetch";

function wsCoveringMiddleware(
  handler: Handler<APIGatewayEvent, APIGatewayProxyResult>,
): middy.Middy<APIGatewayEvent, APIGatewayProxyResult> {
  return middy(handler).onError((handler, next) => {
    const errFmted = prettyFormat(handler.error);
    console.log("Got error:", errFmted);
    handler.response = {
      statusCode: 500,
      body: errFmted,
    };
    return next();
  });
}

function getApigwManagementApi(
  event: APIGatewayEvent,
): ApiGatewayManagementApi {
  return new ApiGatewayManagementApi({
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });
}

export const gameWSConnect = wsCoveringMiddleware(async function gameWSConnect(
  event: APIGatewayEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  if (!event.requestContext.authorizer) throw new Error("No authorizer");
  if (!event.queryStringParameters) throw new Error("No body");
  const userId = event.requestContext.authorizer.userId as string;
  const gameId = event.queryStringParameters.gameId;
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) throw new Error("No connection ID");
  const gameState = await dbGetGameState(gameId);
  if (!gameState.players.find(p => p.playerId === userId))
    throw Error("Can't connect to game you are not a player of");
  const doc = ServerlessDynamoDBClient.doc;
  const TableName = dynamoDbTableName();
  const connItem = {
    pk: `CONN-${connectionId}`,
    sk: `CONN-GAME-${gameId}`,
    ...{ userId, gameId, connectionId },
  };
  await doc
    .put({
      TableName,
      Item: connItem,
    })
    .promise();
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Connected as ${userId} to game ${gameId} (connection ID is ${connectionId}) - stored`,
    }),
  };
});

async function getConnectionData(
  connectionId: string,
): Promise<ConnectionData> {
  const doc = ServerlessDynamoDBClient.doc;
  const TableName = dynamoDbTableName();
  const qresult = await doc
    .query({
      TableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `CONN-${connectionId}` },
    })
    .promise();
  if (qresult.Count === undefined || qresult.Count === 0 || !qresult.Items)
    throw new Error(`Connection with id ${connectionId} not found`);
  if (qresult.Count !== 1)
    throw new Error(
      `More than one connection record for connection with id ${connectionId}`,
    );
  const item = qresult.Items[0];
  return { userId: item.userId, gameId: item.gameId, connectionId };
}

export const gameWSDisconnect = wsCoveringMiddleware(
  async function gameWSDisconnect(
    event: APIGatewayEvent,
    _context: Context,
  ): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    if (connectionId === undefined) throw new Error("No connection ID");
    const { gameId } = await getConnectionData(connectionId);
    await dbDeleteConnection(connectionId, gameId);
    return {
      statusCode: 200,
      body: `Deleted disconnected connection ${connectionId}`,
    };
  },
);

export const gameWSHandleGameAction = wsCoveringMiddleware(
  async function gameWSHandleGameAction(
    event: APIGatewayEvent,
    _context: Context,
  ): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    if (connectionId === undefined) throw new Error("No connection ID");
    if (!event.body) throw new Error("No body");
    const { gameId } = await getConnectionData(connectionId);
    const gameState = await dbGetGameState(gameId, true);
    const message = JSON.parse(event.body);
    const evtResult = handleGameAction(gameState, message.gameAction);

    if (evtResult.illegalReasons.length !== 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Illegal game action not processed`,
          illegalReasons: evtResult.illegalReasons,
        }),
      };
    }

    const latestDate = new Date();
    const updatedGameState = {
      ...evtResult.newState,
      rulesName: gameState.rulesName,
      wordSetName: gameState.wordSetName,
      gameId,
      lastMoveAt: latestDate,
      startedAt: gameState.startedAt,
    };
    await dbUpdateGameState(updatedGameState);

    await postMessageToConnectedPlayers(
      getApigwManagementApi(event),
      updatedGameState,
      playerNumber =>
        JSON.stringify({
          gameState: gameStateVisibleToPlayer(updatedGameState, playerNumber),
          gameMetadata: {
            gameId,
            startedAt: gameState.startedAt,
            lastMoveAt: latestDate,
            rulesName: gameState.rulesName,
            wordSetName: gameState.wordSetName,
          },
        }),
    );

    return { statusCode: 200, body: "Success" };
  },
);

export async function gameWSHandleDefault(): Promise<never> {
  throw Error("Specify an action");
}

export const gameWSHandleRefresh = wsCoveringMiddleware(
  async function gameWSHandleRefresh(
    event: APIGatewayEvent,
    _context: Context,
  ): Promise<APIGatewayProxyResult> {
    const connectionId = event.requestContext.connectionId;
    if (connectionId === undefined) throw new Error("No connection ID");
    if (!event.body) throw new Error("No body");
    const { gameId, userId } = await getConnectionData(connectionId);
    const gameState = await dbGetGameState(gameId);
    const playerNumber = gameState.players.findIndex(
      p => p.playerId === userId,
    );
    if (playerNumber === -1)
      throw new Error("Could not find this user in the game");
    const apigwManagementApi = getApigwManagementApi(event);
    await apigwManagementApi
      .postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          gameState: gameStateVisibleToPlayer(gameState, playerNumber),
          gameMetadata: {
            gameId,
            startedAt: gameState.startedAt,
            lastMoveAt: gameState.lastMoveAt,
            rulesName: gameState.rulesName,
            wordSetName: gameState.wordSetName,
          },
        }),
      })
      .promise();
    return { statusCode: 200, body: "Success" };
  },
);

export async function gameWSAuth(
  event: CustomAuthorizerEvent,
  _context: Context,
): Promise<CustomAuthorizerResult> {
  if (!event.queryStringParameters) throw Error("No query string params");
  const token = event.queryStringParameters.Authorization;

  // Adapted from https://github.com/pianosnake/verify-cognito-token/blob/master/index.js
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION;
  if (!(userPoolId && region))
    throw Error("No user pool or no region in environment");
  const keysURL = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  const publicKeys = (await fetch(keysURL).then(resp => resp.json())).keys;
  const sections = token.split(".");
  const header = JSON.parse(jose.util.base64url.decode(sections[0]));
  const kid: unknown = header.kid;
  const myPublicKey = publicKeys.find((k: { kid: unknown }) => k.kid === kid);
  if (!myPublicKey) throw Error("Public key not found at " + keysURL);
  const joseKey = await jose.JWK.asKey(myPublicKey);
  const verifiedToken = await jose.JWS.createVerify(joseKey).verify(token);
  const claims = JSON.parse(verifiedToken.payload.toString());
  if (!claims.iss.endsWith(userPoolId))
    throw Error("iss claim does not match user pool ID");
  const now = Math.floor(Date.now() / 1000);
  if (now > claims.exp) throw Error("Token is expired");
  console.info(claims);

  return {
    principalId: claims.sub,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: event.methodArn,
        },
      ],
    },
    context: {
      email: claims.email,
      name: claims.name,
      userId: claims.sub,
    },
  };
}
