import * as React from "react";
import { ReactElement, useEffect, useState } from "react";
import "./App.css";
import {
  withAuthenticator,
  SignIn,
  ConfirmSignIn,
  RequireNewPassword,
  ForgotPassword,
} from "aws-amplify-react";
import Amplify, { Auth } from "aws-amplify";
import { Route, Switch, RouteComponentProps } from "react-router";
import { CognitoUser } from "@aws-amplify/auth";
import { CognitoUserAttribute } from "amazon-cognito-identity-js";
import { GamePicker } from "./GamePicker";
import { FakeGameShell } from "./FakeGameShell";
import ReactLoading from "react-loading";
import { NewGame } from "./NewGame";
import {
  API_ENDPOINT_CONTEXT,
  API_ROOT_URL,
  WS_API_ROOT_URL,
  AWS_AUTH_CONFIG,
} from "./clientUtil";
import { GameFromServer } from "./GameFromServer";

Amplify.configure({
  Auth: AWS_AUTH_CONFIG,
});

function useUserInfo(
  authData: CognitoUser | undefined,
): { name: string; email: string } {
  const [userData, setUserData] = useState({ name: "", email: "" });
  useEffect((): void => {
    if (!authData) return;
    authData.getUserAttributes(
      (
        _: Error | undefined,
        attrs: CognitoUserAttribute[] | undefined,
      ): void => {
        if (!attrs) return;
        const attrVal = (attrName: string): string => {
          const attr = attrs.find(attr => attr.getName() === attrName);
          return attr ? attr.getValue() : "";
        };
        setUserData({
          name: attrVal("name"),
          email: attrVal("email"),
        });
      },
    );
  }, [authData]);
  return userData;
}

function authWrap<P>(
  app: React.ComponentType<P & { authState: string; authData?: CognitoUser }>,
): React.ComponentType<P> {
  return withAuthenticator(app, false, [
    // This isn't an array rendered in - the components don't need keys
    /* eslint-disable react/jsx-key */
    <SignIn />,
    <ConfirmSignIn />,
    <RequireNewPassword />,
    <ForgotPassword />,
    /* eslint-enable react/jsx-key */
  ]);
}

export default function App(): ReactElement {
  const signOut = (): void => {
    Auth.signOut().catch(e => {
      console.log("Error in sign out: ", e);
    });
  };

  const SignedInAppAuth = authWrap(function SignedInApp(authProps: {
    authState: string;
    authData?: CognitoUser;
  }) {
    const signedInUserInfo = useUserInfo(authProps.authData);
    return (
      <Switch>
        <Route
          path="/game/:gameId"
          render={(routeProps: RouteComponentProps<{ gameId: string }>) => (
            <GameFromServer gameId={routeProps.match.params.gameId} />
          )}
        />
        <Route
          path="/newGame"
          render={() => (
            <>
              {authProps.authData ? (
                <NewGame userId={authProps.authData.getUsername()} />
              ) : (
                <ReactLoading type="balls" />
              )}
            </>
          )}
        />
        <Route
          path="/"
          render={() => (
            <>
              <div>
                Signed in as {signedInUserInfo.name} &lt;
                {signedInUserInfo.email}&gt;:
                <button onClick={signOut}>Sign Out</button>{" "}
              </div>
              {authProps.authData ? (
                <GamePicker userId={authProps.authData.getUsername()} />
              ) : (
                <ReactLoading type="cubes" />
              )}
            </>
          )}
        />
      </Switch>
    );
  });

  return (
    <API_ENDPOINT_CONTEXT.Provider
      value={{ rest: API_ROOT_URL, ws: WS_API_ROOT_URL }}
    >
      <Switch>
        <Route path="/fakeGameShell" render={() => <FakeGameShell />} />
        <Route path="/" render={() => <SignedInAppAuth />} />
      </Switch>
    </API_ENDPOINT_CONTEXT.Provider>
  );
}
