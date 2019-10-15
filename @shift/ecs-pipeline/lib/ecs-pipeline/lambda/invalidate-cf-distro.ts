import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';

export interface InvalidateCfDistroProps {
  distributionId: string
}

export class InvalidateCfDistro extends lambda.Function {

  public static readonly DEFAULT_HANDLER = 'index.lambda_handler'
  constructor(scope: cdk.Construct, id: string, props: InvalidateCfDistroProps) {
    super(scope, id, {
      code: lambda.Code.inline(InvalidateCfDistro.functionCode()),
      handler: InvalidateCfDistro.DEFAULT_HANDLER,
      runtime: lambda.Runtime.PYTHON_3_7,
      environment: {
        DISTRO_ID: props.distributionId
      }
    })

    this.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: ['*']
    }))

  }

  static functionCode() {
    return `
import boto3
import os
import time

code_pipeline = boto3.client('codepipeline')
cloudfront = boto3.client('cloudfront')

def lambda_handler(event, context):
    """The Lambda function handler

    Set an DISTRO_ID environmental variable

    Args:
        event: The event passed by Lambda
        context: The context passed by Lambda

    """
    try:
        # Extract the Job ID
        job_id = event['CodePipeline.job']['id']

        # Extract the params
        distro_id = os.environ['DISTRO_ID']

        response: dict
        response = cloudfront.create_invalidation(
            DistributionId=distro_id,
            InvalidationBatch={
                'Paths':{
                    'Quantity':1,
                    'Items':['/*']
                },
                'CallerReference': str(time.time())
            }
        )
        print(response.get('Invalidation',{}).get('Id'))
        print('Putting job success')
        print('Sent invalidation to cloudfront distro: %s' % (distro_id))
        code_pipeline.put_job_success_result(jobId=job_id)

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        print('Function failed due to exception.')
        print(e)
        code_pipeline.put_job_failure_result(jobId=job_id, failureDetails={'message': str(e), 'type': 'JobFailed'})

    print('Function complete.')
    return "Complete."
    `
  }
}