import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { spawnClaude } from './claude-helper.js';
import { loadPrompt } from './prompt-loader.js';
import { getCurrentBranch, checkoutBranch, stageAll, commit, rebase } from './git-setup.js';

export async function generatePlan(userPrompt, useGit = true, cwd = process.cwd()) {
  logger.info('Generating project plan...');

  const planPrompt = await loadPrompt('plan-generation', { userPrompt });
  const output = await spawnClaude(planPrompt, true);

  const planPath = path.join(cwd, 'PROJECT_PLAN.md');
  await fs.writeFile(planPath, output);
  logger.info(`Project plan saved to ${planPath}`);

  // If git integration is enabled, commit plan to a branch and rebase into main
  if (useGit) {
    try {
      // Get current branch (should be main)
      const mainBranch = await getCurrentBranch(cwd);
      logger.info(`Current branch: ${mainBranch}`);

      // Create plan branch
      const planBranch = 'clawd/plan';
      await checkoutBranch(planBranch, cwd);

      // Stage and commit the plan
      await stageAll(cwd);
      await commit('chore: add project plan', cwd);

      // Switch back to main and rebase
      await checkoutBranch(mainBranch, cwd);
      await rebase(planBranch, cwd);

      logger.info('✓ Plan committed and rebased into main');
    } catch (error) {
      logger.error(`Git operations failed: ${error.message}`);
      logger.info('Continuing without git integration...');
    }
  }

  return output;
}

export async function loadPlan() {
  const planPath = path.join(process.cwd(), 'PROJECT_PLAN.md')
  const content = await fs.readFile(planPath, 'utf-8')
  return parsePlan(content)
}

function parsePlan(content) {
  const lines = content.split('\n')
  const phases = []
  let currentPhase = null

  for (const line of lines) {
    // Match phase headers like "## Phase 1: Setup"
    const phaseMatch = line.match(/^##\s+Phase\s+\d+:\s+(.+)/)
    if (phaseMatch) {
      if (currentPhase) {
        phases.push(currentPhase)
      }
      currentPhase = {
        name: phaseMatch[1].trim(),
        steps: []
      }
      continue
    }

    // Match checklist items
    const stepMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/)
    if (stepMatch && currentPhase) {
      currentPhase.steps.push({
        done: stepMatch[1] === 'x',
        description: stepMatch[2].trim()
      })
    }
  }

  if (currentPhase) {
    phases.push(currentPhase)
  }

  return phases
}

export async function updatePlanProgress(phases) {
  const planPath = path.join(process.cwd(), 'PROJECT_PLAN.md')
  const content = await fs.readFile(planPath, 'utf-8')
  const lines = content.split('\n')

  let phaseIndex = -1
  let stepIndex = -1

  const updatedLines = lines.map((line) => {
    const phaseMatch = line.match(/^##\s+Phase\s+\d+:/)
    if (phaseMatch) {
      phaseIndex++
      stepIndex = -1
      return line
    }

    const stepMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/)
    if (stepMatch) {
      stepIndex++
      const phase = phases[phaseIndex]
      if (phase && phase.steps[stepIndex]) {
        const checked = phase.steps[stepIndex].done ? 'x' : ' '
        return `- [${checked}] ${stepMatch[2]}`
      }
    }

    return line
  })

  await fs.writeFile(planPath, updatedLines.join('\n'))
}
