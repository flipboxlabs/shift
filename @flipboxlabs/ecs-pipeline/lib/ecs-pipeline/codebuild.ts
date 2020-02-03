import * as codebuild from '@aws-cdk/aws-codebuild'
import * as iam from '@aws-cdk/aws-iam'
import * as cdk from '@aws-cdk/core'
import { IBaseEcsPipelineStackProps, SubStack } from './sub-stack'
import { PolicyStatement } from '@aws-cdk/aws-iam'

interface ICodeBuildStackProps extends IBaseEcsPipelineStackProps {
  envName: string
  envParameterPath: string
  repositoryName: string
  repositoryUri: string
  s3ArtifactBucketName: string
  region: string
  account: string
}

export class CodeBuildStack extends SubStack {
  public idPrefix: string = 'CodeBuild'

  public buildProject: codebuild.Project
  constructor(scope: cdk.Construct, id: string, props: ICodeBuildStackProps) {
    super(scope, id)

    this.buildProject = new codebuild.PipelineProject(
      this,
      `${this.idPrefix}Project`,
      {
        projectName: cdk.Stack.of(this).stackName,
        role: new iam.Role(this, `CodeBuildServicePolicy`, {
          assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
          inlinePolicies: {
            rootDoc: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                    'logs:DescribeLogStreams',
                    'ecr:GetAuthorizationToken'
                  ],
                  resources: ['*']
                }),
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:PutObjectAcl',
                    's3:PutObjectTagging',
                    's3:PutObjectVersionAcl',
                    's3:PutObjectVersionTagging',
                    's3:GetObjectVersion',
                    's3:ListBucket'
                  ],
                  resources: [`arn:aws:s3:::${props.s3ArtifactBucketName}/*`]
                }),
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath'
                  ],
                  resources: [
                    `arn:aws:ssm:*:*:parameter${props.envParameterPath}`,
                    `arn:aws:ssm:*:*:parameter${props.envParameterPath}/*`,
                  ]
                }),
                new PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  actions: [
                    'ecr:GetDownloadUrlForLayer',
                    'ecr:BatchGetImage',
                    'ecr:BatchCheckLayerAvailability',
                    'ecr:PutImage',
                    'ecr:InitiateLayerUpload',
                    'ecr:UploadLayerPart',
                    'ecr:CompleteLayerUpload'
                  ],
                  resources: [
                    `arn:aws:ecr:${props.region}:${props.account}:repository/${props.repositoryName}`
                  ]
                })
              ]
            })
          }
        }),
        environment: {
          privileged: true,
          computeType: codebuild.ComputeType.SMALL,
          buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_DOCKER_18_09_0,
          environmentVariables: {
            AWS_DEFAULT_REGION: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: props.region
            },
            REPOSITORY_URI: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: props.repositoryUri
            },
            ENV_NAME: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: props.envName
            }
          }
        }
      }
    )
  }
}
