import S3Client from "aws-sdk/clients/s3";
import url from "url";
import crypto from "crypto";

const client = new S3Client({});

const handler = async () => {
  const signedUrl = client.getSignedUrl("putObject", {
    Bucket: process.env.BUCKET_NAME,
    Key: `assets/something`,
    Expires: 60 * 5
  });

  const { path } = url.parse(signedUrl);
  if (!path) {
    throw new Error("integrity issue");
  }

  const hash = crypto.createHash("sha256").update(path).digest("hex");

  const modifiedUrl = `https://${process.env.CF_DOMAIN}${path}&hash=${hash}`;
  const originalUrl = signedUrl;

  return {
    statusCode: 200,
    body: JSON.stringify({ modifiedUrl, originalUrl })
  };
};

export { handler };
