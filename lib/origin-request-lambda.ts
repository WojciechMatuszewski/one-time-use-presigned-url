import {
  CloudWatchLogsClient,
  PutLogEventsCommand
} from "@aws-sdk/client-cloudwatch-logs";
import { CloudFrontHeaders, CloudFrontRequestHandler } from "aws-lambda";

const client = new CloudWatchLogsClient({ region: "us-east-1" });

const handler: CloudFrontRequestHandler = async event => {
  const { request } = event.Records[0].cf;

  await client.send(
    new PutLogEventsCommand({
      logEvents: [
        {
          message: JSON.stringify({
            msg: "pre modification",
            headers: request.headers
          }),
          timestamp: new Date().getTime()
        }
      ],
      logGroupName: "xxx",
      logStreamName: "logStream",
      sequenceToken: undefined
    })
  );

  const newHeaders = Object.entries(request.headers).reduce((acc, entry) => {
    const [name, value] = entry;
    if (name === "Authorization" || name === "authorization") {
      return acc;
    }

    acc[name] = value;
    return acc;
  }, {} as CloudFrontHeaders);

  return {
    ...request,
    headers: newHeaders
  };
};

export { handler };
