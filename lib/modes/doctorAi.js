import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import Groq from 'groq-sdk';
import ora from 'ora';

export async function runDoctorAi(projectPath, options) {
  // Fast custom .env loader without dotenv dependency
  try {
    const envContent = await fs.readFile(path.join(projectPath, '.env'), 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let [_, key, value = ''] = match;
        value = value.replace(/^['"]|['"]$/g, ''); // Remove quotes
        process.env[key] = process.env[key] || value; // Don't override existing env vars
      }
    });
  } catch (err) { /* ignore if no .env */ }

  const cmd = options.cmd || 'npm run dev';
  
  const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

  if (!groq) {
    console.warn(chalk.yellow('⚠️ GROQ_API_KEY is not set in environment variables.'));
    console.warn(chalk.yellow('AI analysis will not be available. Please set GROQ_API_KEY to enable doctor-ai.'));
    console.info(chalk.cyan('You can get an API key from https://console.groq.com/keys'));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n🩺 Starting Doctor AI... Monitoring command: ${chalk.bold(cmd)}`));
  console.log(chalk.gray(`Watching directory: ${projectPath}\n`));

  // Split command
  const [command, ...args] = cmd.split(' ');
  // Use shell true to handle npm run dev properly on windows/linux
  const child = spawn(command, args, { cwd: projectPath, shell: true });

  let errorBuffer = '';
  let analysisInProgress = false;

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    const str = data.toString();
    if (str.toLowerCase().includes('error')) {
      errorBuffer += str;
      triggerAnalysis();
    }
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
    errorBuffer += data.toString();
    triggerAnalysis();
  });

  child.on('close', (code) => {
    console.log(chalk.gray(`\nChild process exited with code ${code}`));
  });

  // Debounce the analysis so we don't trigger it 100 times for one stack trace
  let timeoutId = null;
  function triggerAnalysis() {
    if (analysisInProgress) return;
    
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      if (errorBuffer.trim().length > 0 && !analysisInProgress) {
        await analyzeError(errorBuffer);
        errorBuffer = ''; // reset buffer after analysis
      }
    }, 2000); // Wait 2 seconds for stack trace to settle
  }

  async function analyzeError(errorText) {
    analysisInProgress = true;
    const spinner = ora('AI is analyzing the error...').start();
    
    try {
      // 1. Extract potential files from error text
      const filePathsToRead = extractFilesFromError(errorText, projectPath);
      let fileContents = '';

      for (const file of filePathsToRead) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          fileContents += `\n--- File: ${path.relative(projectPath, file)} ---\n\`\`\`javascript\n${content}\n\`\`\`\n`;
        } catch (err) {
          // ignore files that couldn't be read
        }
      }

      // 2. Call Groq
      const prompt = `
You are an expert Backend Developer and AI debugging assistant.
The user's application crashed or produced an error. 
Please analyze the following error trace and the involved file codes to determine the root cause and provide a solution.

ERROR TRACE:
${errorText}

INVOLVED FILES:
${fileContents}

Please provide:
1. **Root Cause**: Why did the error happen?
2. **Solution**: What exactly needs to be changed? Show the code replacements clearly.
3. **Prevention**: How can this be prevented in the future?

Format the output cleanly in Markdown so it can be saved as a report.
`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful, expert AI debugging assistant. Respond in clear markdown."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'No completion generated.';

      // 3. Write to report
      const reportPath = path.join(process.cwd(), 'AI_DEBUG_REPORT.md'); // Write to root where CLI was called
      
      const reportContent = `# 🩺 Doctor AI Debug Report
_Generated on ${new Date().toLocaleString()}_

## Monitored Command
\`${cmd}\`

` + aiResponse;

      await fs.writeFile(reportPath, reportContent);
      spinner.succeed(chalk.green(`Analysis complete! Report saved to ${chalk.bold('AI_DEBUG_REPORT.md')}`));

    } catch (err) {
      spinner.fail(chalk.red('AI Analysis failed.'));
      console.error(chalk.red(err.message));
    } finally {
      analysisInProgress = false;
    }
  }

  function extractFilesFromError(errorText, basePath) {
    // Look for file paths like /path/to/file.js:line:col or C:\path\to\file.js:line:col
    // specifically we look for .js, .jsx, .ts, .tsx files
    const regex = /(?:[a-zA-Z]:[\\/]|[\.\/\\]+)[a-zA-Z0-9_\-\/\\]+\.(js|jsx|ts|tsx)/g;
    const matches = errorText.match(regex) || [];
    
    // Deduplicate and resolve absolute paths
    const uniqueFiles = new Set();
    matches.forEach(match => {
      // Ignore node internal files like internal/modules/... or node_modules
      if (match.includes('node_modules') || match.startsWith('internal/')) return;
      
      const absPath = path.resolve(basePath, match.trim());
      uniqueFiles.add(absPath);
    });
    
    return Array.from(uniqueFiles);
  }
}
