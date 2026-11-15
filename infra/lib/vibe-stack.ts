import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ArnFormat,
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
  aws_apigateway as apigateway,
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_authorizers as apigatewayv2Authorizers,
  aws_apigatewayv2_integrations as apigatewayv2Integrations,
  aws_appsync as appsync,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfrontOrigins,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_events as events,
  aws_events_targets as eventTargets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_event_sources as lambdaEventSources,
  aws_lambda_nodejs as lambdaNodejs,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3Deployment,
  aws_sqs as sqs,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STAGE = 'dev';
const MODEL_ID = 'deepseek.v3.2';
const FALLBACK_MODEL_ID = 'minimax.minimax-m2.5';

export class VibeStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'vibe');
    Tags.of(this).add('environment', STAGE);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `vibe-${STAGE}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      userPoolClientName: `vibe-${STAGE}-web`,
      generateSecret: false,
      disableOAuth: true,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
    });

    const table = new dynamodb.Table(this, 'AppTable', {
      tableName: `vibe-${STAGE}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const agentDlq = new sqs.Queue(this, 'AgentDeadLetterQueue', {
      queueName: `vibe-${STAGE}-agent-dlq.fifo`,
      fifo: true,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const agentQueue = new sqs.Queue(this, 'AgentQueue', {
      queueName: `vibe-${STAGE}-agent.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: Duration.seconds(900),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: agentDlq, maxReceiveCount: 3 },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const memoryDlq = new sqs.Queue(this, 'MemoryDeadLetterQueue', {
      queueName: `vibe-${STAGE}-memory-dlq.fifo`,
      fifo: true,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const memoryQueue = new sqs.Queue(this, 'MemoryQueue', {
      queueName: `vibe-${STAGE}-memory.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: Duration.seconds(540),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: memoryDlq, maxReceiveCount: 5 },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const supermemoryParameterName = `/vibe/${STAGE}/supermemory-api-key`;

    const apiFunction = this.createNodeFunction('ApiFunction', 'api', 'handler.ts', 30, 512, {
      TABLE_NAME: table.tableName,
    });
    const agentFunction = this.createNodeFunction('AgentFunction', 'agent', 'agent.ts', 150, 1024, {
      TABLE_NAME: table.tableName,
      MODEL_ID,
      FALLBACK_MODEL_ID,
      SUPERMEMORY_PARAMETER_NAME: supermemoryParameterName,
      METERED_FEATURES_ENABLED: 'true',
    });
    const dispatcherFunction = this.createNodeFunction('DispatcherFunction', 'dispatcher', 'dispatcher.ts', 60, 512, {
      TABLE_NAME: table.tableName,
      AGENT_QUEUE_URL: agentQueue.queueUrl,
      MEMORY_QUEUE_URL: memoryQueue.queueUrl,
    });
    const subscriptionFunction = this.createNodeFunction(
      'SubscriptionFunction',
      'subscription',
      'subscription.ts',
      10,
      256,
      { TABLE_NAME: table.tableName },
    );

    const memoryFunction = this.createNodeFunction('MemoryFunction', 'memory', 'memory-worker.ts', 90, 1024, {
      TABLE_NAME: table.tableName,
      MEMORY_QUEUE_URL: memoryQueue.queueUrl,
      MODEL_ID,
      SUPERMEMORY_PARAMETER_NAME: supermemoryParameterName,
      METERED_FEATURES_ENABLED: 'true',
    });
    memoryFunction.addEnvironment('APP_STAGE', STAGE);

    apiFunction.addEnvironment('APP_STAGE', STAGE);
    agentFunction.addEnvironment('APP_STAGE', STAGE);
    dispatcherFunction.addEnvironment('APP_STAGE', STAGE);
    subscriptionFunction.addEnvironment('APP_STAGE', STAGE);

    const baseTableDataActions = [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:ConditionCheckItem',
    ];
    for (const fn of [apiFunction, agentFunction, memoryFunction]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: baseTableDataActions,
          resources: [table.tableArn],
        }),
      );
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['dynamodb:Query'],
          resources: [table.tableArn],
        }),
      );
    }
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${table.tableArn}/index/GSI1`],
      }),
    );
    table.grantStreamRead(dispatcherFunction);
    dispatcherFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
        resources: [table.tableArn, `${table.tableArn}/index/GSI2`],
        conditions: {
          'ForAllValues:StringLike': { 'dynamodb:LeadingKeys': ['OUTBOX#*'] },
        },
      }),
    );
    subscriptionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [table.tableArn],
        conditions: {
          'ForAllValues:StringLike': { 'dynamodb:LeadingKeys': ['PARTY#*'] },
        },
      }),
    );
    agentQueue.grantConsumeMessages(agentFunction);

    agentFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:${Stack.of(this).partition}:bedrock:${Stack.of(this).region}::foundation-model/${MODEL_ID}`,
          `arn:${Stack.of(this).partition}:bedrock:${Stack.of(this).region}::foundation-model/${FALLBACK_MODEL_ID}`,
        ],
      }),
    );
    memoryFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [`arn:${Stack.of(this).partition}:bedrock:${Stack.of(this).region}::foundation-model/${MODEL_ID}`],
    }));
    const supermemoryParameterArn = Stack.of(this).formatArn({
      service: 'ssm', resource: 'parameter', resourceName: supermemoryParameterName.slice(1),
    });
    for (const fn of [agentFunction, memoryFunction]) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ssm:GetParameter'], resources: [supermemoryParameterArn],
      }));
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['kms:Decrypt'], resources: ['*'],
        conditions: {
          StringEquals: {
            'kms:ViaService': `ssm.${Stack.of(this).region}.amazonaws.com`,
            'kms:EncryptionContext:PARAMETER_ARN': supermemoryParameterArn,
          },
        },
      }));
    }
    memoryQueue.grantSendMessages(dispatcherFunction);
    memoryFunction.addEventSource(new lambdaEventSources.SqsEventSource(memoryQueue, {
      batchSize: 1, reportBatchItemFailures: true, maxConcurrency: 2,
    }));

    const eventApi = new appsync.CfnApi(this, 'EventsApi', {
      name: `vibe-${STAGE}-events`,
      eventConfig: {
        authProviders: [
          {
            authType: 'AMAZON_COGNITO_USER_POOLS',
            cognitoConfig: {
              awsRegion: Stack.of(this).region,
              userPoolId: userPool.userPoolId,
            },
          },
          { authType: 'AWS_IAM' },
        ],
        connectionAuthModes: [{ authType: 'AMAZON_COGNITO_USER_POOLS' }],
        defaultPublishAuthModes: [{ authType: 'AWS_IAM' }],
        defaultSubscribeAuthModes: [{ authType: 'AMAZON_COGNITO_USER_POOLS' }],
      },
    });

    const appSyncDataSourceRole = new iam.Role(this, 'SubscriptionDataSourceRole', {
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
      description: 'Allows AppSync Events to invoke the subscription membership checker.',
    });
    appSyncDataSourceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [subscriptionFunction.functionArn],
      }),
    );

    const subscriptionDataSource = new appsync.CfnDataSource(this, 'SubscriptionDataSource', {
      apiId: eventApi.attrApiId,
      name: 'PartySubscriptionMembership',
      type: 'AWS_LAMBDA',
      serviceRoleArn: appSyncDataSourceRole.roleArn,
      lambdaConfig: { lambdaFunctionArn: subscriptionFunction.functionArn },
    });

    const partyNamespace = new appsync.CfnChannelNamespace(this, 'PartyNamespace', {
      apiId: eventApi.attrApiId,
      name: 'party',
      publishAuthModes: [{ authType: 'AWS_IAM' }],
      subscribeAuthModes: [{ authType: 'AMAZON_COGNITO_USER_POOLS' }],
      handlerConfigs: {
        onSubscribe: {
          behavior: 'DIRECT',
          integration: {
            dataSourceName: 'PartySubscriptionMembership',
            lambdaConfig: { invokeType: 'REQUEST_RESPONSE' },
          },
        },
      },
    });
    partyNamespace.addResourceDependency(subscriptionDataSource);

    dispatcherFunction.addEnvironment('EVENTS_HTTP_ENDPOINT', `https://${eventApi.attrDnsHttp}/event`);
    dispatcherFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:EventPublish'],
        resources: [
          Stack.of(this).formatArn({
            service: 'appsync',
            resource: `apis/${eventApi.attrApiId}/channelNamespace/party`,
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
        ],
      }),
    );
    agentQueue.grantSendMessages(dispatcherFunction);
    agentFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(agentQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
        maxConcurrency: 5,
      }),
    );

    const streamEventSource = new lambdaEventSources.DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 10,
      maxBatchingWindow: Duration.seconds(1),
      bisectBatchOnError: true,
      retryAttempts: 3,
      reportBatchItemFailures: true,
      filters: [
        lambda.FilterCriteria.filter({
          eventName: ['INSERT'],
          dynamodb: { NewImage: { status: { S: ['PENDING'] } } },
        }),
      ],
    });
    dispatcherFunction.addEventSource(streamEventSource);

    new events.Rule(this, 'OutboxRecoverySchedule', {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new eventTargets.LambdaFunction(dispatcherFunction)],
      description: 'Retries pending outbox effects that a stream delivery did not dispatch.',
    });

    const apiAccessLogs = new logs.LogGroup(this, 'HttpApiAccessLogs', {
      logGroupName: `/vibe/${STAGE}/http-api-access`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoJwtAuthorizer',
      `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `vibe-${STAGE}`,
      description: 'Authenticated Vibe application API.',
      corsPreflight: {
        allowOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: Duration.hours(1),
      },
      createDefaultStage: false,
    });
    httpApi.addStage('DefaultStage', {
      stageName: '$default',
      autoDeploy: true,
      accessLogSettings: {
        destination: new apigatewayv2.LogGroupLogDestination(apiAccessLogs),
        format: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            routeKey: '$context.routeKey',
            status: '$context.status',
            latency: '$context.responseLatency',
          }),
        ),
      },
    });
    const apiIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ApiLambdaIntegration',
      apiFunction,
      { payloadFormatVersion: apigatewayv2.PayloadFormatVersion.VERSION_2_0 },
    );
    httpApi.addRoutes({
      path: '/api',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: apiIntegration,
      authorizer: jwtAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: apiIntegration,
      authorizer: jwtAuthorizer,
    });

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const apiOriginDomain = Fn.select(2, Fn.split('/', httpApi.apiEndpoint));
    const spaRewriteFunction = new cloudfront.Function(this, 'SpaDeepLinkRewrite', {
      functionName: `vibe-${STAGE}-spa-rewrite`,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri !== '/api' && !uri.startsWith('/api/')) {
    var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
    if (lastSegment.indexOf('.') === -1) request.uri = '/index.html';
  }
  return request;
}`),
    });
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          { function: spaRewriteFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/api*': {
          origin: new cloudfrontOrigins.HttpOrigin(apiOriginDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
        },
      },
    });

    const webDeployLogs = new logs.LogGroup(this, 'WebDeploymentLogs', {
      logGroupName: `/vibe/${STAGE}/web-deployment`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    new s3Deployment.BucketDeployment(this, 'DeployWebApp', {
      sources: [
        s3Deployment.Source.asset(resolve(PROJECT_ROOT, 'web/dist')),
        s3Deployment.Source.jsonData('config.json', {
          region: Stack.of(this).region,
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
          apiUrl: '/api',
          eventsHttpEndpoint: `https://${eventApi.attrDnsHttp}/event`,
          eventsRealtimeEndpoint: `wss://${eventApi.attrDnsRealtime}/event/realtime`,
        }),
      ],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ['/*'],
      logGroup: webDeployLogs,
      memoryLimit: 512,
      prune: true,
      retainOnDelete: true,
    });

    new CfnOutput(this, 'WebsiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL for the Vibe web app.',
    });
    new CfnOutput(this, 'ApiGatewayUrl', {
      value: `${httpApi.apiEndpoint}/api`,
      description: 'Direct API Gateway endpoint for local development.',
    });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'DynamoTableName', { value: table.tableName });
    new CfnOutput(this, 'AgentQueueUrl', { value: agentQueue.queueUrl });
    new CfnOutput(this, 'MemoryQueueUrl', { value: memoryQueue.queueUrl });
    new CfnOutput(this, 'SupermemoryParameterName', { value: supermemoryParameterName });
    new CfnOutput(this, 'EventsHttpEndpoint', {
      value: `https://${eventApi.attrDnsHttp}/event`,
    });
    new CfnOutput(this, 'EventsRealtimeEndpoint', {
      value: `wss://${eventApi.attrDnsRealtime}/event/realtime`,
    });
  }

  private createNodeFunction(
    id: string,
    suffix: string,
    entryFile: string,
    timeoutSeconds: number,
    memorySize: number,
    environment: Record<string, string>,
  ): lambdaNodejs.NodejsFunction {
    const functionName = `vibe-${STAGE}-${suffix}`;
    const logGroup = new logs.LogGroup(this, `${id}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const role = new iam.Role(this, `${id}Role`, {
      roleName: `${functionName}-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Execution role for the Vibe ${suffix} Lambda.`,
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`${logGroup.logGroupArn}:*`],
      }),
    );

    return new lambdaNodejs.NodejsFunction(this, id, {
      functionName,
      entry: resolve(PROJECT_ROOT, 'backend/src', entryFile),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(timeoutSeconds),
      memorySize,
      reservedConcurrentExecutions: suffix === 'agent' ? 5 : undefined,
      logGroup,
      role,
      environment: {
        ...environment,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        externalModules: [],
        format: lambdaNodejs.OutputFormat.CJS,
        target: 'node24',
      },
    });
  }
}
