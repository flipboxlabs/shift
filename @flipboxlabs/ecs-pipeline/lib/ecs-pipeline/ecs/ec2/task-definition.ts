import * as cdk from '@aws-cdk/core'
import * as ecs from '@aws-cdk/aws-ecs'
import * as ecr from '@aws-cdk/aws-ecr'
import * as iam from '@aws-cdk/aws-iam'
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'
import { IBaseEcsPipelineStackProps, SubStack } from '../../sub-stack'
import { TaskRoleStack } from '../task-role'

export interface ITaskDefinitionStackProps extends IBaseEcsPipelineStackProps {
  cluster: ecs.Cluster
  envParameterPath: string
  opsBackupCommand?: string[]

  memoryReservationMiB?: number
  cpu?: number
  appContainerImage?: string
  queueContainerImage?: string
  prioritizeHttps?: boolean
  devopsBucket: string
}

export interface IMakeTaskDefinitionProps {
  role: iam.Role
  family: string
}

export interface IMakeContainerDefinitionProps {
  image: ecs.ContainerImage
  cpu: number
  memoryReservationMiB: number
  essential: boolean
  taskDefinition: ecs.TaskDefinition
  environment: {
    [key: string]: string
  }
  logging: ecs.LogDriver
}

export class Ec2TaskDefinitionStack extends SubStack {
  public idPrefix: string = 'Tasks'

  // Web - attached to service
  public webTaskDefinition: ecs.Ec2TaskDefinition
  // Queue - attached to service
  public queueTaskDefinition: ecs.Ec2TaskDefinition
  // Cron - cron based
  public cronTaskDefinition: ecs.Ec2TaskDefinition
  // Ops - cron based
  public opsTaskDefinition: ecs.Ec2TaskDefinition
  // Task Role
  public roleStack: TaskRoleStack

  // Containers
  public webContainer: ecs.ContainerDefinition
  public queueContainer: ecs.ContainerDefinition
  public cronContainer: ecs.ContainerDefinition
  public opsContainer: ecs.ContainerDefinition

  // parameters
  protected appContainerImage: string = 'flipbox/php:73-apache'
  protected queueContainerImage: string = 'flipbox/php:73-apache'
  protected opsContainerImage: string = 'flipbox/ops:latest'
  protected opsEventsSchedule: string = 'rate(4 hours)'
  protected cpu: number = 256
  protected memoryReservationMiB: number = 256
  protected devopsBucket: string
  protected multilinePattern: string =
    '^(dddd-dd-dd dd:dd:dd|S+:443 \\bd{1,3}.d{1,3}.d{1,3}.d{1,3}\\b)'

  constructor(
    scope: cdk.Construct,
    id: string,
    props: ITaskDefinitionStackProps
  ) {
    super(scope, id)

    //set a default
    props.prioritizeHttps = props.prioritizeHttps || false
    const stack = cdk.Stack.of(this);

    //overwrite defaults if populated
    this.cpu = props.cpu || this.cpu
    this.memoryReservationMiB = props.memoryReservationMiB || this.memoryReservationMiB

    this.roleStack = new TaskRoleStack(this, `${this.idPrefix}TaskRole`, {
      envParameterPath: props.envParameterPath,
      logGroup: props.logGroup,
      env: props.env,
      region: props.region
    })

    new cdk.CfnOutput(
      this,
      `${stack.stackName}RoleArnOutput`,
      {
        exportName: `${stack.stackName}TaskRoleArn`,
        value: this.roleStack.role.roleArn,
        description: 'Task Role Arn'
      }
    )

    const containerImage = ecs.ContainerImage.fromRegistry(
      this.appContainerImage
    )

    // Web Task
    this.webTaskDefinition = this.makeTaskDefinition(
      this,
      `${this.idPrefix}WebTaskDefinition`,
      {
        role: this.roleStack.role,
        family: `${stack.stackName}-WebApp`
      }
    )

    new cdk.CfnOutput(
      this,
      `${stack.stackName}WebTaskArnOutput`,
      {
        exportName: `${stack.stackName}WebTaskArn`,
        value: this.webTaskDefinition.taskDefinitionArn,
        description: 'Web Task Arn'
      }
    )
    this.webContainer = this.makeContainerDefinition(this, `WebContainer`, {
      image: containerImage,
      cpu: this.cpu,
      memoryReservationMiB: this.memoryReservationMiB,
      essential: true,
      taskDefinition: this.webTaskDefinition,
      environment: {
        STACK_NAME: stack.stackName,
        AWS_PARAMETER_PATH: props.envParameterPath,
        AWS_DEFAULT_REGION: props.region
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'web',
        logGroup: props.logGroup,
        multilinePattern: this.multilinePattern
      })
    })

    this.webContainer.addPortMappings(
      ...(props.prioritizeHttps
        ? [
            {
              containerPort: 443
            },
            {
              containerPort: 80
            }
          ]
        : [
            {
              containerPort: 80
            },
            {
              containerPort: 443
            }
          ])
    )

