import AWS from "aws-sdk";
import dotenv from "dotenv";
import minimist from "minimist";
import { dynamoDbTableName } from "../src/serverUtil";
dotenv.config();

const opts = minimist(process.argv, {
  string: ["endpoint"],
});

AWS.config.update(
  {
    region: "us-east-1",
  },
  true,
);

const mgmtAPI = new AWS.ApiGatewayManagementApi({
  endpoint:
    opts.endpoint ||
    "https://91nggq0kfb.execute-api.us-east-1.amazonaws.com/dev",
});

const TableName = dynamoDbTableName();
const doc = new AWS.DynamoDB.DocumentClient();
(async () => {
  const qres = await doc
    .scan({
      TableName,
      FilterExpression: "begins_with(pk,:pk)",
      ExpressionAttributeValues: { ":pk": "CONN" },
    })
    .promise();

  if (qres.Items === undefined) return;
  const promises: Promise<unknown>[] = [];
  for (const item of qres.Items) {
    console.log(`Trying to post to connection with id ${item.connectionId}`);
    promises.push(
      mgmtAPI
        .postToConnection({
          ConnectionId: item.connectionId,
          Data: JSON.stringify({ message: "janitor" }),
        })
        .promise()
        .then(
          () =>
            console.log(
              `Successfully posted to connection ${item.connectionId}`,
            ),
          async postErr => {
            if (postErr.statusCode === 410 || postErr.statusCode == 504) {
              console.log(
                `Tried to post to disconnected connection with id ${
                  item.connectionId
                }: `,
                postErr,
              );
              console.log(`Deleting connection id ${item.connectionId}`);
              const delResult = await doc
                .delete({
                  TableName,
                  Key: {
                    pk: `CONN-${item.connectionId}`,
                    sk: `CONN-GAME-${item.gameId}`,
                  },
                })
                .promise();
              console.log(
                `Deleted connection id ${item.connectionId}: `,
                delResult,
              );
            } else
              console.log(
                `Error posting to connection with id ${item.connectionId}: `,
                postErr,
              );
          },
        ),
    );
  }
  await Promise.all(promises);
})();
