# Learnings

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
