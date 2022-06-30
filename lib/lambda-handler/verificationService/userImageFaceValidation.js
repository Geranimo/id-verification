'use strict'
const AWS = require('aws-sdk');
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({
    serviceName: 'imageVerificationService',
    enabled: true
  });

const S3_BUCKET = process.env.S3_BUCKET;

const lambdaHandler = async (event) => {
    tracer.putAnnotation('component', 'userImageFaceValidation');
    
    console.log("request:", JSON.stringify(event, undefined, 2));
    const rekognition = new AWS.Rekognition();
    const params = {
        Image: {
            S3Object: {
                Bucket: S3_BUCKET,
                Name: `${event.userId}/userImage.jpg`
            },
        },
        Attributes: ['ALL']
    }

    const faceDetectionResponse = await rekognition.detectFaces(params).promise();

    console.log("Facedetection response =>  " + JSON.stringify(faceDetectionResponse));
    let VALIDATION_STATE = 'FAIL';

    if (faceDetectionResponse.FaceDetails) {
        if (faceDetectionResponse.FaceDetails.length > 0 && faceDetectionResponse.FaceDetails[0].Confidence > 90) {
            VALIDATION_STATE = 'PASS'
        }
    }

    return {
        stageName: 'USER_IMAGE_VALIDATION',
        stageStatus: VALIDATION_STATE,
        userId: event.userId, 
        timestamp: Date.now()
    };
};

exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));