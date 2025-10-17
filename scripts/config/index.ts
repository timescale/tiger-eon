import { AnthropicConfig } from './anthropic';
import { AgentSlackConfig, IngestSlackConfig } from './slack';
import { GithubConfig } from './github';
import { LinearConfig } from './linear';
import { DatabaseConfig } from './db';

export const configs = () => [
  new DatabaseConfig(),
  new AnthropicConfig(),
  new IngestSlackConfig(),
  new AgentSlackConfig(),
  new GithubConfig(),
  new LinearConfig(),
];
