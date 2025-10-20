const colors = {
  CYAN: '\x1b[0;36m',
  RED: '\x1b[0;31m',
  GREEN: '\x1b[0;32m',
  YELLOW: '\x1b[1;33m',
  BLUE: '\x1b[0;34m',
  NC: '\x1b[0m',
};

export const log = {
  heading: (msg: string, ...params: any[]) =>
    console.log(
      `${colors.CYAN}«${colors.NC} ${msg} ${colors.CYAN}»${colors.NC}`,
      ...params,
    ),
  info: (msg: string, ...params: any[]) =>
    console.log(`${colors.BLUE}ℹ${colors.NC} ${msg}`, ...params),
  success: (msg: string, ...params: any[]) =>
    console.log(`${colors.GREEN}✓${colors.NC} ${msg}`, ...params),
  warning: (msg: string, ...params: any[]) =>
    console.log(`${colors.YELLOW}⚠${colors.NC} ${msg}`, ...params),
  error: (msg: string, ...params: any[]) =>
    console.log(`${colors.RED}✗${colors.NC} ${msg}`, ...params),
};
