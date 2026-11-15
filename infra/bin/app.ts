import { App } from 'aws-cdk-lib';
import { VibeStack } from '../lib/vibe-stack.js';

const app = new App();

new VibeStack(app, 'Vibe-dev', {
  env: {
    account: process.env.VIBE_AWS_ACCOUNT ?? '851725603471',
    region: process.env.VIBE_AWS_REGION ?? 'us-east-2',
  },
  stackName: 'Vibe-dev',
});
