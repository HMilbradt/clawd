import { jest } from '@jest/globals';
import path from 'path';

// Mock dependencies
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};
const mockSpawnClaude = jest.fn();
const mockLoadPrompt = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
    readFile: mockReadFile,
  },
}));

jest.unstable_mockModule('./logger.js', () => ({
  default: mockLogger,
}));

jest.unstable_mockModule('./claude-helper.js', () => ({
  spawnClaude: mockSpawnClaude,
}));

jest.unstable_mockModule('./prompt-loader.js', () => ({
  loadPrompt: mockLoadPrompt,
}));

const { generatePlan, loadPlan, updatePlanProgress } = await import('./planner.js');

describe('planner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePlan', () => {
    test('should generate a plan from user prompt', async () => {
      const userPrompt = 'Build a REST API';
      const renderedPrompt = 'Rendered prompt with: Build a REST API';
      const claudeOutput = '## Phase 1: Setup\n- [ ] Initialize project';

      mockLoadPrompt.mockResolvedValue(renderedPrompt);
      mockSpawnClaude.mockResolvedValue(claudeOutput);
      mockWriteFile.mockResolvedValue();

      const result = await generatePlan(userPrompt);

      expect(mockLogger.info).toHaveBeenCalledWith('Generating project plan...');
      expect(mockLoadPrompt).toHaveBeenCalledWith('plan-generation', { userPrompt });
      expect(mockSpawnClaude).toHaveBeenCalledWith(renderedPrompt, true);
      expect(result).toBe(claudeOutput);
    });

    test('should save plan to PROJECT_PLAN.md in current working directory', async () => {
      const userPrompt = 'Create a web app';
      const claudeOutput = 'Plan content';

      mockLoadPrompt.mockResolvedValue('prompt');
      mockSpawnClaude.mockResolvedValue(claudeOutput);
      mockWriteFile.mockResolvedValue();

      await generatePlan(userPrompt);

      const expectedPath = path.join(process.cwd(), 'PROJECT_PLAN.md');
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, claudeOutput);
    });

    test('should log when plan is saved', async () => {
      const claudeOutput = 'Plan content';
      mockLoadPrompt.mockResolvedValue('prompt');
      mockSpawnClaude.mockResolvedValue(claudeOutput);
      mockWriteFile.mockResolvedValue();

      await generatePlan('test prompt');

      const expectedPath = path.join(process.cwd(), 'PROJECT_PLAN.md');
      expect(mockLogger.info).toHaveBeenCalledWith(`Project plan saved to ${expectedPath}`);
    });

    test('should pass logPrompt=true to spawnClaude', async () => {
      mockLoadPrompt.mockResolvedValue('prompt');
      mockSpawnClaude.mockResolvedValue('output');
      mockWriteFile.mockResolvedValue();

      await generatePlan('test');

      expect(mockSpawnClaude).toHaveBeenCalledWith(expect.any(String), true);
    });

    test('should propagate errors from loadPrompt', async () => {
      const error = new Error('Failed to load prompt');
      mockLoadPrompt.mockRejectedValue(error);

      await expect(generatePlan('test')).rejects.toThrow('Failed to load prompt');
    });

    test('should propagate errors from spawnClaude', async () => {
      const error = new Error('Claude failed');
      mockLoadPrompt.mockResolvedValue('prompt');
      mockSpawnClaude.mockRejectedValue(error);

      await expect(generatePlan('test')).rejects.toThrow('Claude failed');
    });

    test('should propagate errors from writeFile', async () => {
      const error = new Error('Write failed');
      mockLoadPrompt.mockResolvedValue('prompt');
      mockSpawnClaude.mockResolvedValue('output');
      mockWriteFile.mockRejectedValue(error);

      await expect(generatePlan('test')).rejects.toThrow('Write failed');
    });

    test('should handle empty user prompt', async () => {
      mockLoadPrompt.mockResolvedValue('rendered');
      mockSpawnClaude.mockResolvedValue('plan');
      mockWriteFile.mockResolvedValue();

      await generatePlan('');

      expect(mockLoadPrompt).toHaveBeenCalledWith('plan-generation', { userPrompt: '' });
    });

    test('should handle multiline user prompt', async () => {
      const userPrompt = 'Build app\nwith features:\n- Auth\n- API';
      mockLoadPrompt.mockResolvedValue('rendered');
      mockSpawnClaude.mockResolvedValue('plan');
      mockWriteFile.mockResolvedValue();

      await generatePlan(userPrompt);

      expect(mockLoadPrompt).toHaveBeenCalledWith('plan-generation', { userPrompt });
    });
  });

  describe('loadPlan', () => {
    test('should load and parse a plan with single phase', async () => {
      const planContent = `## Phase 1: Setup
- [ ] Initialize project
- [x] Create files`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      const expectedPath = path.join(process.cwd(), 'PROJECT_PLAN.md');
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(result).toEqual([
        {
          name: 'Setup',
          steps: [
            { done: false, description: 'Initialize project' },
            { done: true, description: 'Create files' }
          ]
        }
      ]);
    });

    test('should load and parse a plan with multiple phases', async () => {
      const planContent = `## Phase 1: Setup
- [ ] Initialize project

## Phase 2: Development
- [ ] Write code
- [x] Run tests

## Phase 3: Deploy
- [ ] Deploy to production`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result).toEqual([
        {
          name: 'Setup',
          steps: [{ done: false, description: 'Initialize project' }]
        },
        {
          name: 'Development',
          steps: [
            { done: false, description: 'Write code' },
            { done: true, description: 'Run tests' }
          ]
        },
        {
          name: 'Deploy',
          steps: [{ done: false, description: 'Deploy to production' }]
        }
      ]);
    });

    test('should handle plan with no phases', async () => {
      const planContent = `# Project Plan
This is just text`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result).toEqual([]);
    });

    test('should handle phase with no steps', async () => {
      const planContent = `## Phase 1: Setup

Some description text

## Phase 2: Development
- [ ] First step`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result).toEqual([
        { name: 'Setup', steps: [] },
        { name: 'Development', steps: [{ done: false, description: 'First step' }] }
      ]);
    });

    test('should ignore non-checklist items', async () => {
      const planContent = `## Phase 1: Setup
- [ ] Valid step
- Not a checklist
* Different bullet
- [x] Another valid step`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result[0].steps).toEqual([
        { done: false, description: 'Valid step' },
        { done: true, description: 'Another valid step' }
      ]);
    });

    test('should handle phases with various numbering', async () => {
      const planContent = `## Phase 1: First
- [ ] Step 1

## Phase 2: Second
- [ ] Step 2

## Phase 10: Tenth
- [ ] Step 10`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
      expect(result[2].name).toBe('Tenth');
    });

    test('should trim whitespace from phase names and step descriptions', async () => {
      const planContent = `## Phase 1:   Setup with spaces
- [ ]   Initialize project with spaces   `;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result[0].name).toBe('Setup with spaces');
      expect(result[0].steps[0].description).toBe('Initialize project with spaces');
    });

    test('should handle empty plan file', async () => {
      mockReadFile.mockResolvedValue('');

      const result = await loadPlan();

      expect(result).toEqual([]);
    });

    test('should handle plan with only whitespace', async () => {
      mockReadFile.mockResolvedValue('\n\n\t\n  \n');

      const result = await loadPlan();

      expect(result).toEqual([]);
    });

    test('should propagate file read errors', async () => {
      const error = new Error('File not found');
      mockReadFile.mockRejectedValue(error);

      await expect(loadPlan()).rejects.toThrow('File not found');
    });

    test('should handle mixed case in checkbox markers', async () => {
      const planContent = `## Phase 1: Test
- [ ] Not done
- [x] Done`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      expect(result[0].steps).toEqual([
        { done: false, description: 'Not done' },
        { done: true, description: 'Done' }
      ]);
    });

    test('should handle steps before first phase header', async () => {
      const planContent = `# Project Plan
- [ ] Orphan step

## Phase 1: Setup
- [ ] Real step`;

      mockReadFile.mockResolvedValue(planContent);

      const result = await loadPlan();

      // Orphan steps should be ignored since there's no currentPhase
      expect(result).toEqual([
        {
          name: 'Setup',
          steps: [{ done: false, description: 'Real step' }]
        }
      ]);
    });
  });

  describe('updatePlanProgress', () => {
    test('should update step completion status', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step 1
- [ ] Step 2`;

      const phases = [
        {
          name: 'Setup',
          steps: [
            { done: true, description: 'Step 1' },
            { done: false, description: 'Step 2' }
          ]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `## Phase 1: Setup
- [x] Step 1
- [ ] Step 2`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should update multiple phases', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step 1

## Phase 2: Dev
- [ ] Step 2
- [ ] Step 3`;

      const phases = [
        {
          name: 'Setup',
          steps: [{ done: true, description: 'Step 1' }]
        },
        {
          name: 'Dev',
          steps: [
            { done: true, description: 'Step 2' },
            { done: true, description: 'Step 3' }
          ]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `## Phase 1: Setup
- [x] Step 1

## Phase 2: Dev
- [x] Step 2
- [x] Step 3`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should preserve non-checklist lines', async () => {
      const originalContent = `# Project Plan
Some description

## Phase 1: Setup
This is a note
- [ ] Step 1
Another note
- [ ] Step 2`;

      const phases = [
        {
          name: 'Setup',
          steps: [
            { done: true, description: 'Step 1' },
            { done: false, description: 'Step 2' }
          ]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `# Project Plan
Some description

## Phase 1: Setup
This is a note
- [x] Step 1
Another note
- [ ] Step 2`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should handle marking step as not done', async () => {
      const originalContent = `## Phase 1: Setup
- [x] Step 1`;

      const phases = [
        {
          name: 'Setup',
          steps: [{ done: false, description: 'Step 1' }]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `## Phase 1: Setup
- [ ] Step 1`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should handle empty phases array', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step 1`;

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress([]);

      // Steps should remain unchanged since no phase data is provided
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        originalContent
      );
    });

    test('should preserve step description text exactly', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step with special chars !@#$%
- [ ] Step with    extra   spaces`;

      const phases = [
        {
          name: 'Setup',
          steps: [
            { done: true, description: 'Step with special chars !@#$%' },
            { done: true, description: 'Step with    extra   spaces' }
          ]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `## Phase 1: Setup
- [x] Step with special chars !@#$%
- [x] Step with    extra   spaces`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should handle mismatched number of steps', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3`;

      const phases = [
        {
          name: 'Setup',
          steps: [
            { done: true, description: 'Step 1' }
            // Only one step provided
          ]
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedOutput = `## Phase 1: Setup
- [x] Step 1
- [ ] Step 2
- [ ] Step 3`;

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        expectedOutput
      );
    });

    test('should read from and write to PROJECT_PLAN.md in cwd', async () => {
      const phases = [];
      mockReadFile.mockResolvedValue('');
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      const expectedPath = path.join(process.cwd(), 'PROJECT_PLAN.md');
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expect.any(String));
    });

    test('should propagate file read errors', async () => {
      const error = new Error('Read failed');
      mockReadFile.mockRejectedValue(error);

      await expect(updatePlanProgress([])).rejects.toThrow('Read failed');
    });

    test('should propagate file write errors', async () => {
      const error = new Error('Write failed');
      mockReadFile.mockResolvedValue('content');
      mockWriteFile.mockRejectedValue(error);

      await expect(updatePlanProgress([])).rejects.toThrow('Write failed');
    });

    test('should handle phases with empty steps array', async () => {
      const originalContent = `## Phase 1: Setup
- [ ] Step 1`;

      const phases = [
        {
          name: 'Setup',
          steps: []
        }
      ];

      mockReadFile.mockResolvedValue(originalContent);
      mockWriteFile.mockResolvedValue();

      await updatePlanProgress(phases);

      // Should leave step unchanged since phase has no steps in array
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'PROJECT_PLAN.md'),
        originalContent
      );
    });
  });
});
