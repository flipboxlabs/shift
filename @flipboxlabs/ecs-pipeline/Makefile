#!make
AWS_DEFAULT_PROFILE := 'ADD PROFILE HERE'

$(shell aws-assume temp-creds --profile ${AWS_DEFAULT_PROFILE} ${PWD}/.env)

include .env
export $(shell sed 's/=.*//' .env)

build: 
	npm run build

bootstrap:
	cdk bootstrap ${AWS_ACCOUNT_ID}/${AWS_DEFAULT_REGION}

destroy-ecs-pipeline: build
	cdk destroy -a "./bin/ecs-pipeline-app.js" --trace '*' \
		-c allowIngress=${ALLOW_INGRESS} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c appName=${APP_NAME} \
		-c assetBucketName=${ASSET_BUCKET_NAME} \
		-c envName=${ENV_NAME}  \
		-c envParameterPath=${ENV_PARAMETER_NAME} \
		-c certificateArns=${CERTIFICATE_ARNS} \
		-c codecommitBranch=${CODECOMMIT_BRANCH} \
		-c codecommitRepo=${CODECOMMIT_REPO} \
		-c domainZoneName=${DOMAIN_ZONE_NAME} \
		-c domainZoneId=${DOMAIN_ZONE_ID} \
		-c instanceKeyName=${INSTANCE_KEY_NAME}  \
		-c s3ArtifactBucketName=${DEVOPS_BUCKET_NAME}  \
		-c stackVersion=${STACK_VERSION} \
		-c vpcId=${VPC_ID} \
		-c opsBackupCommand=${OPS_BACKUP_COMMAND} \
		-c pub2SlackParams=${PUB_2_SLACK_PARAMS} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}
	
deploy-ecs-pipeline: build
	cdk deploy -a "./bin/ecs-pipeline-app.js" --require-approval never --trace '*' \
		-c allowIngress=${ALLOW_INGRESS} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c appName=${APP_NAME} \
		-c assetBucketName=${ASSET_BUCKET_NAME} \
		-c envName=${ENV_NAME} \
		-c envParameterPath=${ENV_PARAMETER_NAME} \
		-c certificateArns=${CERTIFICATE_ARNS} \
		-c codecommitBranch=${CODECOMMIT_BRANCH} \
		-c codecommitRepo=${CODECOMMIT_REPO} \
		-c domainZoneName=${DOMAIN_ZONE_NAME} \
		-c domainZoneId=${DOMAIN_ZONE_ID} \
		-c instanceKeyName=${INSTANCE_KEY_NAME} \
		-c s3ArtifactBucketName=${DEVOPS_BUCKET_NAME}  \
		-c stackVersion=${STACK_VERSION} \
		-c vpcId=${VPC_ID} \
		-c opsBackupCommand=${OPS_BACKUP_COMMAND} \
		-c pub2SlackParams=${PUB_2_SLACK_PARAMS} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}
