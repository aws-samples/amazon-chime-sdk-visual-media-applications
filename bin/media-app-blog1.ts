#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MediaAppBlog1Stack } from '../lib/media-app-blog1-stack';

const app = new cdk.App();
new MediaAppBlog1Stack(app, 'MediaAppBlog1Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});