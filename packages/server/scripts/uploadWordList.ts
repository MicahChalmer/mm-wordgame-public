import AWS from "aws-sdk";
import minimist from "minimist";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import { wordListsBucketName } from "../src/serverUtil";
dotenv.config();

const opts = minimist(process.argv, {
  string: ["name", "file"],
});

AWS.config.update(
  {
    region: "us-east-1",
  },
  true,
);

const fileContents = readFileSync(opts.file);

if (typeof opts.name !== "string") throw new Error("Need a string for a name");

const s3 = new AWS.S3();
s3.putObject({
  Bucket: wordListsBucketName(),
  Body: fileContents,
  Key: opts.name,
})
  .promise()
  .then(rslt => console.log("success", rslt), reason => console.error(reason));
