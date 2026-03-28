/**
 * CLI Formatting Utilities
 * Provides attractive visual output for Offbyte CLI
 */

import chalk from 'chalk';

export function printBanner() {
  console.log('\n');
  console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                                ║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue('  ██████╗ ███████╗███████╗██████╗ ██╗   ██╗████████╗          ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue(' ██╔═══██╗██╔════╝██╔════╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝          ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue(' ██║   ██║█████╗  █████╗  ██████╔╝ ╚████╔╝    ██║             ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue(' ██║   ██║██╔══╝  ██╔══╝  ██╔══██╗  ╚██╔╝     ██║             ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue(' ╚██████╔╝██║     ██║     ██████╔╝   ██║      ██║             ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║  ') + chalk.bold.blue('  ╚═════╝ ╚═╝     ╚═╝     ╚═════╝    ╚═╝      ╚═╝             ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('║                                                                ║'));
  console.log(chalk.bold.cyan('║        ') + chalk.bold.white('Backend Generator - Offline + AI Powered') + chalk.bold.cyan('                ║'));
  console.log(chalk.bold.cyan('║                                                                ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════╝'));
  console.log('\n');
}

export function printSection(title) {
  console.log(chalk.bold.cyan('\n╔' + '═'.repeat(title.length + 4) + '╗'));
  console.log(chalk.bold.cyan('║  ' + title + '  ║'));
  console.log(chalk.bold.cyan('╚' + '═'.repeat(title.length + 4) + '╝\n'));
}

export function printStep(number, total, title) {
  console.log(chalk.bold.magenta(`\n>> STEP ${number}/${total}`) + chalk.bold.white(` :: ${title}`));
  console.log(chalk.gray('═'.repeat(60)));
}

export function printSuccess(message) {
  console.log(chalk.green('[OK] ') + chalk.white(message));
}

export function printWarning(message) {
  console.log(chalk.yellow('[WARN] ') + chalk.white(message));
}

export function printError(message) {
  console.log(chalk.red('[ERR] ') + chalk.white(message));
}

export function printInfo(message) {
  console.log(chalk.cyan('[INFO] ') + chalk.white(message));
}

export function printBox(title, items = []) {
  console.log(chalk.bold.cyan('┌─ ' + title));
  for (const item of items) {
    console.log(chalk.cyan('│  ') + chalk.white(item));
  }
  console.log(chalk.cyan('└─\n'));
}

export function printSummary(title, items = []) {
  const safeItems = Array.isArray(items) ? items.map((i) => String(i)) : [];
  const titleText = `  ${String(title || '').toUpperCase()}`;
  const contentWidth = Math.max(64, titleText.length, ...safeItems.map((i) => i.length + 4));

  console.log(chalk.bold.cyan(`\n╔${'═'.repeat(contentWidth)}╗`));
  console.log(chalk.bold.cyan('║') + chalk.bold.green(chalk.bold.white(titleText.padEnd(contentWidth))) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan(`╠${'═'.repeat(contentWidth)}╣`));
  
  for (const item of safeItems) {
    const line = ` - ${item}`;
    console.log(chalk.bold.cyan('║') + chalk.white(line.padEnd(contentWidth)) + chalk.bold.cyan('║'));
  }
  
  console.log(chalk.bold.cyan(`╚${'═'.repeat(contentWidth)}╝\n`));
}

export function printFooter(stepsInput = []) {
  const nextSteps = Array.isArray(stepsInput) ? stepsInput.map((s) => String(s)) : [String(stepsInput)];
  const contentWidth = Math.max(64, '  NEXT STEPS'.length, ...nextSteps.map((s, i) => `${i + 1}. ${s}`.length + 2));

  console.log(chalk.bold.cyan(`\n╔${'═'.repeat(contentWidth)}╗`));
  console.log(chalk.bold.cyan('║') + chalk.bold.yellow('  NEXT STEPS'.padEnd(contentWidth)) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan(`╠${'═'.repeat(contentWidth)}╣`));
  
  nextSteps.forEach((step, idx) => {
    const line = ` ${idx + 1}. ${step}`;
    console.log(chalk.bold.cyan('║') + chalk.white(line.padEnd(contentWidth)) + chalk.bold.cyan('║'));
  });
  
  console.log(chalk.bold.cyan(`╚${'═'.repeat(contentWidth)}╝\n`));
}

export function printTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, Math.max(...rows.map(r => String(r[i] || '').length)));
  });

  // Header
  console.log(chalk.bold.cyan('┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'));
  console.log(
    chalk.bold.cyan('│'),
    colWidths.map((w, i) => chalk.bold.white(headers[i].padEnd(w))).join(chalk.bold.cyan(' │ ')),
    chalk.bold.cyan('│')
  );
  console.log(chalk.bold.cyan('├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'));

  // Rows
  rows.forEach((row) => {
    console.log(
      chalk.cyan('│'),
      colWidths.map((w, i) => String(row[i] || '').padEnd(w)).join(chalk.cyan(' │ ')),
      chalk.cyan('│')
    );
  });

  console.log(chalk.bold.cyan('└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘\n'));
}

export default {
  printBanner,
  printSection,
  printStep,
  printSuccess,
  printWarning,
  printError,
  printInfo,
  printBox,
  printSummary,
  printFooter,
  printTable
};
