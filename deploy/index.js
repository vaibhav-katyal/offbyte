import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { deployToVercel } from './vercel.js';
import { deployToNetlify } from './netlify.js';
import { deployToCloudflare } from './cloudflare.js';
import { deployToRailway } from './railway.js';
import { deployToRender } from './render.js';
import { deployToCloudflareWorker } from './cloudflareWorker.js';
import { autoConnectDeployment } from './connect.js';
import { detectBackendPath, detectFrontendPath, normalizeProviderKey } from './utils.js';

const FRONTEND_PROVIDER_CHOICES = [
  { name: 'Vercel', value: 'vercel' },
  { name: 'Netlify', value: 'netlify' },
  { name: 'Cloudflare Pages', value: 'cloudflare' },
  { name: 'Skip frontend', value: 'skip' }
];

const BACKEND_PROVIDER_CHOICES = [
  { name: 'Railway', value: 'railway' },
  { name: 'Render', value: 'render' },
  { name: 'Cloudflare Pages (Free)', value: 'cloudflare' },
  { name: 'Skip backend', value: 'skip' }
];

const FRONTEND_DEPLOYERS = {
  vercel: deployToVercel,
  netlify: deployToNetlify,
  cloudflare: deployToCloudflare,
  skip: null
};

const BACKEND_DEPLOYERS = {
  railway: deployToRailway,
  render: deployToRender,
  cloudflare: deployToCloudflareWorker,
  skip: null
};

const FRONTEND_ALIASES = {
  vercel: 'vercel',
  netlify: 'netlify',
  cloudflare: 'cloudflare',
  cloudflarepages: 'cloudflare',
  skip: 'skip',
  skipfrontend: 'skip'
};

const BACKEND_ALIASES = {
  railway: 'railway',
  render: 'render',
  cloudflare: 'cloudflare',
  cloudflareworker: 'cloudflare',
  cloudflareworkers: 'cloudflare',
  worker: 'cloudflare',
  workers: 'cloudflare',
  skip: 'skip',
  skipbackend: 'skip'
};

export async function runDeploymentFlow(projectPath, options = {}) {
  const resolvedProjectPath = path.resolve(projectPath || process.cwd());

  console.log(chalk.cyan('\noffbyte Deployment\n'));

  const selection = await resolveProviders(options);
  const frontendPath = detectFrontendPath(resolvedProjectPath);
  const backendPath = detectBackendPath(resolvedProjectPath);

  const result = {
    frontendProvider: selection.frontend,
    backendProvider: selection.backend,
    frontendUrl: null,
    backendUrl: null,
    connected: null
  };

  if (selection.frontend && selection.frontend !== 'skip') {
    const deployFrontend = FRONTEND_DEPLOYERS[selection.frontend];
    if (!deployFrontend) {
      throw new Error(`Unsupported frontend provider: ${selection.frontend}`);
    }

    const frontendDeployResult = await deployFrontend(frontendPath, selection.frontendOptions || {});
    result.frontendUrl = frontendDeployResult.url;
  }

  if (selection.backend && selection.backend !== 'skip') {
    const deployBackend = BACKEND_DEPLOYERS[selection.backend];
    if (!deployBackend) {
      throw new Error(`Unsupported backend provider: ${selection.backend}`);
    }

    const backendDeployResult = await deployBackend(backendPath, selection.backendOptions || {});
    result.backendUrl = backendDeployResult.url;
  }

  if (result.backendUrl && selection.frontend && selection.frontend !== 'skip') {
    result.connected = autoConnectDeployment({
      projectPath: resolvedProjectPath,
      frontendPath,
      backendUrl: result.backendUrl
    });
  }

  printSummary(result);
}

async function resolveProviders(options) {
  const normalizedFrontend = normalizeFrontendProvider(options.frontend);
  const normalizedBackend = normalizeBackendProvider(options.backend);
  const fallbackBackend = normalizedBackend || 'railway';

  if (options.full) {
    return {
      frontend: normalizedFrontend || 'vercel',
      backend: fallbackBackend,
      frontendOptions: await resolveFrontendOptions(normalizedFrontend || 'vercel'),
      backendOptions: await resolveBackendOptions(fallbackBackend, options, { interactive: false })
    };
  }

  const answers = [];

  if (!normalizedFrontend) {
    answers.push(
      await inquirer.prompt([
        {
          type: 'list',
          name: 'frontend',
          message: 'Select frontend hosting',
          choices: FRONTEND_PROVIDER_CHOICES
        }
      ])
    );
  }

  if (!normalizedBackend) {
    answers.push(
      await inquirer.prompt([
        {
          type: 'list',
          name: 'backend',
          message: 'Select backend hosting',
          choices: BACKEND_PROVIDER_CHOICES
        }
      ])
    );
  }

  const frontend = normalizedFrontend || answers.find((entry) => entry.frontend)?.frontend;
  const backend = normalizedBackend || answers.find((entry) => entry.backend)?.backend;

  return {
    frontend,
    backend,
    frontendOptions: await resolveFrontendOptions(frontend),
    backendOptions: await resolveBackendOptions(backend, options, { interactive: true })
  };
}

