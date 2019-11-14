import * as cdk from '@aws-cdk/core'
import * as ecs from '@aws-cdk/aws-ecs'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import { IBaseEcsPipelineStackProps, SubStack } from '../../sub-stack'

export interface IAllServicesStackProps extends IBaseEcsPipelineStackProps {
  cluster: ecs.Cluster
  webTaskDefinition: ecs.Ec2TaskDefinition
  queueTaskDefinition: ecs.Ec2TaskDefinition
  vpc: ec2.IVpc
  certificateArns?: string[]
}

export interface IServiceStackProps {
  cluster: ecs.Cluster
  taskDefinition: ecs.Ec2TaskDefinition
  vpc: ec2.IVpc
  certificateArns?: string[]
}

export class Ec2ServicesStack extends SubStack {
  public idPrefix: string = 'Service'

  // parameters
  protected minWebTasks: number = 1
  protected maxWebTasks: number = 20
  protected minQueueTasks: number = 1
  protected maxQueueTasks: number = 5

  //resources
  public webService: ecs.Ec2Service
  public queueService: ecs.Ec2Service
  public loadBalancer: elbv2.ApplicationLoadBalancer
  public listener: elbv2.ApplicationListener
  public targetGroup: elbv2.ApplicationTargetGroup

  constructor(scope: cdk.Construct, id: string, props: IAllServicesStackProps) {
    super(scope, id)

    this.makeWebService({
      cluster: props.cluster,
      vpc: props.vpc,
      taskDefinition: props.webTaskDefinition,
      certificateArns: props.certificateArns
    })

    this.makeQueueService({
      cluster: props.cluster,
      vpc: props.vpc,
      taskDefinition: props.queueTaskDefinition
    })
  }

  protected makeWebService(props: IServiceStackProps) {
    this.webService = new ecs.Ec2Service(
      this,
      `Ec2ServiceWeb${this.idPrefix}`,
      {
        cluster: props.cluster,
        taskDefinition: props.taskDefinition
      }
    )

    const lbSg = new ec2.SecurityGroup(this, `ALBSecurityGroup`, {
      vpc: props.vpc
    })

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      `ElbV2${this.idPrefix}`,
      {
        vpc: props.vpc,
        internetFacing: true,
        idleTimeout: cdk.Duration.seconds(300),
        securityGroup: lbSg
      }
    )

    if (props.certificateArns !== undefined) {

      let tg = new elbv2.ApplicationTargetGroup(
        this,
        `ServiceAppHttpsTargetGroup`,
        {
          vpc: props.vpc,
          protocol: elbv2.ApplicationProtocol.HTTPS,
          port: 443,
          targets: [this.webService],
          stickinessCookieDuration: cdk.Duration.seconds(90),
          healthCheck: {
            interval: cdk.Duration.seconds(60),
            path: '/health.html',
            healthyHttpCodes: '200-299,403'
          }
        }
      )

      let listener = this.loadBalancer.addListener(`HttpsListener`, {
        protocol: elbv2.ApplicationProtocol.HTTPS,
        port: 443,
        open: true,
        certificateArns: props.certificateArns,
        defaultTargetGroups: [tg]
      })

      this.loadBalancer.addListener(`HttpListener`,{
        protocol: elbv2.ApplicationProtocol.HTTP,
        port: 80,
        open: true,
        defaultTargetGroups: [tg]
      })

      listener.addTargetGroups(`HttpsTargetGroups`, {
        priority: 1,
        pathPattern: '/',
        targetGroups: [tg]
      })

    } else {
      let tg = new elbv2.ApplicationTargetGroup(
        this,
        `ServiceAppHttpTargetGroup`,
        {
          vpc: props.vpc,
          protocol: elbv2.ApplicationProtocol.HTTP,
          port: 80,
          targets: [this.webService],
          stickinessCookieDuration: cdk.Duration.seconds(90),
          healthCheck: {
            interval: cdk.Duration.seconds(60),
            path: '/health.html',
            healthyHttpCodes: '200-299,403'
          }
        }
      )
      // Default listener
      let listener = this.loadBalancer.addListener(
        `ElbV2ListenerHttp${this.idPrefix}`,
        {
          port: 80,
          open: true,
          defaultTargetGroups: [tg]
        }
      )
      listener.addTargetGroups(`HttpAddTargetGroup`, {
        targetGroups: [tg],
        pathPattern: '/',
        priority: 1
      })
    }

    const scaling = this.webService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: this.maxWebTasks
    })

    scaling.scaleOnCpuUtilization(`${this.idPrefix}CpuWebScaling`, {
      targetUtilizationPercent: 65,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    })

    scaling.scaleOnMemoryUtilization(`${this.idPrefix}MemoryWebScaling`, {
      targetUtilizationPercent: 65,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    })

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName
    })
  }

  protected makeQueueService(props: IServiceStackProps) {
    this.queueService = new ecs.Ec2Service(
      this,
      `Ec2ServiceQueue${this.idPrefix}`,
      {
        cluster: props.cluster,
        taskDefinition: props.taskDefinition
      }
    )

    const scaling = this.queueService.autoScaleTaskCount({
      minCapacity: this.minQueueTasks,
      maxCapacity: this.maxQueueTasks
    })

    scaling.scaleOnCpuUtilization(`${this.idPrefix}CpuQueueScaling`, {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    })

    scaling.scaleOnMemoryUtilization(`${this.idPrefix}MemoryQueueScaling`, {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    })
  }
}
