import {
  coveringMiddleware,
  validateUser,
  wordListsBucketName,
  dbUpdateGameState,
} from "./serverUtil";
import { CognitoIdentityServiceProvider, S3 } from "aws-sdk";
import { Player, startGame } from "mm-wordgame-common/src/GameLogic";
import { AVAILABLE_RULES } from "mm-wordgame-common/src/AvailableGameRules";
import uuid from "uuid/v4";

export const newGameData = coveringMiddleware(async function newGameData(
  event,
  _context,
) {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) throw new Error("No authorizer");
  validateUser(authorizer);

  const cognito = new CognitoIdentityServiceProvider();
  const userPromise = cognito
    .listUsers(
      {
        UserPoolId: `${process.env["COGNITO_USER_POOL_ID"]}` as string,
        AttributesToGet: ["name", "email"],
      },
      undefined,
    )
    .promise()
    .then(users => {
      if (!users.Users) throw new Error("No users list returned");
      const availablePlayers: Player[] = [];
      const getAttr = (
        attributes: CognitoIdentityServiceProvider.AttributeType[],
        attrName: string,
      ): string | undefined => {
        const attr = attributes.find(a => a.Name === attrName);
        return attr ? attr.Value : undefined;
      };
      for (const u of users.Users) {
        if (!(u.Enabled && u.Attributes && u.Username)) continue;
        const name = getAttr(u.Attributes, "name");
        const email = getAttr(u.Attributes, "email");
        if (!name) continue;
        availablePlayers.push({
          playerId: u.Username,
          name,
          email,
        });
      }
      return availablePlayers;
    });

  const wlistPromise = new S3()
    .listObjectsV2({
      Bucket: wordListsBucketName(),
    })
    .promise()
    .then(olist =>
      olist.Contents
        ? olist.Contents.filter(o => o.Key !== undefined).map(
            o => o.Key as string,
          )
        : [],
    );

  const [availablePlayers, availableWordSetNames] = await Promise.all([
    userPromise,
    wlistPromise,
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({ availablePlayers, availableWordSetNames }),
  };
});

export const newGame = coveringMiddleware(async function newGame(
  event,
  _context,
) {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) throw new Error("No authorizer");
  validateUser(authorizer);

  if (event.body === null) throw new Error("Must pass game params in body");
  const bodyObj = JSON.parse(event.body);
  // TODO validate!
  const { wordSetName, players, rulesName, acceptInvalidWords } = bodyObj as {
    wordSetName: string;
    players: Player[];
    rulesName: string;
    acceptInvalidWords?: boolean;
  };

  const gameRules = AVAILABLE_RULES[rulesName];
  if (gameRules === undefined)
    throw new Error(`Cannot find game rules called "${rulesName}"`);

  await new S3()
    .headObject({
      Bucket: wordListsBucketName(),
      Key: bodyObj.wordSetName,
    })
    .promise()
    .catch(reason =>
      Promise.reject(
        new Error(`Can't find word list named "${wordSetName}": ${reason}`),
      ),
    );

  const game = startGame(
    gameRules.newGame({
      acceptInvalidWords: !!acceptInvalidWords,
      players,
      getWordSet: () => new Set(), // Don't need the actual word set now
    }),
  );
  const gameId = uuid();
  const startDate = new Date();
  await dbUpdateGameState({
    ...game,
    gameId,
    startedAt: startDate,
    lastMoveAt: startDate,
    wordSetName,
    rulesName,
  });
  return {
    statusCode: 200,
    body: JSON.stringify({ gameId }),
  };
});
