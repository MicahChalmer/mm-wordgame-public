/* eslint-disable @typescript-eslint/no-non-null-assertion */
import AWS from "aws-sdk";
import minimist from "minimist";
import { writeFileSync, readFileSync } from "fs";
import YAML from "yaml";
import prettyFormat from "pretty-format";
const opts = minimist(process.argv, {
  string: ["stage"],
  boolean: ["save"],
});

const slsDef = YAML.parse(
  readFileSync(`${__dirname}/../serverless.yml`).toString(),
);
const stage =
  opts.stage || process.env.REACT_APP_MM_WG_SERVER_ENV || "development";

const cf = new AWS.CloudFormation({ region: slsDef.provider.region });
(async () => {
  const stackDesc = await cf
    .describeStacks({
      StackName: `${slsDef.service}-${stage}`,
    })
    .promise();
  const output: { [key: string]: string } = {};
  for (const op of stackDesc.Stacks![0].Outputs || []) {
    output[op.OutputKey!] = op.OutputValue!;
  }
  const outputJSON = JSON.stringify(output, null, 2);
  if (opts.save)
    writeFileSync(
      `${__dirname}/../stack-output/${stage}-sls-stack.json`,
      outputJSON,
    );
  else console.log(output);
})().catch(reason => {
  console.error(prettyFormat(reason));
  process.exit(1);
});
