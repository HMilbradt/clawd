import { jest } from '@jest/globals';
import { expandFeatures } from './expander.js';

// Mock dependencies
jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.unstable_mockModule('./logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('./claude-helper.js', () => ({
  spawnClaude: jest.fn(),
}));

jest.unstable_mockModule('./prompt-loader.js', () => ({
  loadPrompt: jest.fn(),
}));

const fs = (await import('fs/promises')).default;
const logger = (await import('./logger.js')).default;
const { spawnClaude } = await import('./claude-helper.js');
const { loadPrompt } = await import('./prompt-loader.js');

describe('expander', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('expandFeatures', () => {
    const mockProjectBrief = 'Build a task management app';
    const mockGoal = 'Add calendar integration';
    const mockCurrentPlan = '## Phase 1\n- Initial setup';
    const mockExistingPlan = '# Project Plan\n## Phase 1\n- Task creation';
    const mockExpansionOutput = '## Phase 2\n- Calendar sync\n- Reminders';
    const mockExpansionPrompt = 'Expand features prompt with context';

    beforeEach(() => {
      loadPrompt.mockResolvedValue(mockExpansionPrompt);
      spawnClaude.mockResolvedValue(mockExpansionOutput);
      fs.readFile.mockResolvedValue(mockExistingPlan);
      fs.writeFile.mockResolvedValue(undefined);
    });

    it('should load the feature-expansion prompt with correct parameters', async () => {
      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(loadPrompt).toHaveBeenCalledWith('feature-expansion', {
        projectBrief: mockProjectBrief,
        goal: mockGoal,
        currentPlan: mockCurrentPlan,
      });
    });

    it('should call spawnClaude with the expansion prompt', async () => {
      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(spawnClaude).toHaveBeenCalledWith(mockExpansionPrompt);
    });

    it('should read the existing PROJECT_PLAN.md file', async () => {
      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('PROJECT_PLAN.md'),
        'utf-8'
      );
    });

    it('should append new phases to the existing plan', async () => {
      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('PROJECT_PLAN.md'),
        `${mockExistingPlan}\n\n${mockExpansionOutput}`
      );
    });

    it('should log info messages at start and end', async () => {
      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(logger.info).toHaveBeenCalledWith('Researching and expanding features for perpetual mode...');
      expect(logger.info).toHaveBeenCalledWith('New phases added to project plan');
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should return the expansion output from Claude', async () => {
      const result = await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(result).toBe(mockExpansionOutput);
    });

    it('should handle errors when reading the plan file fails', async () => {
      const readError = new Error('File not found');
      fs.readFile.mockRejectedValue(readError);

      await expect(expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan)).rejects.toThrow('File not found');
    });

    it('should handle errors when writing the plan file fails', async () => {
      const writeError = new Error('Permission denied');
      fs.writeFile.mockRejectedValue(writeError);

      await expect(expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan)).rejects.toThrow('Permission denied');
    });

    it('should handle errors when Claude spawning fails', async () => {
      const claudeError = new Error('Claude API error');
      spawnClaude.mockRejectedValue(claudeError);

      await expect(expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan)).rejects.toThrow('Claude API error');
    });

    it('should handle errors when prompt loading fails', async () => {
      const promptError = new Error('Prompt template not found');
      loadPrompt.mockRejectedValue(promptError);

      await expect(expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan)).rejects.toThrow('Prompt template not found');
    });

    it('should preserve existing plan content when appending', async () => {
      const existingContent = '# Existing Plan\n## Phase 1\n- Feature A\n- Feature B';
      fs.readFile.mockResolvedValue(existingContent);

      await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(existingContent)
      );
    });

    it('should work with empty expansion output', async () => {
      spawnClaude.mockResolvedValue('');

      const result = await expandFeatures(mockProjectBrief, mockGoal, mockCurrentPlan);

      expect(result).toBe('');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        `${mockExistingPlan}\n\n`
      );
    });
  });
});
