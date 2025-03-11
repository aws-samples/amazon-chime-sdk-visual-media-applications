# Visually build telephony applications with AWS Step Functions

This solution demonstrates how combining AWS Step Functions and Amazon Chime SDK PSTN audio service streamlines the development of reliable telephony applications through visual workflow design and managed error handling. We provided a sample telephony application implementing six core business phone features, showcasing how the solution effectively manages multiple conditional paths and edge cases like disconnections and invalid inputs. The serverless architecture created enables seamless integration between the two services through JSON-based communication, while providing automatic scaling and pay-per-use pricing. Together, these components create a robust foundation for building sophisticated telephony applications that reduce maintenance costs and enhance reliability.

## Solution Overview

The solution provides two main components:

- **Event Router**: A Lambda function that routes JSON messages between Step Functions and PSTN audio service
- **Demo Workflow**: A Step Function workflow implementing the sample telephony application

## Sample telephony application

This application allows business owners manage customer calls through a dedicated business phone number. This solution helps small business owners separate personal and business communications while managing all calls from their existing phone. For more information check this related [Blog](https://aws-blogs-prod.amazon.com/messaging-and-targeting/). 

![Demo-Workflow](/images/business-phone-number-proxy-workflow-studio.png)

## Architecture Overview

This architecture is designed to enable seamless bidirectional communication between Step Functions and the PSTN audio service:

![Architecture](/images/visual-media-app-architecture.png)

Main components:

| Component | Description |
|-----------|-------------|
| `eventRouter` | Lambda function managing JSON message exchange |
| `appWorkflow` | Step Function implementing call flow logic |
| `actionsQueue` | Amazon Simple Queue Service (Amazon SQS) queue storing response actions |

Architecture walkthrough:

| Step | Description |
|-----------|-------------|
| `1` | PSTN audio service receives inbound call |
| `2` | Service sends NEW_INBOUND_CALL event to `eventRouter` |
| `3` | `eventRouter` creates the `actionsQueue` |
| `4` | `eventRouter` asynchronously executes `appWorkflow` with event data |
| `5` | eventRouter begins long-polling from `actionsQueue`, waiting for next action(s) message |
| `6` | `appWorkflow` processes JSON-formatted event data, computing next action(s)  |
| `7` | `appWorkflow` queues next actions(s) using SQS SendMessage API with Wait for Callback with Task Token integration pattern to stop workflow until next event call is received |
| `8` | `eventRouter` retrieves and removes action(s) from `actionsQueue` |
| `9` | `eventRouter` returns action(s) to PSTN audio service |

## Prerequisites

1. AWS Management Console access
2. Node.js and npm installed
3. AWS CLI installed and configured

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/aws-samples/amazon-chime-sdk-visual-media-applications

   cd amazon-chime-sdk-visual-media-applications
   
   npm install
   ```
2. **Bootstrap the stack**
   ```bash
   # Default AWS CLI credentials are used, otherwise use the –-profile parameter
   # provide the <account-id> and <region> to deploy this stack 
   cdk bootstrap aws://<account-id>/<region>
   ```

3. **Deploy the stack**
   ```bash
   # Default AWS CLI credentials are used, otherwise use the –-profile parameter
   # personalNumber: the personal phone number of the business owner in E.164 format
   # businessAreaCode: the United States area code used to provision the business number  
   cdk deploy –-context personalNumber=+1NPAXXXXXXX –-context businessAreaCode=NPA
   ```

## Deployed Resources

The CDK stack creates:

- `phoneNumberBusiness` – Provisioned phone number for the sample application 
- `sipMediaApp` – SIP media application that routes calls to `lambdaProcessPSTNAudioServiceCalls`
- `sipRule` – SIP rule that directs calls from `phoneNumberBusiness` to `sipMediaApp`.
- `stepfunctionBusinessProxyWorkflow` – Step Functions workflow for the sample application
- `roleStepfuntionBusinessProxyWorkflow` – IAM Role for `stepfunctionBusinessProxyWorkflow`
- `lambdaProcessPSTNAudioServiceCalls` – Lambda function for call processing
- `roleLambdaProcessPSTNAudioServiceCalls` – IAM Role for `lambdaProcessPSTNAudioServiceCalls`
- `dynamoDBTableBusinessVoicemails` – DynamoDB table to store customer voicemails
- `s3BucketApp` – S3 bucket for storing system recordings and customer voicemails
- `s3BucketPolicy` – IAM Policy granting PSTN audio service access to `s3BucketApp`
- `lambdaOutboundCall` – Lambda function for placing scheduled customer calls
- `roleLambdaOutboundCall` – IAM Role for `lambdaOutboundCall`
- `roleEventBridgeLambdaCall` – IAM Role to allow Amazon EventBridge service to execute `lambdaOutboundCall`


Once deployed, call the provisioned phone number to test the sample application. 

## Cleanup

**To clean up this demo, execute:**
   ```bash
   cdk destroy
   ```

## Security

- Lambda functions run with least-privilege permissions
- All resources use AWS IAM for access control
- Communication between services occurs through secure AWS channels

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT-0 License.


