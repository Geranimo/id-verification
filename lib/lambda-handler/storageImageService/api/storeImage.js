'use strict'
const AWS = require('aws-sdk');
const S3 = new AWS.S3({ apiVersion: '2006-03-01' });
var SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const USER_IMAGE_NAME = 'userImage';
const USER_DOCUMENT_IMAGE_NAME = 'userDocumentImage';
const BUCKET_NAME = 'id-veriff-image-store';
const SQS_URL = 'https://sqs.eu-central-1.amazonaws.com/702492203129/stored-images-queue';
const {Tracer, captureLambdaHandler} = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({ serviceName: 'imageStorageService' });


async function uploadToS3(imageFile, userId, fileName) {
  var params = {
    Body: Buffer.from(imageFile, 'base64'),
    Bucket: BUCKET_NAME,
    Key: `${userId}/${fileName}.jpg`
  };
  return S3.putObject(params).promise();
}

async function publishToSqs(userId) {
  const message = {
    userId: userId,
    userImageS3Key: `s3://${BUCKET_NAME}/${userId}/${USER_IMAGE_NAME}.jpg`,
    userDocumentImageS3Key: `s3://${BUCKET_NAME}/${userId}/${USER_DOCUMENT_IMAGE_NAME}.jpg`,
  }
  var params = {
    DelaySeconds: 10,
    MessageBody: JSON.stringify(message),
    QueueUrl: SQS_URL
  };
  await SQS.sendMessage(params).promise();
}

async function storeInDynamoDb(userId, startTime) {
  console.log("Userid =>" + `${userId}`);
  const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
  const item = {
    "userId": userId,
    "userImageS3Key": `s3://${BUCKET_NAME}/${userId}/${USER_IMAGE_NAME}.jpg`,
    "userDocumentImageS3Key": `s3://${BUCKET_NAME}/${userId}/${USER_DOCUMENT_IMAGE_NAME}.jpg`,
    "status": "PASS",
    "stageName": "REQUEST_RECEIVED",
    "startTime": startTime
  }
  console.log("Item params for the request", JSON.stringify(item));
  const response = await dynamoDbClient.put({
    TableName: process.env.METADATA_TABLE_NAME,
    Item: item,
  }).promise();
}

const lambdaHandler = async function (event) {
  tracer.putAnnotation('component', 'storageImage');
  let response;
  try {
    console.log("request:", JSON.stringify(event, undefined, 2));
    const requestBody = JSON.parse(event.body);
    const userId = event.pathParameters.userId
    const startTime = Date.now()
    const userDocumentImageUploadResponse = await uploadToS3(requestBody.userDocumentImage, userId, USER_DOCUMENT_IMAGE_NAME)
    const userImageUploadResponse = await uploadToS3(requestBody.userImage, userId, USER_IMAGE_NAME)
    const publishToTheQueue = await publishToSqs(userId);
    const storeInMeatadata = await storeInDynamoDb(userId, startTime);
    response = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*"
      },
      body: `User image successfully stored ${userId}\n`
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