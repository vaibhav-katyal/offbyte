/**
 * offbyte Benchmark - Scalability & Performance Testing
 * Simulates different load levels and provides performance insights
 */

import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { scanBackendRoutes } from '../utils/apiScanner.js';
import { runLoadTest } from '../utils/loadTester.js';
import { analyzePerformance, generateReport } from '../utils/performanceAnalyzer.js';

/**
 * Main benchmark function
 */
export async function runBenchmark(projectPath, options) {
  console.log(chalk.cyan('\nâš¡ offbyte Benchmark - Scalability Testing\n'));
  console.log(chalk.gray('Analyzing your backend performance at scale...\n'));

  const backendPath = path.join(projectPath, 'backend');
  
  // Check if backend exists
  if (!fs.existsSync(backendPath)) {
    console.log(chalk.red('âŒ Backend folder not found. Please run `offbyte generate` first.'));
    return;
  }

  // Check if server is running
  const serverPort = await detectServerPort(backendPath);
  if (!serverPort) {
    console.log(chalk.yellow('\nâš ï¸  Backend server is not running!'));
    console.log(chalk.gray('Please start your backend server first (e.g., npm start or node server.js)\n'));
    return;
  }

  console.log(chalk.green(`âœ… Server detected on port ${serverPort}\n`));

  // STEP 1: Scan backend APIs
  const scanSpinner = ora('Scanning backend routes...').start();
  const routes = await scanBackendRoutes(backendPath);
  scanSpinner.succeed(chalk.green(`âœ… Found ${routes.length} API endpoints`));
  
  if (routes.length === 0) {
    console.log(chalk.yellow('\nâš ï¸  No routes detected. Make sure your backend has API endpoints.\n'));
    return;
  }

  console.log(chalk.gray('\nDetected endpoints:'));
  routes.forEach(r => console.log(chalk.gray(`  ${r.method.padEnd(7)} ${r.path}`)));
  console.log('');

  const benchmarkRoutes = selectBenchmarkRoutes(routes);
  if (benchmarkRoutes.length === 0) {
    console.log(chalk.yellow('âš ï¸  No benchmark-safe routes found (all routes require dynamic params).'));
    return;
  }

  // STEP 2: Run load tests at different levels
  const loadLevels = options.levels.split(',').map(Number);
  const duration = parseInt(options.duration);
  const baseUrl = `http://localhost:${serverPort}`;

  const results = [];

  for (const level of loadLevels) {
    console.log(chalk.cyan(`\nðŸ“Š Testing with ${level} concurrent users...\n`));
    
    const levelResults = [];
    
    for (const route of benchmarkRoutes) {
      const testSpinner = ora(`Testing ${route.method} ${route.path}`).start();
      
      try {
        const result = await runLoadTest({
          url: `${baseUrl}${route.path}`,
          method: route.method,
          connections: level,
          duration: duration
        });

        levelResults.push({
          route: `${route.method} ${route.path}`,
          ...result
        });

        const avgLatency = result.latency.mean.toFixed(2);
        const reqPerSec = result.requests.average.toFixed(2);
        
        if (avgLatency > 500) {
          testSpinner.fail(chalk.red(`${route.method} ${route.path} - ${avgLatency}ms (SLOW) - ${reqPerSec} req/s`));
        } else if (avgLatency > 200) {
          testSpinner.warn(chalk.yellow(`${route.method} ${route.path} - ${avgLatency}ms - ${reqPerSec} req/s`));
        } else {
          testSpinner.succeed(chalk.green(`${route.method} ${route.path} - ${avgLatency}ms - ${reqPerSec} req/s`));
        }
      } catch (error) {
        testSpinner.fail(chalk.red(`${route.method} ${route.path} - Error: ${error.message}`));
      }
    }

    results.push({
      level: level,
      routes: levelResults
    });
  }

  // STEP 3: Analyze and generate report
  console.log(chalk.cyan('\n\nðŸ“ˆ Analyzing Performance...\n'));
  
  const analysis = analyzePerformance(results, routes);
  const report = generateReport(analysis, options.startupMode);

  console.log(report);
  
  // Save report to file
  const reportPath = path.join(projectPath, 'benchmark-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(chalk.green(`\nâœ… Report saved to: ${reportPath}\n`));
}

function selectBenchmarkRoutes(routes) {
  const safeRoutes = routes.filter((route) => {
    const routePath = route.path || '';
    const hasDynamicSegments = routePath.includes(':') || routePath.includes('${');
    const isBulkOperation = /\/bulk\//i.test(routePath);
    return !hasDynamicSegments && !isBulkOperation;
  });

  const preferredOrder = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  safeRoutes.sort((a, b) => {
    const methodDiff = preferredOrder.indexOf(a.method) - preferredOrder.indexOf(b.method);
    if (methodDiff !== 0) return methodDiff;
    return a.path.length - b.path.length;
  });

  return safeRoutes.slice(0, 5);
}

/**
 * Detect server port from backend files
 */
async function detectServerPort(backendPath) {
  try {
    const serverFile = path.join(backendPath, 'server.js');
    if (!fs.existsSync(serverFile)) return null;

    const content = fs.readFileSync(serverFile, 'utf8');
    
    // Try to find port in code
    const portMatch = content.match(/\.listen\s*\(\s*(\d+)|PORT\s*=\s*(\d+)|port:\s*(\d+)/i);
    if (portMatch) {
      return portMatch[1] || portMatch[2] || portMatch[3];
    }

    // Default to 5000
    return 5000;
  } catch {
    return null;
  }
}

