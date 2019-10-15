import * as cdk from '@aws-cdk/core'
import * as iam from '@aws-cdk/aws-iam'
import * as lambda from '@aws-cdk/aws-lambda'

export interface Pub2SlackProps {
  appUrl: string
  environment: {
    [key: string]: string
  }
  allowResources: string[]
}

export class Pub2Slack extends lambda.Function {
  public static readonly HOOK_URL_CONST = 'HOOK_URL_PARAMETER_PATH'
  public static readonly DEFAULT_HANDLER = 'index.lambda_handler'

  constructor(scope: cdk.Construct, id: string, props: Pub2SlackProps) {
    super(scope, id, {
      code: lambda.Code.inline(Pub2Slack.functionCode()),
      handler: Pub2Slack.DEFAULT_HANDLER,
      runtime: lambda.Runtime.PYTHON_3_7,
      environment: Object.assign(props.environment, { APP_URL: props.appUrl }),
    })

    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: props.allowResources,
        actions: ['ssm:GetParameter']
      })
    )
  }

  static functionCode() {
    return `
import json
import logging
import os
from botocore.vendored import requests
import boto3
import dateutil.parser as dp

def get_hook_urls():
    client = boto3.client('ssm')

    hook_urls = []
    for key,path in os.environ.items():
        logger.info('Env key: %s' % key)
        if key[0:23] == HOOK_URL_KEY:
            logger.info('Key matches webhook format: %s' % key)
            hook_param = client.get_parameter(
                Name=path,
                WithDecryption=True
            )

            hook_value = hook_param['Parameter']['Value']
            hook_urls.append(hook_value)
            logger.info('Parameter found: ' + path + ' = ' + hook_value[0:40] + '****** (full string redacted)')

    return hook_urls

red = "#df0505"
green = "#11aa32"
HOOK_URL_KEY = '${Pub2Slack.HOOK_URL_CONST}'

#Load up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Get the Slack Webhook URL
hook_urls = get_hook_urls()
domain = os.environ['APP_URL']

def lambda_handler(event, context):
    logger.info("Event: " + str(event))
    pipeline = event['detail']['pipeline']
    state = event['detail']['state']
    region = event['region']
    message = "%s state changed to: %s. App URL: %s" % (pipeline, state, domain)
    account = event['account']
    timestamp = event['time']
    ts = dp.parse(timestamp).strftime('%s')

    slack_message = {
        'attachments': [
            {
            "fallback": message,
            "color": (red,green)[state == "SUCCEEDED"],
            "title": pipeline,
            "title_link": "https://console.aws.amazon.com/codepipeline/home?region=%s#/view/%s" % (region, pipeline),
            "text": message,
            "fields": [
                {
                "title": "AWS Account",
                "value": account,
                "short": False
                }
            ],
            "footer": "AWS CodePipeline State Update",
            "ts": ts
            }
        ]
    }


    for url in hook_urls:
        req = requests.post(url, headers={'Content-type':'application/json'},data=json.dumps(slack_message))

        logger.info(req.text)
        logger.info(req.status_code)

    return json.dumps(slack_message)
    
`
  }
}
