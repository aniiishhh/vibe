import { App } from 'aws-cdk-lib';
import { VibeStack } from '../lib/vibe-stack.js';

const app = new App();

new VibeStack(app, 'Vibe-dev', {
  env: {
    account: '851725603471',
    region: 'us-east-2',
  },
  stackName: 'Vibe-dev',
});