    // Queue Task
    this.queueTaskDefinition = this.makeTaskDefinition(
      this,
      `${this.idPrefix}QueueTaskDefinition`,
      {
        role: this.roleStack.role,
        family: `${stack.stackName}-QueueApp`
      }
    )
    new cdk.CfnOutput(
      this,
      `${stack.stackName}QueueTaskArnOutput`,
      {
        exportName: `${stack.stackName}QueueTaskArn`,
        value: this.queueTaskDefinition.taskDefinitionArn,
        description: 'Queue Task Arn'
      }
    )

    this.queueContainer = this.makeContainerDefinition(this, `QueueContainer`, {
      image: containerImage,
      cpu: this.cpu,
      memoryReservationMiB: this.memoryReservationMiB,
      taskDefinition: this.queueTaskDefinition,
      essential: true,
      environment: {
        STACK_NAME: stack.stackName,
        AWS_PARAMETER_PATH: props.envParameterPath,
        AWS_DEFAULT_REGION: props.region
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'queue',
        logGroup: props.logGroup,
        multilinePattern: this.multilinePattern
      })
    })

    // Cron
    this.cronTaskDefinition = this.makeTaskDefinition(
      this,
      `${this.idPrefix}CronTaskDefinition`,
      {
        family: `${stack.stackName}-Cron`,
        role: this.roleStack.role
      }
    )
    new cdk.CfnOutput(
      this,
      `${stack.stackName}CronTaskArnOutput`,
      {
        exportName: `${stack.stackName}CronTaskArn`,
        value: this.cronTaskDefinition.taskDefinitionArn,
        description: 'Cron Task Arn'
      }
    )

    this.cronContainer = this.makeContainerDefinition(this, `CronContainer`, {
      image: containerImage,
      cpu: this.cpu / 2,
      memoryReservationMiB: this.memoryReservationMiB / 2,
      essential: true,
      taskDefinition: this.cronTaskDefinition,
      environment: {
        STACK_NAME: stack.stackName,
        AWS_PARAMETER_PATH: props.envParameterPath,
        AWS_DEFAULT_REGION: props.region
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'cron',
        logGroup: props.logGroup,
        multilinePattern: this.multilinePattern
      })
    })

    if (props.opsBackupCommand) {
      // Ops
      this.opsTaskDefinition = this.makeTaskDefinition(
        this,
        `${this.idPrefix}OpsTaskDefinition`,
        {
          family: `${stack.stackName}-Ops`,
          role: this.roleStack.role
        }
      )
      this.opsContainer = this.makeContainerDefinition(this, `OpsContainer`, {
        image: ecs.ContainerImage.fromRegistry(this.opsContainerImage),
        cpu: this.cpu / 2,
        memoryReservationMiB: this.memoryReservationMiB / 2,
        essential: true,
        taskDefinition: this.opsTaskDefinition,
        environment: {
          STACK_NAME: stack.stackName,
          AWS_PARAMETER_PATH: props.envParameterPath,
          AWS_DEFAULT_REGION: props.region,
          DEVOPS_BUCKET: props.devopsBucket
        },
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: 'ops',
          logGroup: props.logGroup
        })
      })
      new cdk.CfnOutput(
        this,
        `${stack.stackName}OpsTaskArnOutput`,
        {
          exportName: `${stack.stackName}OpsTaskArn`,
          value: this.opsTaskDefinition.taskDefinitionArn,
          description: 'Ops Task Arn'
        }
      )
      // ops event
      const rule = new events.Rule(this, `${this.idPrefix}OpsCron`, {
        schedule: events.Schedule.expression(this.opsEventsSchedule)
      })

      rule.addTarget(
        new targets.EcsTask({
          cluster: props.cluster,
          taskDefinition: this.opsTaskDefinition,
          containerOverrides: [
            {
              containerName: this.opsContainer.node.id,
              command: props.opsBackupCommand
            }
          ]
        })
      )
    }
  }

  public makeTaskDefinition(
    scope: cdk.Construct,
    id: string,
    props: IMakeTaskDefinitionProps
  ): ecs.Ec2TaskDefinition {
    return new ecs.Ec2TaskDefinition(scope, id, {
      family: props.family,
      taskRole: props.role,
      executionRole: new iam.Role(this, `${id}ExecutionRole`, {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
        ]
      })
    })
  }

  public makeContainerDefinition(
    scope: cdk.Construct,
    id: string,
    props: IMakeContainerDefinitionProps
  ): ecs.ContainerDefinition {
    return new ecs.ContainerDefinition(scope, id, {
      image: props.image,
      cpu: props.cpu,
      memoryReservationMiB: props.memoryReservationMiB,
      essential: props.essential,
      taskDefinition: props.taskDefinition,
      environment: props.environment,
      logging: props.logging,
    })
  }
}
