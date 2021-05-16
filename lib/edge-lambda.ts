import crypto from "crypto";
import { CloudFrontRequestHandler } from "aws-lambda";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

/**
 * By default, the lambda will try to make a request to ddb in the region the lambda is run.
 * In the case of Lambda@Edge that will be the region is closest to you while you make the request.
 *
 * Regions are hardcoded for simplicity sake.
 */
const SSM = new SSMClient({ region: "us-east-1" });
const DDB = new DynamoDBClient({ region: "us-east-1" });

const handler: CloudFrontRequestHandler = async event => {
  // You would most likely cache this call.
  try {
    await populateEnvironmentVariables();
  } catch (e) {
    return internalServerErrorResponse;
  }

  const { request } = event.Records[0].cf;
  const { uri, querystring } = request;

  const uriHash = crypto
    .createHash("md5")
    .update(`${uri}?${querystring}`)
    .digest("hex");

  try {
    const isUsed = await isAlreadyUsed(uriHash);
    if (isUsed) {
      return forbiddenResponse;
    }

    await saveUsage(uriHash);
  } catch (e) {
    return internalServerErrorResponse;
  }

  return request;
};

export { handler };

async function isAlreadyUsed(hash: string) {
  const { Item } = await DDB.send(
    new GetItemCommand({
      TableName: process.env.URL_ENTRIES_TABLE_NAME as string,
      Key: marshall({ pk: hash })
    })
  );

  return Item != undefined;
}

async function saveUsage(hash: string) {
  await DDB.send(
    new PutItemCommand({
      TableName: process.env.URL_ENTRIES_TABLE_NAME as string,
      Item: marshall({
        pk: hash
      })
    })
  );
}

async function populateEnvironmentVariables() {
  const { Parameter } = await SSM.send(
    new GetParameterCommand({ Name: "/URL_ENTRIES_TABLE_NAME" })
  );
  if (!Parameter) {
    throw new Error("No URL_ENTRIES_TABLE_NAME found");
  }

  if (!Parameter.Value) {
    throw new Error("Parameter URL_ENTRIES_TABLE_NAME has no value");
  }

  process.env.URL_ENTRIES_TABLE_NAME = Parameter.Value;
}

const internalServerErrorResponse = {
  status: "500",
  statusDescription: "InternalServerError",
  headers: {
    "content-type": [
      {
        key: "Content-Type",
        value: "text/plain"
      }
    ],
    "content-encoding": [
      {
        key: "Content-Encoding",
        value: "UTF-8"
      }
    ]
  },
  body: "Internal Server Error"
};

const forbiddenResponse = {
  status: "403",
  statusDescription: "Forbidden",
  headers: {
    "content-type": [
      {
        key: "Content-Type",
        value: "text/plain"
      }
    ],
    "content-encoding": [
      {
        key: "Content-Encoding",
        value: "UTF-8"
      }
    ]
  },
  body: "Forbidden"
};
