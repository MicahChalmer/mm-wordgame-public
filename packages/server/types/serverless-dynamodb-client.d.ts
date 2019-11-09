/* eslint-disable */

import { DynamoDB } from "aws-sdk";

export = serverless_dynamodb_client;

declare const serverless_dynamodb_client: {
    doc: DynamoDB.DocumentClient,
    raw: DynamoDB
}
