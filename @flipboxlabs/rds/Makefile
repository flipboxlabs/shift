#!make
AWS_DEFAULT_PROFILE := 'ADD PROFILE HERE'

$(shell aws-assume temp-creds --profile ${AWS_DEFAULT_PROFILE} ${PWD}/.env)

include .env
export $(shell sed 's/=.*//' .env)

build: 
	npm run build

bootstrap:
	cdk bootstrap ${AWS_ACCOUNT_ID}/${AWS_DEFAULT_REGION}