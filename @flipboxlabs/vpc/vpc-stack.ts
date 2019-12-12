import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'

export interface IVpcStack extends cdk.StackProps {}

export class VpcStack extends cdk.Stack {
  // Resources
  public vpc: ec2.IVpc

  constructor(scope: cdk.Construct, id: string, props: IVpcStack) {
    super(scope, id, props)

    //cdk is awesome!
    this.vpc = new ec2.Vpc(this, 'VPC')

    // helpful output
    for(let i in this.vpc.publicSubnets) {
      new cdk.CfnOutput(this,
        `${this.stackName}-PUBLIC-SUBNET-ID-${i}`,
        {
          exportName: `${this.stackName}-PUBLIC-SUBNET-ID-${i}`,
          value: this.vpc.publicSubnets[i].subnetId,
        }
      )
    }

    for(let i in this.vpc.privateSubnets) {
      new cdk.CfnOutput(this,
        `${this.stackName}-PRIVATE-SUBNET-ID-${i}`,
        {
          exportName: `${this.stackName}-PRIVATE-SUBNET-ID-${i}`,
          value: this.vpc.privateSubnets[i].subnetId,
        }
      )
    }

    new cdk.CfnOutput(this, `VpcId`, {
      exportName: `${this.stackName}-VpcId`,
      value: this.vpc.vpcId
    })
  }
}
