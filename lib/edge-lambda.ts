import { CloudFrontRequestHandler } from "aws-lambda";
import Dynamo from "aws-sdk/clients/dynamodb";
import qs from "querystring";

/**
 * Important if you are using `ACG` sandbox.
 *
 * By default, the lambda will try to make a request to ddb in the region the lambda is run.
 * In the case of Lambda@Edge that will be the region is closest to you while you make the request
 */
const docClient = new Dynamo.DocumentClient({
  region: "us-east-1"
});

const badRequestResponse = {
  status: "400",
  statusDescription: "BadRequest",
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
  body: "Bad Request"
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

const TABLE_NAME =
  // You will need to populate this value with the table name after you deploy for the first time
  "XXXX";

const handler: CloudFrontRequestHandler = async event => {
  const { request } = event.Records[0].cf;

  const { hash } = qs.parse(request.querystring);
  if (Array.isArray(hash)) {
    return badRequestResponse;
  }

  try {
    const isUsed = await isAlreadyUsed(hash);
    if (isUsed) {
      return forbiddenResponse;
    }

    await saveUsage(hash);
  } catch (e) {
    return {
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
      body: JSON.stringify(e, null, 2)
    };
  }

  return request;
};

async function isAlreadyUsed(hash: string) {
  const { Item } = await docClient
    .get({
      TableName: TABLE_NAME,
      Key: {
        pk: hash
      }
    })
    .promise();

  return Item != undefined;
}

async function saveUsage(hash: string) {
  await docClient
    .put({
      TableName: TABLE_NAME,
      Item: {
        pk: hash
      }
    })
    .promise();
}

export { handler };
