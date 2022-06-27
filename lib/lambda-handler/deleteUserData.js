'use strict'
const AWS = require('aws-sdk');
const S3 = new AWS.S3({ apiVersion: '2006-03-01' });
const USER_IMAGE_NAME = 'userImage';
const USER_DOCUMENT_IMAGE_NAME = 'userDocumentImage';
const BUCKET_NAME = process.env.BUCKET_NAME;

// async function deleteUserDataInDynamoDb(userId) {
//   console.log("Userid =>" + `${userId}`);
//   const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
//   const item = {
//     "userId": userId,
//   }

//   console.log("Item params for the request", JSON.stringify(item));
//   const response = await dynamoDbClient.delete({
//     TableName: process.env.METADATA_TABLE_NAME,
//     Key: {
//       userId: userId
//     },
//   }).promise();
//   return response;
// }

async function deleteUserImagesInS3(userId) {
  const objectKey = `${userId}/${USER_IMAGE_NAME}.jpg`;
  console.log("deleteing user image =>" + `${objectKey}`);
  var params = {
    Bucket: BUCKET_NAME,
    Key: objectKey,
  };
  return S3.deleteObject(params).promise();
}
async function deleteUserDocumentImagesInS3(userId) {
  const objectKey = `${userId}/${USER_DOCUMENT_IMAGE_NAME}.jpg`;
  console.log("deleteing user document image =>" + `${objectKey}`);
  var params = {
    Bucket: BUCKET_NAME,
    Key: objectKey,
  };
  return S3.deleteObject(params).promise();
}


exports.handler = async function (event) {
  let response;
  const userId = event.pathParameters.userId
  try {
    console.log("request:", JSON.stringify(event, undefined, 2));
    const s3DeleteUserImageResponse = await deleteUserImagesInS3(userId);
    const s3DeleteUserDocumentImageResponse = await deleteUserDocumentImagesInS3(userId);
    // const deleteUserDataResponse = await deleteUserDataInDynamoDb(userId);
    
    console.log(`User data ${JSON.stringify(deleteUserDataResponse.Item)}`)
    response = {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
    }
  } catch (error) {
    console.log("Errored while processing the user data request => " + JSON.stringify(error))
    response = {
      statusCode: 400,
      body: `Errored while processing the user data request for ${userId}\n`
    };
  }
  return response;
};