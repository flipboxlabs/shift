import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as route53 from '@aws-cdk/aws-route53'
import { ShiftEc2 } from './ec2';

export interface IBastionStack extends cdk.StackProps {
  instanceName?: string
  vpcId: string
  whiteListCIDRs?: string[]
  keyName?: string
  userData?: string
  inlinePolicy?: iam.PolicyDocument
  allowIngress?: ShiftEc2.AllowIngress[]
  devopsBucketName?: string
  devopsAuthorizedKeysPrefix?: string
  domainName?: string
  domainZoneId?: string
  domainZoneName?: string
}

export class BastionStack extends cdk.Stack {
  private prefix: string = 'BastionStack'
  public static readonly TAG_NAME = 'Name'
  // Resources
  public instance: ec2.CfnInstance
  public instanceProfile: iam.CfnInstanceProfile
  public eip: ec2.CfnEIP
  constructor(scope: cdk.Construct, id: string, props: IBastionStack) {
    super(scope, id, props)

    const vpc = ec2.Vpc.fromLookup(this, `VpcImport`, {
      vpcId: props.vpcId
    })

    const securityGroup = new ec2.SecurityGroup(
      this,
      `${this.prefix}SecurityGroup`,
      {
        vpc
      }
    )
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
    )

    const ec2Role = new iam.Role(this, `Ec2Role`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: props.devopsBucketName && props.devopsAuthorizedKeysPrefix ? {
        inlineRoot: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:s3:::${props.devopsBucketName}`
            ],
            actions: [
              "s3:GetObject",
            ],
            conditions: {
              StringLike: {
                "s3::prefix": [
                  props.devopsAuthorizedKeysPrefix
                ]
              }
            }
          })]
        })
      } : undefined,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2RoleforSSM'
        )
      ]
    })

    this.instanceProfile = new iam.CfnInstanceProfile(
      this,
      `BastionHostInstanceProfile`,
      {
        path: '/',
        roles: [ec2Role.roleName]
      }
    )

    const image = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
    })

    const { subnets } = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC
    })

    let script = ''
    if(props.devopsBucketName && props.devopsAuthorizedKeysPrefix) {
      let contents = `head -n 1 /home/ec2-user/.ssh/authorized_keys > /home/ec2-user/.ssh/authorized_keys.backup;\n` +
        `cp /home/ec2-user/.ssh/authorized_keys.backup /home/ec2-user/.ssh/authorized_keys\n` +
        `aws s3 cp s3://${props.devopsBucketName}/${props.devopsAuthorizedKeysPrefix} - >> /home/ec2-user/.ssh/authorized_keys\n` +
        `chmod 600 /home/ec2-user/.ssh/authorized_keys`;
        script = `echo "${contents}" > /opt/authorized-keys.sh && sh /opt/authorized-keys.sh`
    }

    const userData = `${script}\n` + (props.userData ? props.userData : '') || ''

    this.instance = new ec2.CfnInstance(this, `${this.prefix}Instance`, {
      securityGroupIds: [securityGroup.securityGroupId],
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.NANO
      ).toString(),
      subnetId: subnets[0].subnetId,
      keyName: props.keyName,
      imageId: image.getImage(this).imageId,
      userData: cdk.Fn.base64(`#!/usr/bin/env bash\n${userData}`),
      iamInstanceProfile: this.instanceProfile.ref
    })

    if (props.allowIngress) {
      for (let i in props.allowIngress) {
        const sg = ec2.SecurityGroup.fromSecurityGroupId(
          this,
          `ImportSecurityGroup-${i}`,
          props.allowIngress[i].securityGroupId
        )

        sg.connections.allowFrom(
          securityGroup,
          ec2.Port.tcp(props.allowIngress[i].tcpPort)
        )
      }
    }

    cdk.Tag.add(
      this.instance,
      BastionStack.TAG_NAME,
      props.instanceName || 'BastionHost'
    )

    // Add an EIP
    // limit is low
    // this.eip = new ec2.CfnEIP(this, `EIP`, {
    //   instanceId: this.instance.ref
    // })

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
        recordName: props.domainName,
        target: route53.RecordTarget.fromIpAddresses(
          ...[this.instance.attrPublicIp]
        ),
        zone
      })

      new cdk.CfnOutput(this, 'DomainARecord', {
        value: domainRecord.domainName
      })
    }

    new cdk.CfnOutput(this, 'Instance', {
      exportName: `${this.stackName}-InstanceId`,
      value: this.instance.ref
    })

    new cdk.CfnOutput(this, 'InstanceIP', {
      exportName: `${this.stackName}-InstanceIP`,
      value: this.instance.attrPublicIp,
    })

    new cdk.CfnOutput(this, 'InstanceProfile', {
      exportName: `${this.stackName}-InstanceProfile`,
      value: this.instanceProfile.ref
    })

  }
}
