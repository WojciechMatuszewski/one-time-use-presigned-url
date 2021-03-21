#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { OneTimePresignedUrlStack } from "../lib/one-time-presigned-url-stack";

const app = new cdk.App();
new OneTimePresignedUrlStack(app, "OneTimePresignedUrlStack2");
