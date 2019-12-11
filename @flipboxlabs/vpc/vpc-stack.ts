import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'

export interface IVpcStack extends cdk.StackProps {}

export class VpcStack extends cdk.Stack {
  // Resources
  public vpc: ec2.IVpc

  constructor(scope: cdk.Construct, id: string, props: IVpcStack) {
    super(scope, id, props)

    this.vpc = new ec2.Vpc(this, 'VPC')

    new cdk.CfnOutput(this, `VpcId`, {
      exportName: `${this.stackName}-VpcId`,
      value: this.vpc.vpcId
    })
  }
}
