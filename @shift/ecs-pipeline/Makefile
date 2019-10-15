#!make
AWS_DEFAULT_PROFILE := 'ADD PROFILE HERE'

$(shell aws-assume temp-creds --profile ${AWS_DEFAULT_PROFILE} ${PWD}/.env)

include .env
export $(shell sed 's/=.*//' .env)

build: 
	npm run build

bootstrap:
	cdk bootstrap ${AWS_ACCOUNT_ID}/${AWS_DEFAULT_REGION}

deploy-codecommit: build
	cdk deploy -a "npx ts-node bin/codecommit-repo-app.ts" -c repositoryName=${REPOSITORY_NAME}

destroy-codecommit: build
	cdk -a "npx ts-node bin/s3-devops-bucket-app.ts" -c repositoryName=${REPOSITORY_NAME}

deploy-devops-bucket: build
	cdk deploy -a "npx ts-node bin/s3-devops-bucket-app.ts" -c bucketName=${DEVOPS_BUCKET_NAME}

deploy-assets-bucket: build
	cdk deploy -a "npx ts-node bin/s3-assets-bucket-app.ts" -c bucketName=${ASSET_BUCKET_NAME}

destroy-devops-bucket: build
	cdk destroy -a "npx ts-node bin/s3-devops-bucket-app.ts" -c bucketName=${DEVOPS_BUCKET_NAME}

destroy-assets-bucket: build
	cdk destroy -a "npx ts-node bin/s3-assets-bucket-app.ts" -c bucketName=${ASSET_BUCKET_NAME}

deploy-vpc: build
	cdk deploy -a "npx ts-node bin/vpc-app.ts" -c stackName=${VPC_STACK_NAME}
destroy-vpc: build
	cdk destroy -a "npx ts-node bin/vpc-app.ts" -c stackName=${VPC_STACK_NAME}

deploy-aurora-mysql: build
	cdk deploy -a "npx ts-node bin/aurora-mysql-cluster-app.ts" \
		-c appName=${APP_NAME} \
		-c envName=${ENV_NAME} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c vpcId=${VPC_ID} \
		-c defaultDatabaseName=${RDS_DEFAULT_DATABASE} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}
destroy-aurora-mysql: build
	cdk destroy -a "npx ts-node bin/aurora-mysql-cluster-app.ts" \
		-c appName=${APP_NAME} \
		-c envName=${ENV_NAME} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c vpcId=${VPC_ID} \
		-c defaultDatabaseName=${RDS_DEFAULT_DATABASE} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}
deploy-bastion-host: build
	cdk deploy -a "npx ts-node bin/bastion-host-app.ts" \
		-c appName=${APP_NAME} \
		-c envName=${ENV_NAME} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c allowIngress=${ALLOW_INGRESS} \
		-c devopsBucketName=${DEVOPS_BUCKET_NAME} \
		-c devopsAuthorizedKeysPrefix=${SSH_AUTHORIZED_KEYS_PREFIX} \
		-c vpcId=${VPC_ID} \
		-c keyName=${INSTANCE_KEY_NAME} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}

destroy-bastion-host: build
	cdk destroy -a "npx ts-node bin/bastion-host-app.ts" \
		-c appName=${APP_NAME} \
		-c envName=${ENV_NAME} \
	  -c awsAccount=${AWS_ACCOUNT_ID} \
	  -c awsRegion=${AWS_DEFAULT_REGION} \
		-c allowIngress=${ALLOW_INGRESS} \
		-c devopsBucketName=${DEVOPS_BUCKET_NAME} \
		-c devopsAuthorizedKeysPrefix=${SSH_AUTHORIZED_KEYS_PREFIX} \
		-c vpcId=${VPC_ID} \
		-c keyName=${INSTANCE_KEY_NAME} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}

destroy-ecs-pipeline: build
	cdk destroy -a "npx ts-node bin/ecs-pipeline-app.ts" --trace '*' \
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
		-c domainName=${DOMAIN_NAME} \
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
	cdk deploy -a "npx ts-node bin/ecs-pipeline-app.ts" --require-approval never --trace '*' \
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
		-c domainName=${DOMAIN_NAME} \
		-c domainZoneName=${DOMAIN_ZONE_NAME} \
		-c domainZoneId=${DOMAIN_ZONE_ID} \
		-c instanceKeyName=${INSTANCE_KEY_NAME} \
		-c s3ArtifactBucketName=${DEVOPS_BUCKET_NAME}  \
		-c stackVersion=${STACK_VERSION} \
		-c vpcId=${VPC_ID} \
		-c opsBackupCommand=${OPS_BACKUP_COMMAND} \
		-c pub2SlackParams=${PUB_2_SLACK_PARAMS} \
		-c whiteListCIDRs=${WHITE_LIST_CIDRS}
