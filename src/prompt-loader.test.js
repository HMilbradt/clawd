import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock fs/promises
const mockReadFile = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
}));

const { loadPrompt } = await import('./prompt-loader.js');

describe('loadPrompt', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    test('should load a prompt file from the prompts directory', async () => {
      const promptContent = 'This is a test prompt';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('test-prompt');

      const expectedPath = path.join(__dirname, '..', 'prompts', 'test-prompt.md');
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(result).toBe(promptContent);
    });

    test('should return prompt content without modifications when no variables provided', async () => {
      const promptContent = 'Simple prompt with no placeholders';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('simple');

      expect(result).toBe(promptContent);
    });

    test('should handle empty variables object', async () => {
      const promptContent = 'Prompt content';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('test', {});

      expect(result).toBe(promptContent);
    });
  });

  describe('variable replacement', () => {
    test('should replace a single placeholder with variable value', async () => {
      const promptContent = 'Hello {{name}}!';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('greeting', { name: 'World' });

      expect(result).toBe('Hello World!');
    });

    test('should replace multiple different placeholders', async () => {
      const promptContent = 'Project: {{projectName}}, Goal: {{goal}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('project', {
        projectName: 'MyApp',
        goal: 'Build features'
      });

      expect(result).toBe('Project: MyApp, Goal: Build features');
    });

    test('should replace the same placeholder multiple times', async () => {
      const promptContent = '{{name}} said {{name}} is {{name}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('repeat', { name: 'Alice' });

      expect(result).toBe('Alice said Alice is Alice');
    });

    test('should handle complex multiline prompts with multiple variables', async () => {
      const promptContent = `Project Brief: {{projectBrief}}
Goal: {{goal}}

Current Phase: {{phaseName}}
Current Step: {{stepDescription}}`;
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('complex', {
        projectBrief: 'Build a web app',
        goal: 'Create authentication',
        phaseName: 'Phase 1',
        stepDescription: 'Setup database'
      });

      const expected = `Project Brief: Build a web app
Goal: Create authentication

Current Phase: Phase 1
Current Step: Setup database`;
      expect(result).toBe(expected);
    });

    test('should leave unreplaced placeholders unchanged', async () => {
      const promptContent = 'Hello {{name}}, your id is {{userId}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('partial', { name: 'Bob' });

      expect(result).toBe('Hello Bob, your id is {{userId}}');
    });

    test('should handle variables with special regex characters', async () => {
      const promptContent = 'Value: {{value}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('special', { value: 'test$special*chars.' });

      expect(result).toBe('Value: test$special*chars.');
    });

    test('should handle empty string variable values', async () => {
      const promptContent = 'Start{{middle}}End';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('empty', { middle: '' });

      expect(result).toBe('StartEnd');
    });

    test('should handle numeric variable values', async () => {
      const promptContent = 'Count: {{count}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('numeric', { count: 42 });

      expect(result).toBe('Count: 42');
    });

    test('should handle whitespace in placeholder names', async () => {
      const promptContent = 'Value: {{  spaced  }}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('whitespace', { '  spaced  ': 'trimmed' });

      expect(result).toBe('Value: trimmed');
    });
  });

  describe('edge cases', () => {
    test('should handle empty prompt file', async () => {
      mockReadFile.mockResolvedValue('');

      const result = await loadPrompt('empty');

      expect(result).toBe('');
    });

    test('should handle prompt file with only whitespace', async () => {
      const promptContent = '   \n\t  \n  ';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('whitespace-only');

      expect(result).toBe(promptContent);
    });

    test('should handle variables with newlines', async () => {
      const promptContent = 'Content: {{text}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('multiline-var', {
        text: 'Line 1\nLine 2\nLine 3'
      });

      expect(result).toBe('Content: Line 1\nLine 2\nLine 3');
    });

    test('should handle placeholder-like text without matching variables', async () => {
      const promptContent = 'Use {{variable}} syntax for templates';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('instruction');

      expect(result).toBe('Use {{variable}} syntax for templates');
    });

    test('should handle nested braces', async () => {
      const promptContent = 'Code: {{code}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('nested', {
        code: 'if (obj) { return obj.value; }'
      });

      expect(result).toBe('Code: if (obj) { return obj.value; }');
    });

    test('should handle malformed placeholders (single braces)', async () => {
      const promptContent = 'Single {brace} or {variable}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('malformed', { brace: 'test', variable: 'test2' });

      expect(result).toBe('Single {brace} or {variable}');
    });

    test('should handle extra variables that are not in template', async () => {
      const promptContent = 'Hello {{name}}';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('extra', {
        name: 'World',
        unused: 'Extra',
        another: 'Value'
      });

      expect(result).toBe('Hello World');
    });
  });

  describe('error handling', () => {
    test('should propagate file read errors', async () => {
      const error = new Error('File not found');
      mockReadFile.mockRejectedValue(error);

      await expect(loadPrompt('nonexistent')).rejects.toThrow('File not found');
    });

    test('should propagate ENOENT errors', async () => {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      await expect(loadPrompt('missing')).rejects.toThrow('ENOENT');
    });

    test('should propagate permission errors', async () => {
      const error = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      mockReadFile.mockRejectedValue(error);

      await expect(loadPrompt('forbidden')).rejects.toThrow('EACCES');
    });
  });

  describe('path construction', () => {
    test('should append .md extension to prompt name', async () => {
      mockReadFile.mockResolvedValue('content');

      await loadPrompt('my-prompt');

      const expectedPath = path.join(__dirname, '..', 'prompts', 'my-prompt.md');
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    test('should handle prompt names with hyphens', async () => {
      mockReadFile.mockResolvedValue('content');

      await loadPrompt('task-execution');

      const expectedPath = path.join(__dirname, '..', 'prompts', 'task-execution.md');
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    test('should construct correct path from src directory', async () => {
      mockReadFile.mockResolvedValue('content');

      await loadPrompt('test');

      const args = mockReadFile.mock.calls[0];
      expect(args[0]).toContain('prompts');
      expect(args[0]).toContain('test.md');
      expect(args[0]).not.toContain('src/prompts');
    });
  });

  describe('real-world scenarios', () => {
    test('should handle task-execution prompt format', async () => {
      const promptContent = `You are working on a project with the following context:

Project Brief: {{projectBrief}}
Goal: {{goal}}

Current Phase: {{phaseName}}
Current Step: {{stepDescription}}

Complete this specific step.`;
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('task-execution', {
        projectBrief: 'Build a REST API',
        goal: 'Implement user authentication',
        phaseName: 'Phase 1: Setup',
        stepDescription: 'Create user model and database schema'
      });

      expect(result).toContain('Build a REST API');
      expect(result).toContain('Implement user authentication');
      expect(result).toContain('Phase 1: Setup');
      expect(result).toContain('Create user model and database schema');
    });

    test('should handle prompts with markdown formatting', async () => {
      const promptContent = `# {{title}}

## Description
{{description}}

### Steps
- {{step1}}
- {{step2}}`;
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('markdown', {
        title: 'Feature Request',
        description: 'Add new feature',
        step1: 'Design',
        step2: 'Implement'
      });

      expect(result).toContain('# Feature Request');
      expect(result).toContain('Add new feature');
      expect(result).toContain('- Design');
      expect(result).toContain('- Implement');
    });

    test('should handle prompts with code blocks', async () => {
      const promptContent = 'Execute: {{command}}\n\nExample:\n```\n{{example}}\n```';
      mockReadFile.mockResolvedValue(promptContent);

      const result = await loadPrompt('code', {
        command: 'npm test',
        example: 'console.log("test");'
      });

      expect(result).toContain('Execute: npm test');
      expect(result).toContain('console.log("test");');
    });
  });
});
