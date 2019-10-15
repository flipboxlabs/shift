import * as autoscaling from '@aws-cdk/aws-autoscaling'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecr from '@aws-cdk/aws-ecr'
import * as ecs from '@aws-cdk/aws-ecs'
import * as cdk from '@aws-cdk/core'
import { IBaseEcsPipelineStackProps, SubStack } from '../sub-stack'

export interface IEcrStackProps extends cdk.StackProps {
  repositoryName: string
}

export class EcrStack extends SubStack {

  //resources
  public repository: ecr.Repository
  
  constructor(scope: cdk.Construct, id: string, props: IEcrStackProps) {
    super(scope, id)

    this.repository = new ecr.Repository(this, `EcsPipelineEcrRepo`, {
      repositoryName: props.repositoryName.toLowerCase(),
      // removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
  }
}
