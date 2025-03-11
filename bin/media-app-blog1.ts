#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MediaAppBlog1Stack } from '../lib/media-app-blog1-stack';
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new MediaAppBlog1Stack(app, 'MediaAppBlog1Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});