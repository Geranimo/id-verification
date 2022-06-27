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
                Name: `${event.Payload.userId}/userDocumentImage.jpg`
            },
        },
        MaxLabels: 10
    }

    const labelsDetectionResponse = await rekognition.detectLabels(params).promise();

    console.log("Facedetection response =>  " + JSON.stringify(labelsDetectionResponse));
    let VALIDATION_STATE = 'FAIL';

    if (labelsDetectionResponse.Labels) {
        if (labelsDetectionResponse.Labels.length > 0 ) {
            const documentLabels = labelsDetectionResponse.Labels.filter(item => item.Name === "Document" && item.Confidence > 90);
            if(documentLabels.length > 0){
                VALIDATION_STATE = 'PASS'
            }else{
                VALIDATION_STATE = 'FAIL'
            }
        }
    }
    
    return {
        stageName: 'DOCUMENT_IMAGE_VALIDATION', 
        stageStatus: VALIDATION_STATE,
        userId: `${event.Payload.userId}`,
        timestamp: Date.now()
    };
};