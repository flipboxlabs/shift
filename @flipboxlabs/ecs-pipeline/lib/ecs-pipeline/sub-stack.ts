import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';

export interface IBaseEcsPipelineStackProps extends cdk.StackProps {
  logGroup: logs.LogGroup
  region: string
}

export abstract class SubStack extends cdk.Construct {
  public idPrefix: string
}