#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { EcsPipelineStack } from '../lib/ecs-pipeline/ecs-pipeline-stack'
import { AllowIngress } from '../lib/ec2/allow-ingress'

// CDK App
const app = new cdk.App()

// Parameters

// certificate arns
// JSON formated, ie, `-c whiteListIps='["arn:aws:acm:us-east-1:<account>:certificate/<ID-1>", "arn:aws:acm:us-east-1:<account>:certificate/<ID-2>"]'`
const rawCertificateArns = app.node.tryGetContext('certificateArns')
let certificateArns: string[]|undefined

if(rawCertificateArns) {
  certificateArns = JSON.parse(rawCertificateArns);
}

const appName = app.node.tryGetContext('appName')
const assetBucketName = app.node.tryGetContext('assetBucketName')
const envName = app.node.tryGetContext('envName')
const stackVersion = app.node.tryGetContext('stackVersion')
const awsAccount = app.node.tryGetContext('awsAccount')
const awsRegion = app.node.tryGetContext('awsRegion')
const envParameterPath =
  app.node.tryGetContext('envParameterPath') || `/${appName}/${envName}`
const codecommitBranch = app.node.tryGetContext('codecommitBranch')
const codecommitRepo = app.node.tryGetContext('codecommitRepo')
// const domainName = app.node.tryGetContext('domainName')
const domainZoneName = app.node.tryGetContext('domainZoneName')
const domainZoneId = app.node.tryGetContext('domainZoneId')
const instanceKeyName = app.node.tryGetContext('instanceKeyName')
const s3ArtifactBucketName = app.node.tryGetContext('s3ArtifactBucketName')
const opsBackupCommandString = app.node.tryGetContext('opsBackupCommand')
const vpcId = app.node.tryGetContext('vpcId')
const rawPub2SlackParams = app.node.tryGetContext('pub2SlackParams')

let opsBackupCommand: any
if(opsBackupCommandString) {
  opsBackupCommand = JSON.parse(opsBackupCommandString)
}


//pub2SlackParams
let pub2SlackParams: string[] = []

if(rawPub2SlackParams) {
  pub2SlackParams = JSON.parse(rawPub2SlackParams);
}

// WhiteListIps
// JSON formated, ie, `-c whiteListIps='["172.9.20.12", "168.0.0.1"]'`
const rawWhiteListCIDRs = app.node.tryGetContext('whiteListCIDRs')
let whiteListCIDRs: string[] = []

if(rawWhiteListCIDRs) {
  whiteListCIDRs = JSON.parse(rawWhiteListCIDRs);
}

// allow app ingress
// JSON formated, ie, `-c allowIngress='[{"securityGroup":"sg-klsjdfsdf","tcpPort":3306}]'`
const rawAllowIngress = app.node.tryGetContext('allowIngress')
let allowIngress: AllowIngress[]|undefined

if(rawAllowIngress) {
  allowIngress = JSON.parse(rawAllowIngress);
}

let rootStackName = `${appName}-${envName}-${stackVersion}`

console.log(
 `${envName.toLowerCase()}-${stackVersion}.${domainZoneName}`
)

new EcsPipelineStack(app, rootStackName, {
  appName,
  pub2SlackParams,
  allowIngress: allowIngress,
  assetBucketName,
  certificateArns,
  codecommitBranch,
  codecommitRepo,
  domainName: `${envName.toLowerCase()}-${stackVersion}.${domainZoneName}`,
  domainZoneId,
  domainZoneName,
  envName,
  envParameterPath: `/${appName}/${envName}`,
  instanceKeyName,
  s3ArtifactBucketName,
  opsBackupCommand,
  vpcId,
  whiteListCIDRs,
  env: {
    account: awsAccount,
    region: awsRegion,
  },
})

app.synth()
