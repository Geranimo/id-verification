'use strict'
const AWS = require('aws-sdk');
var SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const axios = require('axios').default;
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({
    serviceName: 'imageVerificationService',
    enabled: true,
  });

const SQS_URL = process.env.SQS_URL;

async function publishToSqs(userId, state, stageName) {
  const message = {
    userId: userId,
    stageName: stageName,
    stageStatus: state
  }
  var params = {
    DelaySeconds: 10,
    MessageBody: JSON.stringify(message),
    QueueUrl: SQS_URL
  };
  await SQS.sendMessage(params).promise();
}

const lambdaHandler = async (event) => {
  tracer.putAnnotation('component', 'sendOutNotification');
  console.log("request:", JSON.stringify(event, undefined, 2));
  const userId = event.Payload.userId

  if (event.Payload.stageName === 'FACE_COMPARISON_RESULT') {
    const publishToTheQueue = await publishToSqs(userId, event.Payload.faceComparisonSimilarityScore, event.Payload.stageName);
    let data;
    console.log("Face similarity score =>" + event.Payload.faceComparisonSimilarityScore);
    if (event.Payload.faceComparisonSimilarityScore > 50 && event.Payload.faceComparisonSimilarityScore < 90) {
      data = {
        stageName: event.Payload.stageName,
        stageStatus: 'MANUAL_REVIEW',
        score: event.Payload.faceComparisonSimilarityScore,
        timestamp: event.Payload.timestamp
      }
    } else if (event.Payload.faceComparisonSimilarityScore < 50) {
      data = {
        stageName: event.Payload.stageName,
        stageStatus: 'VERIFICATION_FAILED',
        score: event.Payload.faceComparisonSimilarityScore,
        timestamp: event.Payload.timestamp
      }
    }
    else {
      data = {
        stageName: event.Payload.stageName,
        stageStatus: 'PASS',
        score: event.Payload.faceComparisonSimilarityScore,
        timestamp: event.Payload.timestamp
      }
    }
    console.log("Data of the update request =>", JSON.stringify(data));
    var config = {
      method: 'put',
      url: 'https://xkzd3319q2.execute-api.eu-central-1.amazonaws.com/prod/user/288ea118-fe12-4485-955e-264f3b2d2c1b',
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };

    const reponse = await axios(config);
    console.log('Response from the log =>' + reponse);

  } else {
    const publishToTheQueue = await publishToSqs(userId, event.Payload.stageStatus, event.Payload.stageName);
    const data = {
      stageName: event.Payload.stageName,
      stageStatus: event.Payload.stageStatus, 
      timestamp: event.Payload.timestamp
    }

    var config = {
      method: 'put',
      url: 'https://xkzd3319q2.execute-api.eu-central-1.amazonaws.com/prod/user/288ea118-fe12-4485-955e-264f3b2d2c1b',
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };

    const reponse = await axios(config);
    console.log('Response from the log =>' + reponse);
  }

  return {
    userId: userId
  };
};

exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));