import json
import boto3
import os
import logging
import random
import string

class EventData:
    def __init__(self, event):
        self.event_type = event['InvocationEventType']
        self.call_details = event['CallDetails']
        self.transaction_id = self.call_details['TransactionId']
        self.sip_media_application_id = self.call_details['SipMediaApplicationId']        
        self.participants = self.call_details['Participants']
        self.to_number = self.participants[0]['To']
        self.from_number = self.participants[0]['From']
        self.call_id = self.participants[0]['CallId']
        self.participant_tag = self.participants[0]['ParticipantTag']
        self.status = self.participants[0].get('Status', 'Connected')
        self.wait_token = self.__get_call_attribute(tokenName='WaitToken') 
        self.queue_url = self.__get_call_attribute(tokenName='QueueUrl') 
        self.call_flow_instance_name = "call_flow_{}".format(self.transaction_id)
        
    def to_json(self):        
        return json.dumps(self.__dict__)

    def __get_call_attribute(self, tokenName):
        if "TransactionAttributes" in self.call_details:
            return self.call_details['TransactionAttributes'].get(tokenName, None)     
        return None

# Set LogLevel using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    log_level = os.environ["LogLevel"]
    if log_level not in ["INFO", "DEBUG"]:
        log_level = "INFO"
except:
    log_level = "INFO"
logger.setLevel(log_level)

stepfunctions = boto3.client("stepfunctions")
sqs = boto3.client('sqs')

def lambda_handler(event, context):
    
    result = no_action_result()
 
    try:   
        logger.info("Called with event: {}".format(json.dumps(event)))

        event_data = EventData(event)

        #find stepfunction arn call flow by did and throw if did is not found
        event_data.call_flow_arn = find_call_flow_arn_by_did(event_data)

        logger.info("Event Data: {}".format(event_data.to_json()))

        if event_data.event_type == 'ACTION_INTERRUPTED' or (event_data.event_type == 'ACTION_FAILED' and event_data.status == 'Disconnected'): 
            #do nothing for informational event types
            result = no_action_result()
        elif event_data.event_type == 'INVALID_LAMBDA_RESPONSE' or event_data.event_type == 'HANGUP' or event_data.event_type == 'ACTION_FAILED':                                 
            #design failure and hangups are passed to the stepfuntion as errors
            stepfunctions.send_task_failure(taskToken=event_data.wait_token, error=event_data.event_type)         
        else:
            if event_data.event_type == 'NEW_INBOUND_CALL' or event_data.event_type == 'NEW_OUTBOUND_CALL':   
                #create the sqs queue that will handle this call actions        
                event_data.queue_url = create_actions_queue(event_data)
                
                #start and execute new step function instance for this did
                start_execute_step_function(event_data, event)            
            else:
                #success actions are passed to the stepfuntion as failures
                stepfunctions.send_task_success(taskToken=event_data.wait_token, output=json.dumps(event)) 

            #wait until new message is available on queue, throws if no messages returned
            result = wait_for_next_action(event_data)

    except Exception as e:
        logger.error("Exception: {}".format(str(e)))
    finally:
        #this is always the last event
        if event_data.event_type == 'HANGUP' and len(event_data.participants) == 1 and event_data.participant_tag == 'LEG-A':
            sqs.delete_queue(QueueUrl=event_data.queue_url)
            logger.info("Queue deleted")

    return result


#auxiliary funtions

def no_action_result():
    logger.info("Returning ACTIONS[]")
    return {"SchemaVersion": "1.0", "Actions": []};

def find_call_flow_arn_by_did(event_data):

    did = event_data.to_number
    if event_data.event_type == 'NEW_OUTBOUND_CALL':
        did = event_data.from_number

    #load call flows from env
    call_flows_did_map = json.loads(os.environ['CallFlowsDIDMap'])

    for item in call_flows_did_map:
        if item['DID'] == did:            
            return item['ARN']
    
    raise Exception('No call flow found for number: ' + did)

def create_actions_queue(event_data):
    response = sqs.create_queue(
                QueueName=event_data.call_flow_instance_name,
                Attributes={'ReceiveMessageWaitTimeSeconds': '18'}
            )
    queue_url = response['QueueUrl']
    logger.info("Queue created: {}".format(queue_url))

    return queue_url

def start_execute_step_function(event_data, event):
    stepfunctions.start_execution(
        name=event_data.call_flow_instance_name,
        stateMachineArn=event_data.call_flow_arn,
        input=json.dumps({ "QueueUrl": event_data.queue_url, "CallId": event_data.call_id, "SipMediaApplicationId": event_data.sip_media_application_id, "TransactionId": event_data.transaction_id, "Event": event })
    )
    logger.info("Step funtion executed")

def wait_for_next_action(event_data):
    logger.info("Reading message...")
    
    response = sqs.receive_message(
        QueueUrl=event_data.queue_url,
        MaxNumberOfMessages=1, 
        VisibilityTimeout=20,
        MessageAttributeNames=['All']
    )        
    message = response['Messages'][0]
    receipt_handle = message['ReceiptHandle']
    sqs.delete_message(
        QueueUrl=event_data.queue_url,
        ReceiptHandle=receipt_handle
    ) 
    #set result to message body with contains the action
    result = json.loads(message['Body'])
    
    logger.info("Message processed, returned Actions: {}".format(result))

    return result