import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as logs from '@aws-cdk/aws-logs'

export interface ICommonStack extends cdk.StackProps {
  vpcId?: string
  logGroupName: string
}

export class CommonStack extends cdk.Construct {

  // Resources
  public vpc: ec2.IVpc
  public logGroup: logs.LogGroup

  constructor(scope: cdk.Construct, id: string, props: ICommonStack) {
    super(scope, id)

    // LogGroup
    this.logGroup = new logs.LogGroup(this, 'EcsPipelineLogGroup', {
      logGroupName: props.logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // VPC
    // if (props.vpcId) {
      this.vpc = ec2.Vpc.fromLookup(this, 'EcsVpc', {
        vpcId: props.vpcId,
      })
    // } else {
    //   this.vpc = new ec2.Vpc(this, 'EcsVPC')
    // }
  }
}
