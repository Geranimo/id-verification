'use strict'
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');
const AWS = require('aws-sdk');

const tracer = new Tracer({
  serviceName: 'imageStorageService',
  enabled: true
});

async function getUserMetadataInfo(userId) {
  console.log("Userid =>" + `${userId}`);
  const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
  const item = {
    "userId": userId,
  }

  console.log("Item params for the request" , JSON.stringify(item));
  const response = await dynamoDbClient.get({
    TableName: process.env.METADATA_TABLE_NAME,
    Key: {
      userId: userId
    },
  }).promise();
  return response;
}

const lambdaHandler = async (event) => {
  tracer.putAnnotation('component', 'getUserStatus');
  let response;
  try {
    console.log("request:", JSON.stringify(event, undefined, 2));
    const requestBody = JSON.parse(event.body);
    const userId = event.pathParameters.userId
    const getUserMetadata = await getUserMetadataInfo(userId);
    console.log(`User data ${JSON.stringify(getUserMetadata.Item)}`)
    response = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*"
      },
      body: JSON.stringify(getUserMetadata.Item)
    }
  } catch (error) {
    console.log("Errored while processing the request => " + JSON.stringify(error))
    response = {
      statusCode: 400,
      body: `Errored while processing the storage request for ${userId}\n`
    };
  }
  return response;
};

exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));