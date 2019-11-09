import { coveringMiddleware, validateUser, getWordListStr } from "./serverUtil";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

export const getWordSet = coveringMiddleware(async function getWordSet(
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) throw new Error("No authorizer");
  if (!event.pathParameters) throw new Error("No path parameters");
  const wordSetName = event.pathParameters.wordSetName;
  console.log(wordSetName);
  console.log(`URL decoded: ${decodeURIComponent(wordSetName)}`);
  validateUser(authorizer);
  return {
    statusCode: 200,
    body: await getWordListStr(decodeURIComponent(wordSetName)),
  };
});
