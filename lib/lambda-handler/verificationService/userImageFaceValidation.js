'use strict'
const AWS = require('aws-sdk');
const S3_BUCKET = process.env.S3_BUCKET;

exports.handler = async function (event) {
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