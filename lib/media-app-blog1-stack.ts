import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from "aws-cdk-lib/core";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from "aws-cdk-lib/aws-iam";
import * as chime from "cdk-amazon-chime-resources";


export class MediaAppBlog1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const phoneNumber = this.node.tryGetContext('phoneNumber');

    const roleStepfuntionMultiLanguageMediaApp = new iam.Role(this, "roleStepfuntionMultiLanguageMediaApp", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      inlinePolicies: {
        ["sqsPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: [
                "sqs:SendMessage",
              ],
            }),
          ],
        }),
      }
    });

    const stepfuntionMultiLanguageMediaApp = new sfn.StateMachine(this, 'stepfuntionMultiLanguageMediaApp', {
      definitionBody: sfn.DefinitionBody.fromFile('src/stepfuntion_multi_language_media_app/definition.asl.json'),
      stateMachineName: 'multi_language_media_app',
      role: roleStepfuntionMultiLanguageMediaApp
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
        CallFlowsDIDMap: `[{"DID":"${phoneNumber}","ARN":"${stepfuntionMultiLanguageMediaApp.stateMachineArn}"}]`
      },
      timeout: Duration.seconds(25),
      role: roleLambdaProcessPSTNAudioServiceCalls,
    });

    const sipMediaApp = new chime.ChimeSipMediaApp(this, 'sipMediaApp', {
      name: "VisualMediaApp",
      region: this.region,
      endpoint: lambdaProcessPSTNAudioServiceCalls.functionArn
    });

    //create the sip rule if the phone number was provided by user
    if (phoneNumber != "+1NPANXXXXXX") {
      const sipRule = new chime.ChimeSipRule(this, 'sipRule', {
        name: "VisualSipRule",
        triggerType: chime.TriggerType.TO_PHONE_NUMBER,
        triggerValue: phoneNumber,
        targetApplications: [
          {
            region: this.region,
            priority: 1,
            sipMediaApplicationId: sipMediaApp.sipMediaAppId,
          },
        ],
      });
    }

  }
}
