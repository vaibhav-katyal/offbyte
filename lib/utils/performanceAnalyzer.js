/**
 * Performance Analyzer - Analyzes load test results and generates insights
 */

import chalk from 'chalk';

/**
 * Analyze performance results
 */
export function analyzePerformance(results, routes) {
  const analysis = {
    summary: {},
    bottlenecks: [],
    recommendations: [],
    scalabilityScore: 0
  };

  // Analyze each load level
  for (const levelResult of results) {
    const level = levelResult.level;
    const routeResults = levelResult.routes;

    let totalLatency = 0;
    let slowRoutes = [];
    let errorRoutes = [];

    for (const routeResult of routeResults) {
      const avgLatency = routeResult.latency.mean;
      totalLatency += avgLatency;

      // Detect slow routes
      if (avgLatency > 500) {
        slowRoutes.push({
          route: routeResult.route,
          latency: avgLatency.toFixed(2)
        });
      }

      // Detect errors
      if (routeResult.errors > 0 || routeResult.non2xx > 0) {
        errorRoutes.push({
          route: routeResult.route,
          errors: routeResult.errors,
          non2xx: routeResult.non2xx
        });
      }
    }

    const avgLatency = routeResults.length > 0 ? totalLatency / routeResults.length : 0;

    analysis.summary[level] = {
      avgLatency: avgLatency.toFixed(2),
      slowRoutes,
      errorRoutes
    };

    // Identify bottlenecks
    if (avgLatency > 500) {
      analysis.bottlenecks.push({
        level,
        issue: `High average latency (${avgLatency.toFixed(2)}ms)`,
        severity: 'critical'
      });
    } else if (avgLatency > 200) {
      analysis.bottlenecks.push({
        level,
        issue: `Moderate latency (${avgLatency.toFixed(2)}ms)`,
        severity: 'warning'
      });
    }

    if (slowRoutes.length > 0) {
      for (const slow of slowRoutes) {
        analysis.bottlenecks.push({
          level,
          issue: `${slow.route} is slow (${slow.latency}ms)`,
          severity: 'critical'
        });
      }
    }

    if (errorRoutes.length > 0) {
      for (const err of errorRoutes) {
        analysis.bottlenecks.push({
          level,
          issue: `${err.route} has errors (${err.errors} errors, ${err.non2xx} non-2xx)`,
          severity: 'critical'
        });
      }
    }
  }

  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis);

  // Calculate scalability score (0-100)
  analysis.scalabilityScore = calculateScalabilityScore(analysis);

  return analysis;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(analysis) {
  const recommendations = [];

  // Check if there are critical bottlenecks
  const criticalBottlenecks = analysis.bottlenecks.filter(b => b.severity === 'critical');
  
  if (criticalBottlenecks.length > 0) {
    recommendations.push({
      priority: 'high',
      issue: 'Critical performance bottlenecks detected',
      suggestions: [
        'Add database indexes on frequently queried fields',
        'Implement caching (Redis/Memcached) for read-heavy operations',
        'Optimize database queries (avoid N+1 queries)',
        'Use connection pooling for database connections',
        'Consider horizontal scaling (load balancing)'
      ]
    });
  }

  // Check latency trends
  const levels = Object.keys(analysis.summary).map(Number).sort((a, b) => a - b);
  if (levels.length >= 2) {
    const firstLatency = parseFloat(analysis.summary[levels[0]].avgLatency);
    const lastLatency = parseFloat(analysis.summary[levels[levels.length - 1]].avgLatency);
    
    if (lastLatency > firstLatency * 3) {
      recommendations.push({
        priority: 'high',
        issue: 'Performance degrades significantly at scale',
        suggestions: [
          'Implement API rate limiting',
          'Add request queuing for burst traffic',
          'Scale backend horizontally (multiple instances)',
          'Use a CDN for static assets',
          'Implement database read replicas'
        ]
      });
    }
  }

  // General optimization recommendations
  recommendations.push({
    priority: 'medium',
    issue: 'General optimizations',
    suggestions: [
      'Enable GZIP compression for responses',
      'Implement pagination for list endpoints',
      'Use async/await properly to avoid blocking',
      'Monitor database query performance',
      'Set up proper logging and monitoring'
    ]
  });

  return recommendations;
}

/**
 * Calculate scalability score (0-100)
 */
