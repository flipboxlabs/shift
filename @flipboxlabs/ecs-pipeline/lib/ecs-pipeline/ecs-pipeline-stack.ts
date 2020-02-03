import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as logs from '@aws-cdk/aws-logs'
import * as route53 from '@aws-cdk/aws-route53'
import * as route53Targets from '@aws-cdk/aws-route53-targets'
import * as cdk from '@aws-cdk/core'
import * as codecommit from '@aws-cdk/aws-codecommit'
import { ClusterStack } from './ecs/cluster'
import { CodeBuildStack } from './codebuild'
import { CodePipelineStack } from './codepipeline'
import { CommonStack } from './common-stack'
import { Ec2TaskDefinitionStack } from './ecs/ec2/task-definition'
import { Ec2ServicesStack } from './ecs/ec2/services'
import { EcrStack } from './ecs/ecr-stack'
import {AllowIngress} from '../ec2/allow-ingress'

export interface IEcsPipelineStackProps extends cdk.StackProps {
  allowIngress?: AllowIngress[]
  appName: string
  assetBucketName?: string
  certificateArns?: string[]
  codecommitRepo: string
  codecommitBranch: string
  domainZoneId?: string
  domainZoneName?: string
  domainName?: string
  envName: string
  envParameterPath: string
  instanceType?: string
  instanceKeyName?: string
  mainImageName?: string
  maxCapacity?: number
  opsBackupCommand: string[]
  s3ArtifactBucketName: string
  vpcId?: string
  pub2SlackParams?: string[]
  whiteListCIDRs?: string[]
  minDesiredWebTasks?: number
  minDesiredQueueTasks?: number
  addToTaskDefRolePolicy?: iam.PolicyStatement[]
  stickinessCookieDuration?: cdk.Duration
}

export class EcsPipelineStack extends cdk.Stack {
  protected vpc: ec2.IVpc
  protected logGroup: logs.LogGroup

  constructor(scope: cdk.Construct, id: string, props: IEcsPipelineStackProps) {
    super(scope, id, props)

    const commonStack = new CommonStack(this, `CommonStack`, {
      vpcId: props.vpcId,
      logGroupName: this.stackName,
    })

    const ecrStack = new EcrStack(this, `EcrStack`, {
      repositoryName: this.stackName,
    })

    const clusterStack = new ClusterStack(this, 'ClusterStack', {
      allowIngress: props.allowIngress,
      logGroup: commonStack.logGroup,
      vpc: commonStack.vpc,
      keyName: props.instanceKeyName,
      instanceType: props.instanceType,
      maxCapacity: props.maxCapacity,
      whiteListCIDRs: props.whiteListCIDRs,
      region: this.region
    })

    const taskDefStack = new Ec2TaskDefinitionStack(this, `TaskDefStack`, {
      cluster: clusterStack.cluster,
      memoryReservationMiB: this.determineResourceUnits(props.instanceType || ClusterStack.defaultInstanceType()),
      cpu: this.determineResourceUnits(props.instanceType || ClusterStack.defaultInstanceType()),
      envParameterPath: props.envParameterPath,
      logGroup: commonStack.logGroup,
      prioritizeHttps: props.certificateArns ? true : false,
      env: props.env,
      opsBackupCommand: props.opsBackupCommand,
      region: this.region,
      devopsBucket: props.s3ArtifactBucketName,
      addToTaskDefRolePolicy: props.addToTaskDefRolePolicy,
    })

    const ecsServiceStack = new Ec2ServicesStack(this, `EcsServiceStack`, {
      certificateArns: props.certificateArns,
      cluster: clusterStack.cluster,
      logGroup: commonStack.logGroup,
      queueTaskDefinition: taskDefStack.queueTaskDefinition,
      webTaskDefinition: taskDefStack.webTaskDefinition,
      vpc: commonStack.vpc,
      env: props.env,
      region: this.region,
      minDesiredWebTasks: props.minDesiredWebTasks || 1,
      minDesiredQueueTasks: props.minDesiredQueueTasks || 1,
      stickinessCookieDuration: props.stickinessCookieDuration,
    })

    const codecommitRepo = codecommit.Repository.fromRepositoryName(
      this,
      'CodeCommitRepo',
      props.codecommitRepo
    )

    // codebuild
    const codeBuildStack = new CodeBuildStack(this, 'CodeBuildStack', {
      envName: props.envName,
      envParameterPath: props.envParameterPath,
      logGroup: commonStack.logGroup,
      repositoryUri: ecrStack.repository.repositoryUri,
      repositoryName: ecrStack.repository.repositoryName,
      s3ArtifactBucketName: props.s3ArtifactBucketName,
      env: props.env,
      region: this.region,
      account: this.account,
    })

    // codepipeline
    const codepipelineStack = new CodePipelineStack(this, 'CodePipelineStack', {
      logGroup: commonStack.logGroup,
      codebuild: codeBuildStack.buildProject,
      codecommit: codecommitRepo,
      s3BucketName: props.s3ArtifactBucketName,
      webEcsService: ecsServiceStack.webService,
      queueEcsService: ecsServiceStack.queueService,
      repoName: props.codecommitRepo,
      repoBranchName: props.codecommitBranch,
      env: props.env,
      domainName: props.domainName || ecsServiceStack.loadBalancer.loadBalancerDnsName,
      pub2SlackParams: props.pub2SlackParams,
      region: this.region
    })

    if (props.domainName && props.domainZoneId && props.domainZoneName) {
      // Route53 alias record for the CloudFront distribution
      const zone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        `HostedZone`,
        {
          hostedZoneId: props.domainZoneId,
          zoneName: props.domainZoneName
        }
      )

      const domainRecord = new route53.ARecord(this, `ARecord`, {
        recordName:
            props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.LoadBalancerTarget(ecsServiceStack.loadBalancer)
        ),
        zone
      })
      new cdk.CfnOutput(this, 'DomainARecord', {
        value: domainRecord.domainName
      })
    }
  }
  determineResourceUnits(instanceType: string){

    let units: number = 128
    if(new RegExp('small').test(instanceType)) {
      units = 256
    }else if(new RegExp('medium').test(instanceType)){
      units = 256
    }else if(new RegExp('large').test(instanceType)){
      units = 512
    }
    return units
  }
}
