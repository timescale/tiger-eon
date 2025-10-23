import {
  ConfigWithMcpServer,
  ConfigWithDockerProfile,
  McpConfig,
} from '../types';

export const hasMcpServer = (config: any): config is ConfigWithMcpServer => {
  const configAsMcp = config as unknown as ConfigWithMcpServer;

  return (
    typeof config === 'object' &&
    !!config &&
    !!configAsMcp.mcpConfig &&
    typeof configAsMcp.mcpConfig === 'object' &&
    typeof (configAsMcp.mcpConfig as McpConfig).url === 'string' &&
    !!configAsMcp.mcpName &&
    typeof configAsMcp.mcpName === 'string'
  );
};

export const hasDockerProfile = (
  config: any,
): config is ConfigWithDockerProfile => {
  const configAsMcp = config as unknown as ConfigWithDockerProfile;

  return (
    typeof config === 'object' &&
    !!config &&
    !!configAsMcp.dockerProfile &&
    typeof configAsMcp.dockerProfile === 'string'
  );
};