function calculateScalabilityScore(analysis) {
  let score = 100;

  // Deduct for bottlenecks
  const criticalCount = analysis.bottlenecks.filter(b => b.severity === 'critical').length;
  const warningCount = analysis.bottlenecks.filter(b => b.severity === 'warning').length;

  score -= criticalCount * 15;
  score -= warningCount * 5;

  // Deduct for high latency
  const levels = Object.keys(analysis.summary);
  for (const level of levels) {
    const avgLatency = parseFloat(analysis.summary[level].avgLatency);
    if (avgLatency > 1000) score -= 10;
    else if (avgLatency > 500) score -= 5;
    else if (avgLatency > 200) score -= 2;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate formatted report
 */
export function generateReport(analysis, startupMode = false) {
  let report = '';

  report += chalk.bold.cyan('\n=============================================================\n');
  report += chalk.bold.cyan('         OFFBYT SCALABILITY REPORT\n');
  report += chalk.bold.cyan('=============================================================\n\n');

  // Scalability Score
  const score = analysis.scalabilityScore;
  let scoreColor = chalk.green;
  let scoreLabel = 'Excellent';
  
  if (score < 50) {
    scoreColor = chalk.red;
    scoreLabel = 'Poor';
  } else if (score < 70) {
    scoreColor = chalk.yellow;
    scoreLabel = 'Fair';
  } else if (score < 85) {
    scoreColor = chalk.blue;
    scoreLabel = 'Good';
  }

  report += chalk.bold('ðŸ“Š Scalability Score: ') + scoreColor.bold(`${score}/100 (${scoreLabel})`) + '\n\n';

  // Summary for each load level
  report += chalk.bold.yellow('ðŸ“ˆ Performance Summary:\n\n');
  
  const levels = Object.keys(analysis.summary).map(Number).sort((a, b) => a - b);
  for (const level of levels) {
    const summary = analysis.summary[level];
    const latency = parseFloat(summary.avgLatency);
    
    let icon = 'âœ…';
    let color = chalk.green;
    
    if (latency > 500) {
      icon = 'âŒ';
      color = chalk.red;
    } else if (latency > 200) {
      icon = 'âš ï¸ ';
      color = chalk.yellow;
    }
    
    report += color(`${icon} ${level} concurrent users â†’ Avg latency: ${summary.avgLatency}ms\n`);
    
    if (summary.slowRoutes.length > 0) {
      for (const slow of summary.slowRoutes) {
        report += color(`   â””â”€ ${slow.route} is slow (${slow.latency}ms)\n`);
      }
    }
  }

  report += '\n';

  // Startup Growth Simulation (if enabled)
  if (startupMode) {
    report += chalk.bold.magenta('ðŸš€ Startup Growth Simulation:\n\n');
    report += chalk.gray('Month 1  â†’   100 users    âœ… Stable\n');
    report += chalk.gray('Month 3  â†’   1,000 users  âœ… Stable\n');
    
    if (score < 70) {
      report += chalk.yellow('Month 6  â†’  10,000 users  âš ï¸  Performance issues expected\n');
      report += chalk.red('Month 12 â†’ 100,000 users  âŒ System will struggle\n\n');
      report += chalk.red.bold('âš ï¸  System needs optimization before scaling to 10k+ users\n');
    } else {
      report += chalk.green('Month 6  â†’  10,000 users  âœ… Stable\n');
      report += chalk.cyan('Month 12 â†’ 100,000 users  ðŸ”µ Consider scaling plan\n');
    }
    
    report += '\n';
  }

  // Bottlenecks
  if (analysis.bottlenecks.length > 0) {
    report += chalk.bold.red('ðŸ”´ Detected Bottlenecks:\n\n');
    
    for (const bottleneck of analysis.bottlenecks.slice(0, 10)) {
      const icon = bottleneck.severity === 'critical' ? 'âŒ' : 'âš ï¸ ';
      const color = bottleneck.severity === 'critical' ? chalk.red : chalk.yellow;
      report += color(`${icon} ${bottleneck.issue} (at ${bottleneck.level} users)\n`);
    }
    
    report += '\n';
  }

  // Recommendations
  report += chalk.bold.blue('ðŸ’¡ Recommended Optimizations:\n\n');
  
  for (const rec of analysis.recommendations) {
    const priorityLabel = rec.priority === 'high' ? chalk.red('[HIGH]') : chalk.yellow('[MEDIUM]');
    report += `${priorityLabel} ${chalk.bold(rec.issue)}\n`;
    
    for (const suggestion of rec.suggestions.slice(0, 5)) {
      report += chalk.gray(`   â€¢ ${suggestion}\n`);
    }
    
    report += '\n';
  }

  // Footer
  report += chalk.cyan('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n');
  report += chalk.gray('Generated by offbyt Benchmark Tool\n');
  
  return report;
}

export default { analyzePerformance, generateReport };

