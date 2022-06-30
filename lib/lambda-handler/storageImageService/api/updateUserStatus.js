'use strict'
const AWS = require('aws-sdk');
const {Tracer, captureLambdaHandler} = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({ serviceName: 'imageStorageService' });

async function updateUserMetadataInfo(userId, stageName, status, faceSimilarityScore, timestamp) {
  console.log("Userid =>" + `${userId}`);
  const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
  const item = {
    "userId": userId,
  }
  const score = isNaN(faceSimilarityScore) ? '' : faceSimilarityScore
  console.log("Item params for the request", JSON.stringify(item));
  const response = await dynamoDbClient.update({
    TableName: process.env.METADATA_TABLE_NAME,
    Key: {
      userId: userId
    },
    UpdateExpression: "set #status = :x, #stageName = :y, #similarityScore = :z, #timestamp = :t",
    ExpressionAttributeNames: {
      "#status": "status",
      "#stageName": "stageName",
      "#similarityScore": "similarityScore",
      "#timestamp": "timestamp"
    },
    ExpressionAttributeValues: {
      ":x": status,
      ":y": stageName,
      ":z": score,
      ":t": timestamp
    }
  }).promise();
  return response;
}

const lambdaHandler = async  (event) => {
  tracer.putAnnotation('component', 'updateUserStatus');
  let response;
  try {
    console.log("request:", JSON.stringify(event, undefined, 2));
    const requestBody = JSON.parse(event.body);
    const userId = event.pathParameters.userId
    const processStageName = requestBody.stageName;
    const processStageStatus = requestBody.stageStatus;
    const faceSimilarityScore = requestBody.score;
    const timestamp = requestBody.timestamp;

    const updateUserMetadata = await updateUserMetadataInfo(userId, processStageName, processStageStatus, faceSimilarityScore, timestamp);
    console.log(`User data ${JSON.stringify(updateUserMetadata.Item)}`)
    response = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*"
      },
      body: JSON.stringify(updateUserMetadata.Item)
    }
  } catch (error) {
    console.log("Errored while processing the update request => " + JSON.stringify(error))
    response = {
      statusCode: 400,
      body: `Errored while processing the storage request for ${userId}\n`
    };
  }
  return response;
};


exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));