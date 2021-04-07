# One-time presigned urls

## Learnings

- the `behavior` path is forwarded to the destinations

  - if you set `assets/*` as the behavior path and point it to s3, all the request you make to s3, will have that path included

- the `presignedUrl` from s3 does not work as you might expect with OAI from CloudFront

  - OAI adds an `Authorization` header while making requests to s3. That header will interfere with authorization methods
    encapsulated in the presigned url.

  - if you really need OAI on that behavior, make sure you are not forwarding any headers

- **lambda@edge does not support environment variables :o**

- the new _non-legacy_ way of setting cache behaviors in CF is bugged. You **cannot** set the `maxTTL` and `minTTL` to be both 0 seconds.

- you have to make sure the `QueryStrings` are forwarded in the CF cache policy. If they are not, you will be greater with _Access Denied_ error which kinda makes sense

- _CloudFront_ seem to use `S3OriginConfig` to distinguish between what kind of origin is he dealing with. To disable, specify empty string for that property

- When the OAI is specified, there does not seem to be a possibility of removing the Authorization header that _CloudFront_ sends to the origin (S3 in our case).

- Can lambda write to multiple cloudwatch groups by default? OR do I have to use the API directly?
  - _LogGroup_ is tied to the name of the function. Normally, the _LogGroup_ and a given _LogStream_ is created implicitly, by the Lambda Service.
  - If you opt in for directly pushing the logs using the API, you have to create _LogGroup_ and _LogStream_ manually.

## Deployment

- run `npm run cdk bootstrap`

- run `npm run cdk deploy`

- replace the `TABLE_NAME` within the edge lambda with the name of the table that you deployed

- run `npm run deploy`

- _GET_ the endpoint for presigned urls
