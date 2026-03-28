import { deployWithCommand, runCommandCapture } from './utils.js';

function normalize(value = '') {
  return String(value).trim().toLowerCase();
}

async function checkRailwayLogin() {
  try {
    const result = await runCommandCapture({
      command: 'railway',
      args: ['whoami'],
      cwd: process.cwd(),
      streamOutput: false
    });
    return result.stdout.trim().length > 0 && !result.stderr.toLowerCase().includes('not logged in');
  } catch {
    return false;
  }
}

function buildDefaultRailwayProjectName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, '')
    .slice(0, 12);

  return `offbyte-${stamp}`;
}

async function isRailwayProjectLinked(backendPath) {
  try {
    await runCommandCapture({
      command: 'railway',
      args: ['status'],
      cwd: backendPath,
      streamOutput: false
    });
    return true;
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('no linked project found')) {
      return false;
    }

    // If status check itself fails for other reasons, treat as not linked and let init/link handle it.
    return false;
  }
}

async function ensureRailwayProjectLinked(backendPath, options = {}) {
  const hasLinkedProject = await isRailwayProjectLinked(backendPath);
  const requestedProject = String(options.projectName || '').trim();

  if (hasLinkedProject && !requestedProject) {
    return;
  }

  if (requestedProject) {
    try {
      await runCommandCapture({
        command: 'railway',
        args: ['link', '--project', requestedProject],
        cwd: backendPath,
        streamOutput: true
      });
      return;
    } catch {
      // Fall through to create the requested project when link fails.
    }
  }

  if (hasLinkedProject && !requestedProject && !options.forceRelink) {
    return;
  }

  const projectName = requestedProject || buildDefaultRailwayProjectName();
  await runCommandCapture({
    command: 'railway',
    args: ['init', '-n', projectName],
    cwd: backendPath,
    streamOutput: true
  });
}

function extractFirstJsonObject(raw = '') {
  const text = String(raw || '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  return text.slice(first, last + 1);
}

async function getRailwayStatus(backendPath) {
  try {
    const result = await runCommandCapture({
      command: 'railway',
      args: ['status', '--json'],
      cwd: backendPath,
      streamOutput: false
    });

    const jsonPayload = extractFirstJsonObject(result.stdout);
    if (!jsonPayload) {
      return null;
    }

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function resolveRailwayServiceName(status, options = {}) {
  const explicitServiceName = String(options.serviceName || '').trim();
  if (explicitServiceName) {
    return explicitServiceName;
  }

  const serviceEdges = status?.services?.edges || [];
  const serviceNames = serviceEdges
    .map((edge) => edge?.node?.name)
    .filter(Boolean);

  if (serviceNames.length === 0) {
    return null;
  }

  const requestedProjectName = String(options.projectName || '').trim();
  if (requestedProjectName) {
    const matched = serviceNames.find((name) => normalize(name) === normalize(requestedProjectName));
    if (matched) {
      return matched;
    }
  }

  // Use first service as fallback to avoid "multiple services" ambiguity.
  return serviceNames[0];
}

function resolveRailwayDomainFromStatus(status) {
  const envEdges = status?.environments?.edges || [];
  for (const envEdge of envEdges) {
    const serviceInstances = envEdge?.node?.serviceInstances?.edges || [];
    for (const serviceEdge of serviceInstances) {
      const domains = serviceEdge?.node?.domains?.serviceDomains || [];
      const candidate = domains.find((item) => item?.domain)?.domain;
      if (candidate) {
        return `https://${candidate}`;
      }
    }
  }

  return null;
}

async function getRailwayPublicDomain(backendPath) {
  const status = await getRailwayStatus(backendPath);
  const domainFromStatus = resolveRailwayDomainFromStatus(status);
  if (domainFromStatus) {
    return domainFromStatus;
  }

  try {
    const result = await runCommandCapture({
      command: 'railway',
      args: ['domain'],
      cwd: backendPath,
      streamOutput: false
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const match = combinedOutput.match(/https?:\/\/[^\s"'`<>]+/i);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export async function deployToRailway(backendPath, options = {}) {
  let serviceName = String(options.serviceName || '').trim();

  const preflight = async () => {
    await ensureRailwayProjectLinked(backendPath, options);

    const status = await getRailwayStatus(backendPath);
    if (!serviceName) {
      serviceName = resolveRailwayServiceName(status, options);
    }
  };

  return deployWithCommand({
    providerName: 'Railway',
    command: 'railway',
    packageName: '@railway/cli',
    args: () => {
      const deployArgs = ['up'];
      if (serviceName) {
        deployArgs.push('--service', serviceName);
      }
      return deployArgs;
    },
    cwd: backendPath,
    urlHints: ['up.railway.app', 'railway.app'],
    loginCheck: checkRailwayLogin,
    loginCommand: { command: 'railway', args: ['login', '--browserless'] },
    preflight,
    postDeploy: async () => getRailwayPublicDomain(backendPath),
    successLabel: 'Backend deployed on Railway'
  });
}

