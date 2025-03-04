import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from "aws-cdk-lib/core";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as chime from "cdk-amazon-chime-resources";



export class MediaAppBlog1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const businessAreaCode: number = this.node.tryGetContext('businessAreaCode') as number;

    const personalNumber: string = this.node.tryGetContext('personalNumber') as string;

    const chimePhoneNumber = new chime.ChimePhoneNumber(this, 'chimePhoneNumber', {
      phoneAreaCode: Number(businessAreaCode),
      phoneNumberType: chime.PhoneNumberType.LOCAL,
      phoneProductType: chime.PhoneProductType.SMA,
    });

    const uniqueBucketName = 'pstn-media-apps-' + chimePhoneNumber.node.addr;

    const s3BucketApp  = new s3.Bucket(this, 's3BucketApp', {
      bucketName: uniqueBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL     
    });
    s3BucketApp.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject','s3:PutObject','s3:PutObjectAcl'],
      resources: [s3BucketApp.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('voiceconnector.chime.amazonaws.com')]
    }));

    new s3deploy.BucketDeployment(this, 's3BucketFileUpload', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../files'))],  
      destinationBucket: s3BucketApp,
      contentType: 'audio/wav'
    });

    const roleLambdaOutboundCall = new iam.Role(this, "roleLambdaOutboundCall", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        ["lambdaPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: [
                "chime:CreateSipMediaApplicationCall"
              ],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    const lambdaOutboundCall = new lambda.Function(this, "lambdaOutboundCall", {
      functionName: "place_chime_outbound_call",
      runtime: lambda.Runtime.PYTHON_3_12, 
      handler: "lambda_function.lambda_handler",
      code: lambda.Code.fromAsset('src/lambda_place_chime_outbound_call'),
      role: roleLambdaOutboundCall,
    });

    const roleStepfuntionBusinessProxyWorkflow = new iam.Role(this, "roleStepfuntionBusinessProxyWorkflow", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      inlinePolicies: {
        ["wokflowPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: [
                "sqs:SendMessage",
                "bedrock:InvokeModel",
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "iam:PassRole",
                "scheduler:CreateSchedule",
                "lambda:InvokeFunction"
              ],
            }),
          ],
        }),
      }
    });

    const roleEventBridgeLambdaCall = new iam.Role(this, "roleEventBridgeLambdaCall", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      inlinePolicies: {
        ["eventBridgePolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: [
                "lambda:InvokeFunction"
              ],
            }),
          ],
        }),
      }
    });

    const workflowFilePath = path.join(__dirname, '../src/stepfuntion_business_phone_number_proxy/definition.asl.json');
    let workflowString = fs.readFileSync(workflowFilePath, 'utf8');
    const workflowJSON = JSON.parse(workflowString);
    workflowJSON.States.Init.Assign.BusinessInfo.BusinessPhoneNumber = chimePhoneNumber.phoneNumber;
    workflowJSON.States.Init.Assign.BusinessInfo.OwnerPersonalPhoneNumber = personalNumber;
    workflowJSON.States.Init.Assign.Environment.BuckectName = s3BucketApp.bucketName;
    workflowJSON.States.Init.Assign.Environment.PlaceOutboundCallLambdaArn = lambdaOutboundCall.functionArn;
    workflowJSON.States.Init.Assign.Environment.EventBridgeExecutionRoleForPlaceOutboundCallLambdaArn = roleEventBridgeLambdaCall.roleArn;
    workflowString = JSON.stringify(workflowJSON, null, 2);    
    
    const stepfunctionBusinessProxyWorkflow = new sfn.StateMachine(this, 'stepfunctionBusinessProxyWorkflow', {
      definitionBody: sfn.DefinitionBody.fromString(workflowString),
      stateMachineName: 'business-phone-number-proxy',
      role: roleStepfuntionBusinessProxyWorkflow
    });

    const roleLambdaProcessPSTNAudioServiceCalls = new iam.Role(this, "roleLambdaProcessPSTNAudioServiceCalls", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        ["lambdaPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: [
                "states:StartExecution",
                "states:SendTaskFailure",
                "states:SendTaskSuccess",
                "sqs:GetQueueUrl",
                "sqs:ReceiveMessage",
                "sqs:CreateQueue",
                "sqs:DeleteMessage",
                "sqs:DeleteQueue"
              ],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    const lambdaProcessPSTNAudioServiceCalls = new lambda.Function(this, "lambdaProcessPSTNAudioServiceCalls", {
      functionName: "process_pstn_audio_service_calls",
      runtime: lambda.Runtime.PYTHON_3_12, 
      handler: "lambda_function.lambda_handler",
      code: lambda.Code.fromAsset('src/lambda_process_pstn_audio_service_calls'),
      environment: {
        CallFlowsDIDMap: `[{"DID":"${chimePhoneNumber.phoneNumber}","ARN":"${stepfunctionBusinessProxyWorkflow.stateMachineArn}"}]`
      },
      timeout: Duration.seconds(25),
      role: roleLambdaProcessPSTNAudioServiceCalls,
    });

    const sipMediaApp = new chime.ChimeSipMediaApp(this, 'sipMediaApp', {
      name: "VisualMediaApp",
      region: this.region,
      endpoint: lambdaProcessPSTNAudioServiceCalls.functionArn
    });

    const sipRule = new chime.ChimeSipRule(this, 'sipRule', {
      name: "VisualSipRule",
      triggerType: chime.TriggerType.TO_PHONE_NUMBER,
      triggerValue: chimePhoneNumber.phoneNumber,
      targetApplications: [
        {
          region: this.region,
          priority: 1,
          sipMediaApplicationId: sipMediaApp.sipMediaAppId,
        },
      ],
    });

    const dynamoDBTableBusinessVoicemails  = new dynamodb.Table(this, 'dynamoDBTableBusinessVoicemails', {
      tableName: 'BusinessProxyVoicemails',
      partitionKey: {
        name: 'Tag',
        type: dynamodb.AttributeType.STRING
      }
    });

    

  }
}
