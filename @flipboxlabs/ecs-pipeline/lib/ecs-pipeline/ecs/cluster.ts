import * as autoscaling from '@aws-cdk/aws-autoscaling'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecs from '@aws-cdk/aws-ecs'
import * as cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as cdk from '@aws-cdk/core'
import { IBaseEcsPipelineStackProps, SubStack } from '../sub-stack'
import { AllowIngress } from '../../ec2/allow-ingress'
import { stat } from 'fs'

export interface IClusterStackProps extends IBaseEcsPipelineStackProps {
  allowIngress?: AllowIngress[]
  instanceType?: string
  instanceClass?: ec2.InstanceClass
  instanceSize?: ec2.InstanceSize
  keyName?: string
  maxCapacity?: number
  vpc: ec2.IVpc
  whiteListCIDRs?: string[]
}

export class ClusterStack extends SubStack {

  // parameters to pull
  protected static instanceClass: ec2.InstanceClass = ec2.InstanceClass.T3
  protected static instanceSize: ec2.InstanceSize = ec2.InstanceSize.SMALL
  protected keyName: string
  protected maxCapacity: number = 5

  //resources
  public cluster: ecs.Cluster
  public ec2Autoscaling: autoscaling.AutoScalingGroup

  constructor(scope: cdk.Construct, id: string, props: IClusterStackProps) {
    super(scope, id)

    const stack = cdk.Stack.of(this)
    const instanceTypeIdentifier = props.instanceType
    ClusterStack.instanceClass = props.instanceClass || ClusterStack.instanceClass
    ClusterStack.instanceSize = props.instanceSize || ClusterStack.instanceSize
    this.keyName = props.keyName || this.keyName
    this.maxCapacity = props.maxCapacity || this.maxCapacity

    this.cluster = new ecs.Cluster(this, stack.stackName, {
      clusterName: stack.stackName,
      vpc: props.vpc
    })

    // todo?
    // 1. add security groups to the instances - port 22
    // 2. spot price
    // 3. MetricsCollection = 1Minute
    // 4. Block Device Storage
    let instanceType: ec2.InstanceType

    if (instanceTypeIdentifier !== undefined) {
      instanceType = new ec2.InstanceType(instanceTypeIdentifier)
    } else {
      instanceType = ec2.InstanceType.of(ClusterStack.instanceClass, ClusterStack.instanceSize)
    }

    this.ec2Autoscaling = this.cluster.addCapacity('ContainerInstances', {
      keyName: this.keyName || undefined,
      minCapacity: 1,
      desiredCapacity: 1,
      maxCapacity: this.maxCapacity,
      instanceType
    })

    if (props.whiteListCIDRs) {
      for (let i in props.whiteListCIDRs) {
        this.ec2Autoscaling.connections.allowFrom(
          ec2.Peer.ipv4(props.whiteListCIDRs[i]),
          ec2.Port.tcp(22)
        )
      }
    }

    if (props.allowIngress) {
      for (let i in props.allowIngress) {
        const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
          this,
          'ImportSecurityGroup',
          props.allowIngress[i].securityGroupId
        )

        securityGroup.connections.allowFrom(
          this.ec2Autoscaling,
          ec2.Port.tcp(props.allowIngress[i].tcpPort)
        )
      }
    }


    
    // ec2 Scaling by cpu
    new autoscaling.TargetTrackingScalingPolicy(this, `ScaleOnCpuReservation`,{
      autoScalingGroup: this.ec2Autoscaling,
      targetValue: 65,
      customMetric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUReservation',
        statistic: 'Average',
        dimensions: {
          ClusterName: this.cluster.clusterName,
        }
      }),
    })

    // ec2 Scaling by memory
    new autoscaling.TargetTrackingScalingPolicy(this, `ScaleOnMemoryReservation`,{
      autoScalingGroup: this.ec2Autoscaling,
      targetValue: 65,
      customMetric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryReservation',
        statistic: 'Average',
        dimensions: {
          ClusterName: stack.stackName,
        }
      }),
    })
  }
  static defaultInstanceType() {
    return [
      this.instanceClass,
      this.instanceSize
    ].join('.')
  }
}
