import * as apigw from "@aws-cdk/aws-apigatewayv2";
import * as apigwIntegrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as dynamo from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda-nodejs";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";
import { join } from "path";
import * as logs from "@aws-cdk/aws-logs";

export class OneTimePresignedUrlStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const entriesTable = new dynamo.Table(this, "entriesTable", {
      partitionKey: { name: "pk", type: dynamo.AttributeType.STRING }
    });

    const bucket = new s3.Bucket(this, "assets-bucket", {
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"]
        }
      ]
    });

    const urlLambda = new lambda.NodejsFunction(this, "urlLambda", {
      entry: join(__dirname, "./url-lambda.ts"),
      environment: {
        BUCKET_NAME: bucket.bucketName
      }
    });
    bucket.grantWrite(urlLambda);

    const edgeLambda = new lambda.NodejsFunction(this, "edgeLambda", {
      entry: join(__dirname, "./edge-lambda.ts")
    });
    entriesTable.grantReadWriteData(edgeLambda.latestVersion);

    const debugLogGroup = new logs.LogGroup(this, "debug", {
      retention: logs.RetentionDays.ONE_DAY
    });
    const logStream = new logs.LogStream(this, "debugLogStream", {
      logGroup: debugLogGroup,
      logStreamName: "logStream",
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    const removeAuthorizationLambda = new lambda.NodejsFunction(
      this,
      "removeAuthorizationLambda",
      {
        entry: join(__dirname, "./origin-request-lambda.ts")
      }
    );
    debugLogGroup.grantWrite(removeAuthorizationLambda.latestVersion);

    const api = new apigw.HttpApi(this, "api", {
      corsPreflight: {
        allowCredentials: false,
        allowHeaders: ["*"],
        allowMethods: [
          apigw.HttpMethod.GET,
          apigw.HttpMethod.POST,
          apigw.HttpMethod.OPTIONS
        ],
        allowOrigins: ["*"]
      }
    });
    api.addRoutes({
      integration: new apigwIntegrations.LambdaProxyIntegration({
        handler: urlLambda
      }),
      path: "/api/url",
      methods: [
        apigw.HttpMethod.GET,
        apigw.HttpMethod.POST,
        apigw.HttpMethod.OPTIONS
      ]
    });

    const distribution = new cloudfront.Distribution(this, "distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${api.httpApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`
        ),
        cachePolicy: new cloudfront.CachePolicy(this, "defaultCachePolicy", {
          maxTtl: cdk.Duration.seconds(1),
          minTtl: cdk.Duration.seconds(0),
          defaultTtl: cdk.Duration.seconds(0),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all()
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },

      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2019,
      additionalBehaviors: {
        // This path will be forwarded to s3.
        // So the resulting path is S3PATH/assets/item, NOT S3PATH/item
        "assets/*": {
          origin: new origins.S3Origin(bucket),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, "assetsPolicy", {
            maxTtl: cdk.Duration.seconds(1),
            minTtl: cdk.Duration.seconds(0),
            defaultTtl: cdk.Duration.seconds(0),
            // QueryStrings have to be forwarded, otherwise you will encounter an error with 'Some headers are not signed'
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.denyList(
              "Authorization"
            ),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList("EMPTY")
          }),
          edgeLambdas: [
            {
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion: edgeLambda.currentVersion,
              includeBody: false
            },
            {
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
              functionVersion: removeAuthorizationLambda.currentVersion,
              includeBody: false
            }
          ]
        }
      }
    });

    urlLambda.addEnvironment("CF_DOMAIN", distribution.domainName);

    new cdk.CfnOutput(this, "distributionUrl", {
      value: `https://${distribution.domainName}`
    });

    new cdk.CfnOutput(this, "dynamoTableName", {
      value: entriesTable.tableName
    });

    new cdk.CfnOutput(this, "presignedUrlEndpoint", {
      value: `${distribution.domainName}/api/url`
    });

    new cdk.CfnOutput(this, "logGroupName", {
      value: debugLogGroup.logGroupName
    });
  }
}

/**
 * I had to pull out some of the code from aws-cdk repo to make the setup work
 *
 * The main reasons were
 * - the `s3Origin` does not allow me to specify the domainName of the bucket, the construct will create an origin
 * with the regional domain - this is not something we want. The domain has to match the one used while generating the presigned url,
 * the global one
 *
 * - I could make the domain issue with with custom http origin, but then I cannot specify the `originAccessIdentity` property.
 * One might try to use escape hatches to add the override to the synthesized CFN template.
 */

export class CustomS3Origin implements cloudfront.IOrigin {
  private readonly origin: cloudfront.IOrigin;

  constructor(bucket: s3.IBucket, props: origins.S3OriginProps = {}) {
    this.origin = bucket.isWebsite
      ? new origins.HttpOrigin(bucket.bucketWebsiteDomainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // S3 only supports HTTP for website buckets
          ...props
        })
      : new S3BucketOrigin(bucket, props);
  }

  public bind(
    scope: cdk.Construct,
    options: cloudfront.OriginBindOptions
  ): cloudfront.OriginBindConfig {
    return this.origin.bind(scope, options);
  }
}

class S3BucketOrigin extends cloudfront.OriginBase {
  constructor(
    private readonly bucket: s3.IBucket,
    { originAccessIdentity, ...props }: origins.S3OriginProps
  ) {
    super(bucket.bucketDomainName, props);
  }

  public bind(
    scope: cdk.Construct,
    options: cloudfront.OriginBindOptions
  ): cloudfront.OriginBindConfig {
    return super.bind(scope, options);
  }

  protected renderS3OriginConfig():
    | cloudfront.CfnDistribution.S3OriginConfigProperty
    | undefined {
    return {
      // As per CFN documentation, if we do not want to restrict bucket access, we leave this as empty string
      originAccessIdentity: ``
    };
  }
}