function normalizeFrontendProvider(value) {
  if (!value) return null;
  const normalized = normalizeProviderKey(value);
  const provider = FRONTEND_ALIASES[normalized];

  if (!provider) {
    throw new Error(`Invalid frontend provider: ${value}. Use vercel | netlify | cloudflare`);
  }

  return provider;
}

function normalizeBackendProvider(value) {
  if (!value) return null;
  const normalized = normalizeProviderKey(value);
  const provider = BACKEND_ALIASES[normalized];

  if (!provider) {
    throw new Error(`Invalid backend provider: ${value}. Use railway | render | cloudflare | skip`);
  }

  return provider;
}

async function resolveFrontendOptions(frontendProvider) {
  if (frontendProvider !== 'cloudflare') {
    return {};
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'buildDir',
      message: 'Build output directory for Cloudflare Pages',
      default: 'dist'
    }
  ]);

  return {
    buildDir: answers.buildDir
  };
}

function buildDefaultRailwayProjectName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, '')
    .slice(0, 12);

  return `offbyte-${stamp}`;
}

async function resolveBackendOptions(backendProvider, options = {}, { interactive = false } = {}) {
  if (!backendProvider || backendProvider === 'skip') {
    return {};
  }

  const cliServiceId = String(options.backendServiceId || process.env.RENDER_SERVICE_ID || '').trim();

  if (backendProvider === 'render') {
    if (cliServiceId) {
      return { serviceId: cliServiceId };
    }

    if (!interactive) {
      return {};
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'serviceId',
        message: 'Render service ID (required)',
        validate: (value) => String(value || '').trim().length > 0 || 'Service ID is required',
        filter: (value) => String(value || '').trim()
      }
    ]);

    return { serviceId: answers.serviceId };
  }

  if (backendProvider === 'cloudflare') {
    const cliProjectName = String(options.backendProjectName || process.env.CLOUDFLARE_PAGES_PROJECT || '').trim();
    return cliProjectName ? { projectName: cliProjectName } : {};
  }

  if (backendProvider !== 'railway') {
    return {};
  }

  const cliProjectName = String(options.backendProjectName || '').trim();
  const cliServiceName = String(options.backendServiceName || '').trim();
  if (cliProjectName) {
    return {
      projectName: cliProjectName,
      ...(cliServiceName ? { serviceName: cliServiceName } : {})
    };
  }

  if (!interactive) {
    return {
      projectName: buildDefaultRailwayProjectName(),
      ...(cliServiceName ? { serviceName: cliServiceName } : {})
    };
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Railway project name (auto-created if missing)',
      default: buildDefaultRailwayProjectName(),
      filter: (value) => String(value || '').trim()
    },
    {
      type: 'input',
      name: 'serviceName',
      message: 'Railway service name (optional, leave blank for auto)',
      default: cliServiceName,
      filter: (value) => String(value || '').trim()
    }
  ]);

  return {
    projectName: answers.projectName || buildDefaultRailwayProjectName(),
    ...(answers.serviceName ? { serviceName: answers.serviceName } : {})
  };
}

function printSummary(result) {
  console.log(chalk.green('\nDeployment complete\n'));

  if (result.frontendUrl) {
    console.log(chalk.green('âœ” Frontend deployed ->'), chalk.white(result.frontendUrl));
  } else {
    console.log(chalk.yellow('â€¢ Frontend deployment skipped'));
  }

  if (result.backendUrl) {
    console.log(chalk.green('âœ” Backend deployed ->'), chalk.white(result.backendUrl));
  } else {
    console.log(chalk.yellow('â€¢ Backend deployment skipped'));
  }

  if (result.connected) {
    console.log(chalk.green('\nâœ” Frontend connected with backend')); 
    console.log(chalk.gray(`  Updated source files: ${result.connected.updatedFileCount}`));
    console.log(chalk.gray(`  Updated env files: ${result.connected.envFilesUpdated.length}`));
  }

  console.log(chalk.cyan('\nApp live:'));
  if (result.frontendUrl) {
    console.log(chalk.white(`Frontend -> ${result.frontendUrl}`));
  }
  if (result.backendUrl) {
    console.log(chalk.white(`Backend  -> ${result.backendUrl}`));
  }
  console.log('');
}

