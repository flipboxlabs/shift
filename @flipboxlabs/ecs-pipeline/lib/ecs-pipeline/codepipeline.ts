import * as codebuild from '@aws-cdk/aws-codebuild'
import * as codecommit from '@aws-cdk/aws-codecommit'
import * as codepipeline from '@aws-cdk/aws-codepipeline'
import * as eventTargets from '@aws-cdk/aws-events-targets'
import * as actions from '@aws-cdk/aws-codepipeline-actions'
import * as lambda from '@aws-cdk/aws-lambda'
import * as ecs from '@aws-cdk/aws-ecs'
import * as s3 from '@aws-cdk/aws-s3'
import * as cdk from '@aws-cdk/core'
import { InvalidateCfDistro } from './lambda/invalidate-cf-distro'
import { IBaseEcsPipelineStackProps, SubStack } from './sub-stack'
import { Pub2Slack } from './lambda/pub2slack'

interface ICodePipelineStackProps extends IBaseEcsPipelineStackProps {
  s3BucketName: string
  repoName: string
  repoBranchName: string
  codecommit: codecommit.IRepository
  codebuild: codebuild.IProject
  queueEcsService: ecs.Ec2Service
  webEcsService: ecs.Ec2Service
  domainName: string
  distributionId?: string
  pub2SlackParams?: string[]
}

export class CodePipelineStack extends SubStack {
  public idPrefix: string = 'CodePipeline'

  //resources
  public pipeline: codepipeline.Pipeline

  constructor(
    scope: cdk.Construct,
    id: string,
    props: ICodePipelineStackProps
  ) {
    super(scope, id)

    const stack = cdk.Stack.of(this)

    const artifactBucket = s3.Bucket.fromBucketName(
      this,
      `${this.idPrefix}ArtifactBucket`,
      props.s3BucketName
    )

    this.pipeline = new codepipeline.Pipeline(
      this,
      `${this.idPrefix}Pipeline`,
      {
        pipelineName: stack.stackName,
        artifactBucket: artifactBucket
      }
    )

    const repo = codecommit.Repository.fromRepositoryName(
      this,
      `${this.idPrefix}Repo`,
      props.repoName
    )

    // STAGE - SOURCE
    const sourcePipelineArtifact = new codepipeline.Artifact('Source')
    const sourceStage: codepipeline.StageOptions = {
      stageName: 'Source',
      actions: [
        new actions.CodeCommitSourceAction({
          actionName: 'CodeCommit',
          repository: repo,
          branch: props.repoBranchName,
          output: sourcePipelineArtifact
        })
      ]
    }

    this.pipeline.addStage(sourceStage)

    // STAGE - BUILD
    const buildPipelineArtifact = new codepipeline.Artifact('Build')
    const buildStage: codepipeline.StageOptions = {
      stageName: 'Build',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CodeBuild',
          input: sourcePipelineArtifact,
          project: props.codebuild,
          outputs: [buildPipelineArtifact]
        })
      ]
    }
    this.pipeline.addStage(buildStage)

    // STAGE - DEPLOY
    let deployActions: codepipeline.IAction[] = [
      new actions.EcsDeployAction({
        actionName: 'WebEcsDeploy',
        runOrder: 1,
        service: props.webEcsService,
        // TODO - change the web.json to imagedefinitions.json
        imageFile: new codepipeline.ArtifactPath(
          buildPipelineArtifact,
          'web.json'
        )
      }),
      new actions.EcsDeployAction({
        actionName: 'QueueEcsDeploy',
        runOrder: 1,
        service: props.queueEcsService,
        // TODO - change the queue.json to imagedefinitions.json
        imageFile: new codepipeline.ArtifactPath(
          buildPipelineArtifact,
          'queue.json'
        )
      })
    ]
    if (props.distributionId) {
      const invalidateDistro = new InvalidateCfDistro(
        this,
        `InvalidateDistroFunction`,
        {
          distributionId: props.distributionId
        }
      )

      deployActions.push(
        new actions.LambdaInvokeAction({
          actionName: 'InvalidateDistroAction',
          runOrder: 2,
          lambda: invalidateDistro
        })
      )
    }

    const deployStage: codepipeline.StageOptions = {
      stageName: 'Deploy',
      actions: deployActions
    }

    this.pipeline.addStage(deployStage)

    if (props.pub2SlackParams) {
      const pub2SlackRule = this.pipeline.onStateChange(`PipelineSuccess`, {
        description: `Pipeline Succeeded: ${this.pipeline.pipelineName}`
      })
      pub2SlackRule.addEventPattern({
        detail: {
          state: ['SUCCEEDED', 'FAILED']
        }
      })

      let environment: {
        [key: string]: string
      } = {}

      let resources: string[] = []

      for (let i in props.pub2SlackParams) {
        // add paths to the parameter here, then set them as env vars
        environment[`${Pub2Slack.HOOK_URL_CONST}_${i}`] =
          props.pub2SlackParams[i]

        // add paths to resources the function is allowed to pull
        resources.push(`arn:aws:ssm:*:*:parameter${props.pub2SlackParams[i]}`)
      }

      /**
       * Create function for sending messages to slack
       * @type {lambda.Function}
       */
      const pub2Slack = new Pub2Slack(this, `Pub2SlackFunc`, {
        appUrl: props.domainName,
        environment,
        allowResources: resources
      })

      pub2SlackRule.addTarget(new eventTargets.LambdaFunction(pub2Slack))

      // Allow the event rule to invoke the function
      new lambda.CfnPermission(this, 'Pub2SlackPerm', {
        functionName: pub2Slack.functionName,
        sourceArn: pub2SlackRule.ruleArn,
        action: 'lambda:InvokeFunction',
        principal: 'events.amazonaws.com'
      })
    }
  }
}
