'use strict'
const AWS = require('aws-sdk');
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const middy = require('@middy/core');

const tracer = new Tracer({
    serviceName: 'imageVerificationService',
    enabled: true,
  });

const S3_BUCKET = process.env.S3_BUCKET;

const lambdaHandler = async (event) => {
    tracer.putAnnotation('component', 'idFaceVerification');
    console.log("request:", JSON.stringify(event, undefined, 2));
    const rekognition = new AWS.Rekognition();

    const sourceImage = {
        S3Object: {
            Bucket: S3_BUCKET,
            Name: `${event.Payload.userId}/userDocumentImage.jpg`
        },
    }

    const targetImage = {
        S3Object: {
            Bucket: S3_BUCKET,
            Name: `${event.Payload.userId}/userImage.jpg`
        },
    }

    const parameters = {
        SourceImage: sourceImage,
        TargetImage: targetImage,
        SimilarityThreshold: 90

    }

    const compareFacesResponse = await rekognition.compareFaces(parameters).promise();

    console.log("CompareFaces response =>  " + JSON.stringify(compareFacesResponse));
    let similarityScore = 0;

    if (compareFacesResponse.FaceMatches) {
        if (compareFacesResponse.FaceMatches.length > 0) {
            return {
                stageName: 'FACE_COMPARISON_RESULT',
                userId: `${event.Payload.userId}`,
                faceComparisonSimilarityScore: compareFacesResponse.FaceMatches[0].Similarity,
                timestamp: Date.now()
            };
        }
    }
    
    return {
        stageName: 'FACE_COMPARISON_RESULT',
        userId: `${event.Payload.userId}`,
        faceComparisonSimilarityScore: similarityScore,
        timestamp: Date.now()
    }
};

exports.handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer));