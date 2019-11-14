import * as cdk from '@aws-cdk/core'
import * as iam from '@aws-cdk/aws-iam'
import { IBaseEcsPipelineStackProps } from '../sub-stack'

export interface ITaskRoleStack extends IBaseEcsPipelineStackProps {
  envParameterPath: string
}

export class TaskRoleStack extends cdk.Construct {
  public idPrefix: string = 'TaskRole'
  public role: iam.Role
  public policy: iam.Policy

  constructor(scope: cdk.Construct, id: string, props: ITaskRoleStack) {
    super(scope, id)

    // Role
    this.role = new iam.Role(scope, `${this.idPrefix}Role`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
    })

    // Start Policy
    this.policy = new iam.Policy(this, `${this.idPrefix}Policy`)

    // Policy Statements
    const s3Statement = new iam.PolicyStatement({
      actions: TaskRoleStack.s3FileManagementActions()
    })

    //TODO - refine this
    s3Statement.addAllResources()

    const cwLogsStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.cwLogsActions()
    })
    cwLogsStatement.addResources(props.logGroup.logGroupArn)

    const snsStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.snsActions()
    })

    //TODO - refine this
    snsStatement.addAllResources()

    const cloudfrontStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.cloudfrontActions()
    })

    // TODO - Check if invalidates policies are still required to be open to all resources
    cloudfrontStatement.addAllResources()

    const ssmParameterStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.ssmParameterActions()
    })
    //TODO - refine this
    ssmParameterStatement.addResources(...[
      `arn:aws:ssm:*:*:parameter${props.envParameterPath}`,
      `arn:aws:ssm:*:*:parameter${props.envParameterPath}/*`,
    ])

    const sesStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.sesActions()
    })
    //TODO - refine this
    sesStatement.addAllResources()

    const sqsStatement = new iam.PolicyStatement({
      actions: TaskRoleStack.sqsActions()
    })
    //TODO - refine this
    sqsStatement.addAllResources()

    // Add all of the statements
    this.policy.addStatements(
      ...[
        cloudfrontStatement,
        cwLogsStatement,
        s3Statement,
        ssmParameterStatement,
        snsStatement,
        sesStatement,
        sqsStatement
      ]
    )

    // Attach to the role
    this.policy.attachToRole(this.role)
  }
  static sesActions() {
    return ['ses:SendEmail', 'ses:SendRawEmail']
  }

  static s3FileManagementActions() {
    return [
      's3:AbortMultipartUpload',
      's3:DeleteObject',
      's3:DeleteObjectTagging',
      's3:DeleteObjectVersion',
      's3:DeleteObjectVersionTagging',
      's3:GetObject',
      's3:GetObjectAcl',
      's3:GetObjectTagging',
      's3:GetObjectTorrent',
      's3:GetObjectVersion',
      's3:GetObjectVersionAcl',
      's3:GetObjectVersionTagging',
      's3:GetObjectVersionTorrent',
      's3:ListMultipartUploadParts',
      's3:PutObject',
      's3:PutObjectAcl',
      's3:PutObjectTagging',
      's3:PutObjectVersionAcl',
      's3:PutObjectVersionTagging',
      's3:RestoreObject',
      's3:ListBucket',
      's3:ListBucketVersions',
      's3:ListAllMyBuckets',
      's3:ListBucketMultipartUploads'
    ]
  }
  static cwLogsActions() {
    return [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
      'logs:DescribeLogStreams'
    ]
  }
  static cloudfrontActions() {
    return ['cloudfront:CreateInvalidation']
  }
  static snsActions() {
    return ['sns:*']
  }

  static ssmParameterActions() {
    return ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath']
  }

  static sqsActions() {
    return [
      'sqs:ChangeMessageVisibility',
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:ListDeadLetterSourceQueues',
      'sqs:ListQueues',
      'sqs:ListQueueTags',
      'sqs:ReceiveMessage',
      'sqs:SendMessage'
    ]
  }
}
