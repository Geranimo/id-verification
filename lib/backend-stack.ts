import * as path from 'path'
import { Stack, StackProps } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Table, AttributeType, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { AuthorizationType, LambdaIntegration, RestApi, Cors } from 'aws-cdk-lib/aws-apigateway';
import { Function, Runtime, Code, Tracing } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StateMachine, Pass, Choice, Condition, Fail } from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // new HelloWorld(this, 'hello-world');

    const imageStoreBucketName = 'id-veriff-image-store';

    const s3Bucket = this.createS3Bucket(imageStoreBucketName);

    const idVeriffMetadataTable = this.createMetadataTable();

    const veriffApi = new RestApi(this, 'id-veriff', {
      description: 'id-veriff-image-upload',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS // this is also the default
      }
    });
    veriffApi.root.addMethod('ANY');
    const idupload = veriffApi.root.addResource('idupload').addResource('{userId}');
    const getUserStatus = veriffApi.root.addResource('user').addResource('{userId}');

    const getUserStatusFunction = new Function(this, 'getUserStatusFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'getUserStatus.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/storageImageService/api')),
      functionName: 'get-user-status',
      tracing: Tracing.ACTIVE,
      environment: {
        METADATA_TABLE_NAME: idVeriffMetadataTable.tableName
      }
    });

    getUserStatusFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'dynamodb:ListTables',
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:GetRecords',
        'dynamodb:GetItem',
      ],
      resources:
        [
          idVeriffMetadataTable.tableArn
        ],
      effect: Effect.ALLOW
    }))
    getUserStatusFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
      ],
      resources:
        [
          '*'
        ],
      effect: Effect.ALLOW
    }))

    const updateUserStatusFunction = new Function(this, 'updateUserStatusFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'updateUserStatus.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/storageImageService/api')),
      functionName: 'update-user-status',
      tracing: Tracing.ACTIVE,
      environment: {
        METADATA_TABLE_NAME: idVeriffMetadataTable.tableName
      }
    });

    updateUserStatusFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'dynamodb:ListTables',
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:GetRecords',
        'dynamodb:GetItem',
        'dynamodb:UpdateItem'
      ],
      resources:
        [
          idVeriffMetadataTable.tableArn
        ],
      effect: Effect.ALLOW
    }))

    const deleteUserDataFunction = new Function(this, 'deleteUserDataFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'deleteUserData.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/storageImageService/api')),
      functionName: 'delete-user-data',
      tracing: Tracing.ACTIVE,
      environment: {
        METADATA_TABLE_NAME: idVeriffMetadataTable.tableName,
        BUCKET_NAME: s3Bucket.bucketName
      }
    });

    deleteUserDataFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'dynamodb:ListTables',
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:GetRecords',
        'dynamodb:GetItem',
        'dynamodb:DeleteItem',
        'dynamodb:UpdateItem'
      ],
      resources:
        [
          idVeriffMetadataTable.tableArn
        ],
      effect: Effect.ALLOW
    }))


    deleteUserDataFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        's3:ListBucket',
        's3:DeleteObject',
        's3:GetObject',
      ],
      resources:
        [
          `${s3Bucket.bucketArn}/*`
        ],
      effect: Effect.ALLOW
    }))

    const idUploadFunction = new Function(this, 'Function', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'storeImage.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/storageImageService/api')),
      functionName: 'id-upload',
      tracing: Tracing.ACTIVE,
      environment: {
        METADATA_TABLE_NAME: idVeriffMetadataTable.tableName
      }
    });

    idUploadFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
      ],
      resources:
        [
          '*'
        ],
      effect: Effect.ALLOW
    }))
    idUploadFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        's3:ListBucket',
        's3:PutObject',
      ],
      resources:
        [
          'arn:aws:s3:::id-veriff-image-store/*'
        ],
      effect: Effect.ALLOW
    }))


    const idUploadLambdaIntegration: LambdaIntegration = new LambdaIntegration(idUploadFunction);
    idupload.addMethod('POST', idUploadLambdaIntegration, {
      authorizationType: AuthorizationType.NONE,
    });

    const getUserStatusFunctionRequest: LambdaIntegration = new LambdaIntegration(getUserStatusFunction);
    getUserStatus.addMethod('GET', getUserStatusFunctionRequest, {
      authorizationType: AuthorizationType.NONE,
    });

    const updateUserStatusFunctionRequest: LambdaIntegration = new LambdaIntegration(updateUserStatusFunction);
    getUserStatus.addMethod('PUT', updateUserStatusFunctionRequest, {
      authorizationType: AuthorizationType.NONE,
    });

    const deleteUserDataRequest: LambdaIntegration = new LambdaIntegration(deleteUserDataFunction);
    getUserStatus.addMethod('DELETE', deleteUserDataRequest, {
      authorizationType: AuthorizationType.NONE,
    });



    //create the queue to post messages when the images are stored
    const storedImagesQueueDlq = new Queue(this, 'dlq-stored-images');
    const storedImagesQueue = new Queue(this, 'stored-images-queue', {
      queueName: "stored-images-queue",
      deadLetterQueue: {
        queue: storedImagesQueueDlq,
        maxReceiveCount: 3,
      }
    });

    // create qeue for sending out notifications
    const sendNotificationsQueueDlq = new Queue(this, 'dlq-send-notifications-queue');
    const sendNotificationsQueue = new Queue(this, 'send-notifications-queue', {
      queueName: "send-notifications-queue",
      deadLetterQueue: {
        queue: sendNotificationsQueueDlq,
        maxReceiveCount: 3,
      }
    });


    idUploadFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'sqs:SendMessage',
      ],
      resources:
        [
          storedImagesQueue.queueArn
        ],
      effect: Effect.ALLOW
    }))

    idUploadFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'dynamodb:ListTables',
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:GetRecords',
        'dynamodb:ConditionCheckItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',

      ],
      resources:
        [
          idVeriffMetadataTable.tableArn
        ],
      effect: Effect.ALLOW
    }))


    const userImageFaceValidation = new Function(this, 'user-image-face-validation', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'userImageFaceValidation.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'user-image-face-validation',
      tracing: Tracing.ACTIVE,
      environment: {
        S3_BUCKET: imageStoreBucketName
      }
    });

    userImageFaceValidation.addToRolePolicy(new PolicyStatement({
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:GetBucketLocation',
        's3:ListAllMyBuckets',
        'rekognition:DetectFaces',
        'rekognition:DetectLabels'
      ],

      resources: [
        `${s3Bucket.bucketArn}/*`
      ],
      effect: Effect.ALLOW
    }))

    userImageFaceValidation.addToRolePolicy(new PolicyStatement({
      actions: [
        'rekognition:DetectFaces',
        'rekognition:DetectLabels'
      ],

      resources: [
        '*'
      ],
      effect: Effect.ALLOW
    }))


    const userDocumentImageValidation = new Function(this, 'user-document-image-validation', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'userDocumentImageValidation.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'user-document-image-validation',
      tracing: Tracing.ACTIVE,
      environment: {
        S3_BUCKET: imageStoreBucketName
      }
    });

    userDocumentImageValidation.addToRolePolicy(new PolicyStatement({
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:GetBucketLocation',
        's3:ListAllMyBuckets',
        'rekognition:DetectFaces',
        'rekognition:DetectLabels'
      ],

      resources: [
        `${s3Bucket.bucketArn}/*`
      ],
      effect: Effect.ALLOW
    }))

    userDocumentImageValidation.addToRolePolicy(new PolicyStatement({
      actions: [
        'rekognition:DetectLabels'
      ],

      resources: [
        '*'
      ],
      effect: Effect.ALLOW
    }))


    const idFaceVerificationFunction = new Function(this, 'id-face-verification', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'idFaceVerification.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'id-face-verification',
      tracing: Tracing.ACTIVE,
      environment: {
        S3_BUCKET: imageStoreBucketName
      }
    });

    idFaceVerificationFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:GetBucketLocation',
        's3:ListAllMyBuckets',
        'rekognition:DetectFaces',
        'rekognition:DetectLabels'
      ],

      resources: [
        `${s3Bucket.bucketArn}/*`
      ],
      effect: Effect.ALLOW
    }))

    idFaceVerificationFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'rekognition:CompareFaces'
      ],

      resources: [
        '*'
      ],
      effect: Effect.ALLOW
    }))


    const sendOutNotificationFunction = new Function(this, 'sendUserNotification', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'sendOutNotification.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'send-user-notification',
      tracing: Tracing.ACTIVE,
      environment: {
        SQS_URL: sendNotificationsQueue.queueUrl
      }
    });

    sendOutNotificationFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'sqs:SendMessage',
      ],

      resources: [
        sendNotificationsQueue.queueArn
      ],
      effect: Effect.ALLOW
    }))


    const cleanUpResourcesFunction = new Function(this, 'clearnUpResourcesFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'cleanUpResources.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'clean-up-resources',
      tracing: Tracing.ACTIVE,
      environment: {
        SQS_URL: sendNotificationsQueue.queueUrl
      }
    });

    cleanUpResourcesFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'sqs:SendMessage',
      ],

      resources: [
        sendNotificationsQueue.queueArn
      ],
      effect: Effect.ALLOW
    }))

    // statemachine task to invoke the lambda
    const isFacePresentValidation = new LambdaInvoke(this, 'doFacePresentCheck', {
      lambdaFunction: userImageFaceValidation,
    })

    const isUserDocumentPresentValidation = new LambdaInvoke(this, 'doIdPresentCheck', {
      lambdaFunction: userDocumentImageValidation,
    })

    const idVerification = new LambdaInvoke(this, 'compareDocumentAndUserImage', {
      lambdaFunction: idFaceVerificationFunction,
    })

    const sendOutNotification = new LambdaInvoke(this, 'sendingUserNotification', {
      lambdaFunction: sendOutNotificationFunction,
    })

    const cleanUpResources = new LambdaInvoke(this, 'cleanUpResources', {
      lambdaFunction: cleanUpResourcesFunction,
    })


    const successState = new Pass(this, 'verificationSuccess');
    const failureState = new Pass(this, 'requiresManaualReview');

    const userFaceValidationChoice = new Choice(this, 'isfaceValidationPassed')
    userFaceValidationChoice.when(Condition.stringEquals('$.Payload.stageStatus', 'PASS'), isUserDocumentPresentValidation)
    userFaceValidationChoice.when(Condition.stringEquals('$.Payload.stageStatus', 'FAIL'), sendOutNotification)

    const userDocumentValidationChoice = new Choice(this, 'isDocumentValidationPassed')
    userDocumentValidationChoice.when(Condition.stringEquals('$.Payload.stageStatus', 'PASS'), idVerification)
    userDocumentValidationChoice.when(Condition.stringEquals('$.Payload.stageStatus', 'FAIL'), sendOutNotification)

    isUserDocumentPresentValidation.next(userDocumentValidationChoice)

    const similarityChoiceState = new Choice(this, 'isComparisonSimilarityAboveThreshold')

    similarityChoiceState.when(Condition.numberGreaterThan('$.Payload.faceComparisonSimilarityScore', 90), successState)
    similarityChoiceState.when(Condition.numberLessThan('$.Payload.faceComparisonSimilarityScore', 90), failureState)

    idVerification.next(similarityChoiceState)

    const definition = isFacePresentValidation;
    isFacePresentValidation.next(userFaceValidationChoice)

    successState.next(sendOutNotification)
    failureState.next(sendOutNotification)

    sendOutNotification.next(cleanUpResources)

    const statemachine = new StateMachine(this, 'id-verfication-statemachine', {
      stateMachineName: 'id-verification-workflow',
      definition: definition
    });

    // create a lmabda function that subcribes to the stored-images-queue
    const storedImagesQueueConsumerFunction = new Function(this, 'stored-queue-lambda-consumer', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'imageVerificationConsumer.handler',
      code: Code.fromAsset(path.join(__dirname, 'lambda-handler/verificationService')),
      functionName: 'stored-image-consumer',
      tracing: Tracing.ACTIVE,
      environment: {
        STATEMACHINE_ARN: statemachine.stateMachineArn
      }
    });

    storedImagesQueueConsumerFunction.addToRolePolicy(new PolicyStatement(
      {
        actions: [
          "states:DescribeStateMachine",
          "states:StartExecution",
          "states:ListExecutions",
          "states:UpdateStateMachine"
        ],
        resources: [
          statemachine.stateMachineArn
        ],
        effect: Effect.ALLOW
      }
    ))

    const eventSource = new SqsEventSource(storedImagesQueue);
    storedImagesQueueConsumerFunction.addEventSource(eventSource);
  }

  private createMetadataTable() {
    return new Table(this, 'id-verification-metadata', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      pointInTimeRecovery: true,
      encryption: TableEncryption.AWS_MANAGED,
      tableName: 'id-verification-metadata',
    });
  }

  private createS3Bucket(imageStoreBucketName: string) {
    return new Bucket(this, 'IdVeriffImageStore', {
      bucketName: imageStoreBucketName,
      encryption: BucketEncryption.S3_MANAGED
    });
  }
}
