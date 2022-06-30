'use strict'
const AWS = require('aws-sdk');
const STATEMACHINE_ARN = process.env.STATEMACHINE_ARN;

const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({
    serviceName: 'imageVerificationService',
    enabled: true,
  });


const lambdaHandler = async (event) => {
  tracer.putAnnotation('component', 'imageVerificationConsumer');
  console.log("request:", JSON.stringify(event, undefined, 2));
  var stepfunctions = new AWS.StepFunctions()
  for (const record of event.Records) {
    const { body } = record;
    console.log(body);
    await stepfunctions.startExecution({stateMachineArn: STATEMACHINE_ARN, 
    input: body}).promise();
  }
  return {};
};

exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));