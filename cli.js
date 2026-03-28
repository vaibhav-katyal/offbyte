#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { offlineMode } from './lib/modes/offline.js';
import { connectFrontendBackend } from './lib/modes/connect.js';
import { runDoctor } from './lib/utils/doctor.js';
import { getInteractiveSetup, displaySetupSummary } from './lib/modes/interactiveSetup.js';
import { generateWithConfig } from './lib/modes/configBasedGenerator.js';
import { printBanner, printSection, printSuccess, printStep, printSummary, printFooter } from './lib/utils/cliFormatter.js';

const program = new Command();

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Port must be a number between 1 and 65535');
  }

  return port;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error('Value must be a positive integer');
  }

  return parsed;
}

program
  .name('offbyt')
  .description('Hybrid Backend Generator - Offline + AI Powered')
  .version('1.0.0');

program
  .command('generate [path]')
  .description('Complete backend generation with automatic API detection & injection')
  .option('--no-auto-connect', 'Skip auto-connect after generation')
  .option('--quick', 'Use default configuration (no questions)')
  .option('--no-api-detect', 'Skip automatic API detection from frontend')
  .option('--no-verify', 'Skip Phase-2 backend verification (startup + health check)')
  .option('--verify-timeout <ms>', 'Health-check timeout in milliseconds', parsePositiveInteger, 45000)
  .option('--strict-verify', 'Fail command if Phase-2 verification does not pass')
  .action(async (projectPath, options) => {
    try {
      printBanner();
      const workingPath = projectPath || process.cwd();
      let config;

      if (options.quick) {
        // Use default configuration
        config = {
          database: 'mongodb',
          framework: 'express',
          enableSocket: true,
          enableAuth: true,
          authType: 'jwt',
          enableValidation: true,
          enableCaching: false,
          enableLogging: true
        };
        printSection('Quick Mode: Using Default Configuration');
        printSuccess('Configuration ready - MongoDB + Express + Auth enabled');
      } else {
        // Interactive setup
        config = await getInteractiveSetup();
        displaySetupSummary(config);
      }

      // Generate backend with config
      const confirmSpinner = ora('Ready to generate backend...').start();
      confirmSpinner.succeed('Configuration confirmed\n');

      await generateWithConfig(workingPath, config);

      // AUTOMATIC: Smart API detection & generation
      if (options.apiDetect !== false) {
        console.log(chalk.cyan('\n\n[PIPELINE] Running Smart API Detection...\n'));
        const { generateSmartAPI } = await import('./lib/modes/generateApi.js');
        try {
          await generateSmartAPI(workingPath, { inject: true, config });
        } catch (error) {
          console.error(chalk.red('\nError in Smart API Generation:'));
          console.error(chalk.red(error.message));
          if (error.stack) {
            console.error(chalk.gray(error.stack));
          }
          throw error;
        }
      }

      let shouldRunVerify = options.verify !== false;
      if (options.verify !== false) {
        const verifyChoice = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'runVerify',
            message: 'Run post-generation health check (Phase-2)?',
            default: true
          }
        ]);
        shouldRunVerify = verifyChoice.runVerify;
      }

      if (shouldRunVerify) {
        console.log(chalk.cyan('\n\n[VERIFY] Running Phase-2 verification...\n'));
        const { verifyGeneratedBackend } = await import('./lib/utils/postGenerationVerifier.js');
        const verification = await verifyGeneratedBackend(workingPath, {
          timeoutMs: options.verifyTimeout,
          maxAttempts: 2
        });

        if (verification.ok) {
          console.log(chalk.green(`\n[OK] Phase-2 passed at http://localhost:${verification.port}${verification.healthEndpoint}\n`));
        } else {
          console.log(chalk.yellow('\n[WARN] Phase-2 verification did not fully pass.'));
          console.log(chalk.yellow(`   Reason: ${verification.issue}`));
          if (verification.fixesApplied.length > 0) {
            console.log(chalk.gray('   Auto-fixes attempted:'));
            for (const fix of verification.fixesApplied) {
              console.log(chalk.gray(`   - ${fix}`));
            }
          }
          console.log(chalk.gray('   You can skip this step next time using --no-verify.\n'));

          if (options.strictVerify) {
            throw new Error(`Phase-2 verification failed: ${verification.issue}`);
          }
        }
      } else {
        console.log(chalk.gray('\n[SKIP] Post-generation health check skipped by user choice.\n'));
      }

      // Auto-connect if enabled
      if (options.autoConnect) {
        console.log(chalk.cyan('Auto-connecting frontend & backend...\n'));
        await connectFrontendBackend(workingPath);
      }

    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('connect [path]')
  .description('Auto-connect frontend & backend (fixes URLs, fields, responses)')
  .action(async (projectPath) => {
    try {
      await connectFrontendBackend(projectPath || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('sync [path]')
  .description('Sync backend with frontend changes (update backend for new/changed frontend APIs)')
  .action(async (projectPath) => {
    try {
      const { syncBackendWithFrontend } = await import('./lib/modes/sync.js');
      await syncBackendWithFrontend(projectPath || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('benchmark [path]')
  .description('Run scalability & performance tests on your backend')
  .option('--levels <levels>', 'Load levels to test (e.g., 10,100,1000)', '10,100,1000,10000')
  .option('--duration <seconds>', 'Duration of each test in seconds', '10')
  .option('--startup-mode', 'Simulate startup growth over time')
  .action(async (projectPath, options) => {
    try {
      const { runBenchmark } = await import('./lib/modes/benchmark.js');
      await runBenchmark(projectPath || process.cwd(), options);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('deploy [path]')
  .description('Deploy frontend + backend and auto-connect API URLs')
  .option('--full', 'Use default stack (Frontend: Vercel, Backend: Railway)')
  .option('--frontend <provider>', 'Frontend provider: vercel | netlify | cloudflare | skip')
  .option('--backend <provider>', 'Backend provider: railway | render | cloudflare | skip')
  .option('--backend-service-id <id>', 'Backend service ID where required (e.g., Render)')
  .option('--backend-project-name <name>', 'Backend project name where supported (e.g., Railway, Cloudflare Pages)')
  .option('--backend-service-name <name>', 'Backend service name where supported (e.g., Railway)')
  .action(async (projectPath, options) => {
    try {
      const { runDeploymentFlow } = await import('./deploy/index.js');
      await runDeploymentFlow(projectPath || process.cwd(), options);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('generate-api [path]')
  .description('Smart API generation - Detect resources from frontend state & generate full-stack APIs')
  .option('--no-inject', 'Skip frontend code injection')
  .action(async (projectPath, options) => {
    try {
      const { generateSmartAPI } = await import('./lib/modes/generateApi.js');
      await generateSmartAPI(projectPath || process.cwd(), options);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Diagnose your system readiness')
  .option('--json', 'Output diagnostics in JSON format')
  .option('--no-strict', 'Do not treat warnings as blocking issues')
  .option('--port <number>', 'Port to check for availability (default: 5000)', parsePort, 5000)
  .action(async options => {
    const report = await runDoctor(options);
    process.exitCode = report.exitCode;
  });

program
  .command('doctor-ai [path]')
  .description('AI-powered backend debugger. Monitors a command for errors and generates fixes.')
  .option('--cmd <command>', 'Command to run and monitor', 'npm run dev')
  .action(async (projectPath, options) => {
    try {
      const { runDoctorAi } = await import('./lib/modes/doctorAi.js');
      await runDoctorAi(projectPath || process.cwd(), options);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('industry-validate [path]')
  .description('Run offline Industry Mode contract validation and print report')
  .option('--json', 'Print JSON output')
  .action(async (projectPath, options) => {
    try {
      const {
        runIndustryContractCheck,
        printIndustryReport
      } = await import('./lib/utils/industryMode.js');

      const report = await runIndustryContractCheck(projectPath || process.cwd());
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printIndustryReport(report);
      }

      process.exit(report.ok ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('industry-smoke [path]')
  .description('Run offline Industry Mode smoke checks and save report file')
  .option('--timeout <ms>', 'Smoke timeout in milliseconds', parsePositiveInteger, 45000)
  .option('--json', 'Print JSON output')
  .action(async (projectPath, options) => {
    try {
      const {
        runIndustrySmoke,
        writeIndustryReport,
        printIndustryReport
      } = await import('./lib/utils/industryMode.js');

      const workingPath = projectPath || process.cwd();
      const report = await runIndustrySmoke(workingPath, {
        timeoutMs: options.timeout
      });

      const filePath = writeIndustryReport(workingPath, report);
      if (options.json) {
        console.log(JSON.stringify({ ...report, reportFile: filePath }, null, 2));
      } else {
        printIndustryReport(report);
        console.log(chalk.cyan(`Report saved: ${filePath}`));
      }

      process.exit(report.ok ? 0 : 1);
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('\nQuick Start:\n'));
  console.log(chalk.white('  Option 1 (Recommended):'));
  console.log(chalk.gray('    offbyt generate                    # Generate + Auto-connect\n'));
  console.log(chalk.white('  Option 2 (Skip auto-connect):'));
  console.log(chalk.gray('    offbyt generate --no-auto-connect  # Generate only\n'));
  console.log(chalk.white('  Option 3 (Just connect):'));
  console.log(chalk.gray('    offbyt connect [path]              # Auto-connect existing project\n'));
  console.log(chalk.white('  Option 4 (Deploy live):'));
  console.log(chalk.gray('    offbyt deploy [path]               # Deploy + auto-connect URLs\n'));
}

