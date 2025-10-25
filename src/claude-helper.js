import { spawn } from 'child_process';
import logger from './logger.js';

/**
 * Spawns Claude in non-interactive mode and returns the output
 * @param {string} prompt - The prompt to send to Claude
 * @param {boolean} logPrompt - Whether to log the prompt (default: false)
 * @returns {Promise<string>} - The output from Claude
 */
export async function spawnClaude(prompt, logPrompt = false) {
  return new Promise((resolve, reject) => {
    if (logPrompt) {
      logger.info(`Prompt: ${prompt}`);
    }

    const claude = spawn('claude', ['--dangerously-skip-permissions', '-p', prompt], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately - Claude doesn't need it in -p mode
    claude.stdin.end();

    let output = '';
    let errorOutput = '';

    claude.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
    });

    claude.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
    });

    claude.on('error', (err) => {
      logger.error(`Failed to spawn Claude: ${err.message}`);
      reject(new Error(`Failed to spawn Claude: ${err.message}`));
    });

    claude.on('close', (code) => {
      if (code !== 0) {
        // Capture both stdout and stderr for better error context
        const fullOutput = output.trim();
        const fullError = errorOutput.trim();

        // Log with more detail
        logger.error(`Claude process failed with exit code ${code}`, {
          exitCode: code,
          stdout: fullOutput || '(empty)',
          stderr: fullError || '(empty)',
          command: 'claude --dangerously-skip-permissions -p [prompt]'
        });

        // Create detailed error message
        const errorDetails = [];
        if (fullOutput) errorDetails.push(`stdout: ${fullOutput}`);
        if (fullError) errorDetails.push(`stderr: ${fullError}`);
        const errorMessage = errorDetails.length > 0
          ? errorDetails.join(' | ')
          : 'No output captured';

        reject(new Error(`Claude failed (exit code ${code}): ${errorMessage}`));
        return;
      }

      resolve(output);
    });
  });
}
