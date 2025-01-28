# Visually build telephony applications with AWS Step Functions

This solution demonstrates how to build custom telephony applications for Amazon Chime SDK Public Switched Telephone Network (PSTN) Audio Service using AWS Step Functions' Workflow Studio. The approach simplifies complex telephony applications development through visual workflow design.

## Solution Overview

The solution provides two main components:

- **Event Router**: A Lambda function that handles bidirectional routing logic for SIP media applications
- **Demo Workflow**: A Step Function that implements the logic of a demo multi-language telephony application

## Demo Multi-language telephony application

This application demostrates the typical multi-language logic where the system initially prompts callers to select their preferred language: press 1 for Spanish or remain on the line for English. Once the language if selected the IVR interacts with the callers in their language of choice:  

![Demo-Workflow](/images/multi-language-ivr-workflow-studio.png)

## Architecture Overview

This architecture is designed to enable seamless communication between Step Functions and the PSTN Audio service:

![Architecture](/images/visual-media-app-architecture.png)

The solution uses the following components:

| Component | Description |
|-----------|-------------|
| `eventRouter` | Lambda function implementing bidirectional routing logic |
| `appWorkflow` | Step Function implementing call flow logic |
| `actionsQueue` | Amazon SQS queue storing next actions |

Architecture walkthrough:

| Step | Description |
|-----------|-------------|
| `1` | An inbound phone call arrives to a PSTN Audio service phone number |
| `2` | The PSTN Audio service sends the NEW_INBOUND_CALL event to the eventRouter Lambda function |
| `3` | The eventRouter creates the actionsQueue to store the PSTN Audio service Actions for the duration of the call |
| `4` | The eventRouter aynchronously executes the appWorkflow with the PSTN Audio service Event data |
| `5` | The eventRouter initiates long-polling to wait for the next Action(s) message on the actionsQueue |
| `6` | The appWorkflow receives JSON-formatted Event data as Task Input, processes it using Step Functions’ JSON handling techniques, and produces the next Action(s) message format as defined by the PSTN Audio service |
| `7` | The appWorkflow uses SQS:SendMessage Action with Wait for Callback to queue the next Action(s) in the actionsQueue (Workflow execution stops until next Event is received) |
| `8` | The eventRouter retrieves and deletes the next Action(s) from the actionsQueue |
| `9` | The eventRouter returns the next Action(s) to the PSTN Audio service |

## Prerequisites

1. AWS Management Console access
2. Node.js v12+ and npm
3. AWS CLI installed and configured
4. Permissions for:
   - Phone Numbers creation
   - SIP Rules and SIP Media Applications creation
   - Service Quotas verification

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/aws-samples/amazon-chime-sdk-visual-media-applications

   cd amazon-chime-sdk-visual-media-applications
   
   npm install
   ```

2. **Deploy the stack**
   ```bash
   cdk deploy
   ```

   Or you can deploy with a registered phone number to automatically create a SIP Rule associated with the Lambda function, using this command instead:
   ```bash
   cdk deploy --context phoneNumber=+1NPANXXXXXX
   ```

## Deployed Resources

The CDK stack creates:
- SIP media application
- SIP rule (if phone number provided)
- Event Router Lambda function
- Lambda execution role
- Multi-language Step Function
- Step Function execution role

Once deployed, call the associated phone number to interact with the multi-language sample telephony application.

## Cleanup

1. **Destroy the stack**
   ```bash
   cdk destroy
   ```

2. **Remove phone numbers** manually in Amazon Chime Console

## Security

- Lambda functions run with least-privilege permissions
- All resources use AWS IAM for access control
- Communication between services occurs through secure AWS channels

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT-0 License.


