import url from "url";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { APIGatewayProxyEventV2 } from "aws-lambda";

const S3 = new S3Client({});

const handler = async (event: APIGatewayProxyEventV2) => {
  if (!event.queryStringParameters) {
    return {
      statusCode: 400,
      body: "Bad request"
    };
  }

  const { key } = event.queryStringParameters;
  if (!key) {
    return {
      statusCode: 400,
      body: "Bad request"
    };
  }

  const signedUrl = await getSignedUrl(
    S3,
    new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }),
    { expiresIn: 60 * 5 }
  );

  const { path } = url.parse(signedUrl);
  if (!path) {
    throw new Error("integrity issue");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ url: `https://${process.env.CF_DOMAIN}${path}` })
  };
};

export { handler };
