import json
import boto3

def lambda_handler(event, context):
    client = boto3.client('chime-sdk-voice')

    response = client.create_sip_media_application_call(
        FromPhoneNumber=event['BusinessPhoneNumber'],
        ToPhoneNumber=event['BusinessOwnerPhoneNumber'],
        SipMediaApplicationId=event['SipMediaApplicationId'],
        ArgumentsMap={'CustomerPhoneNumber': event['CustomerPhoneNumber'] }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(response)
    }
