import url from "url";
import crypto from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({});

const handler = async () => {
  const signedUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: "assets/something"
    }),
    { expiresIn: 60 * 5 }
  );

  console.log({ signedUrl });

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
