'use strict'
const AWS = require('aws-sdk');
const STATEMACHINE_ARN = process.env.STATEMACHINE_ARN;

exports.handler = async function (event) {
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