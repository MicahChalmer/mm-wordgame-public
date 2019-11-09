import { Auth } from "aws-amplify";
import * as React from "react";
import memoize from "fast-memoize";

export function fetchFromAPI<T>(
  url: string,
  reqInfo: RequestInit = {},
  raw = false,
): [AbortController, Promise<T>] {
  const abort = new AbortController();
  const promise = (async () => {
    const session = await Auth.currentSession();
    const response = await fetch(url, {
      headers: {
        Authorization: session.getIdToken().getJwtToken(),
      },
      signal: abort.signal,
      ...reqInfo,
    });
    if (response.status != 200)
      throw new Error(
        `Server error ${response.status}: ${await response.text()}`,
      );
    return (await (raw ? response.text() : response.json())) as T;
  })();
  return [abort, promise];
}

export const getWordSet = memoize(async function getWordSet(
  endpoint: string,
  wordSetName: string,
): Promise<Set<string>> {
  const [_abort, wordListPromise] = fetchFromAPI<string>(
    endpoint + "/api/getWordSet/" + encodeURIComponent(wordSetName),
    {},
    true,
  );
  return new Set(
    (await wordListPromise).split("\n").filter(s => s.length >= 1),
  );
});

export const SERVER_ENV =
  process.env.REACT_APP_MM_WG_SERVER_ENV || process.env.NODE_ENV;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const STACK_VARS = require(`../../server/stack-output/${SERVER_ENV}-sls-stack.json`);

export const API_ROOT_URL = STACK_VARS.ServiceEndpoint;
export const WS_API_ROOT_URL = STACK_VARS.ServiceEndpointWebsocket;

export const API_ENDPOINT_CONTEXT = React.createContext({
  rest: API_ROOT_URL,
  ws: WS_API_ROOT_URL,
});

export const AWS_AUTH_CONFIG = {
  region: STACK_VARS.AwsRegion,
  userPoolId: STACK_VARS.CognitoUserPoolId,
  userPoolWebClientId: STACK_VARS.CognitoUserPoolClientId,
};
