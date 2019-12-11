import * as cdk from '@aws-cdk/core'
import * as rds from '@aws-cdk/aws-rds'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'

export interface IAuroraMysqlStack extends cdk.StackProps {
  instanceType?: string
  vpcId: string
  whiteListCIDRs?: string[]
  defaultDatabaseName?: string
}

export class AuroraMysqlStack extends cdk.Stack {
  public static readonly FAMILY: string = 'aurora-mysql5.7'
  public static readonly PORT: number = 3306

  // Resources
  public cluster: rds.DatabaseCluster

  constructor(scope: cdk.Construct, id: string, props: IAuroraMysqlStack) {
    super(scope, id, props)

    const vpc = ec2.Vpc.fromLookup(this, `VpcImport`, {
      vpcId: props.vpcId
    })

    let instanceType
    if (props.instanceType) {
      instanceType = new ec2.InstanceType(props.instanceType)
    } else {
      instanceType = ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.SMALL
      )
    }

    const lambdaStatement = new iam.PolicyStatement({
      actions: ['lambda:InvokeAsync', 'lambda:InvokeFunction']
    })

    // TODO - refine this to sepecified functions
    lambdaStatement.addAllResources()

    const s3Statement = new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetObjectVersion']
    })
    // TODO - refine this to sepecified buckets
    s3Statement.addAllResources()

    const rdsRole = new iam.Role(this, `RdsClusterRole`, {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
      inlinePolicies: {
        lambdaInvoke: new iam.PolicyDocument({
          statements: [lambdaStatement, s3Statement]
        })
      }
    })

    this.cluster = new rds.DatabaseCluster(this, `AuroraMySQLDbCluster`, {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      defaultDatabaseName: props.defaultDatabaseName || 'app',
      masterUser: {
        username: `admin`
      },
      instanceProps: {
        instanceType,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC
        }
      },
      parameterGroup: new rds.ClusterParameterGroup(
        this,
        `${this.stackName}-cluster-params-group`,
        {
          family: AuroraMysqlStack.FAMILY,

          // the role still needs to attached for this which is not currently available
          parameters: {
            aws_default_lambda_role: rdsRole.roleArn,
            aurora_select_into_s3_role: rdsRole.roleArn,
            aurora_load_from_s3_role: rdsRole.roleArn
          }
        }
      ),
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    if (props.whiteListCIDRs) {
      props.whiteListCIDRs.forEach(cidr => {
        this.cluster.connections.allowFrom(
          ec2.Peer.ipv4(cidr),
          ec2.Port.tcp(3306),
          'Allow from CIDR'
        )
      })
    }

    new cdk.CfnOutput(this, 'ClusterIdentifier', {
      exportName: `${this.stackName}-Identifier`,
      value: this.cluster.clusterIdentifier
    })

    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      exportName: `${this.stackName}-Endpoint`,
      value: this.cluster.clusterEndpoint.hostname
    })

    new cdk.CfnOutput(this, 'ClusterReadEndpoint', {
      exportName: `${this.stackName}-ReadEndpoint`,
      value: this.cluster.clusterReadEndpoint.hostname
    })

    new cdk.CfnOutput(this, 'ClusterSecurityGroupId', {
      exportName: `${this.stackName}-SecurityGroupId`,
      value: this.cluster.connections.securityGroups[0].securityGroupId
    })
  }
}
