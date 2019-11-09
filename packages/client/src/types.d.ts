declare module "aws-amplify-react";
declare module "@aws-amplify/ui"; // amplify hack :(

declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_MM_WG_SERVER_ENV:
      | "development"
      | "production"
      | "test"
      | undefined;
  }
}
