export interface TigerService {
  service_id: string;
  name: string;
  created: string;
  status: string;
  host?: string;
  endpoint?: {
    host: string;
    port: number;
  };
  console_url?: string;
  database?: string;
  role?: string;
}

export interface DatabaseConfigParameters {
  serviceId?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface SlackTokens {
  botToken: string;
  appToken: string;
}

export interface SlackAppConfig {
  name: string;
  description: string;
  manifestUrl: string;
  type: 'ingest' | 'agent';
}

export interface SlackConfig {
  ingest: SlackTokens;
  agent: SlackTokens;
}

export interface EnvironmentVariable {
  key: string;
  value?: string;
}

export interface McpConfig {
  url: string;
  disabled?: boolean;
  tool_prefix?: string;
}

export type McpConfigGroup = Record<string, McpConfig>;
