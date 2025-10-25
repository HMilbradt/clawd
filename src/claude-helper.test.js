import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Create mocks before importing the module under test
const mockSpawn = jest.fn();
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
}));

jest.unstable_mockModule('./logger.js', () => ({
  default: mockLogger,
}));

const { spawnClaude } = await import('./claude-helper.js');

describe('spawnClaude', () => {
  let mockChildProcess;

  beforeEach(() => {
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdin = {
      end: jest.fn(),
    };
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful execution', () => {
    test('should spawn claude with correct arguments', async () => {
      const prompt = 'test prompt';
      const promise = spawnClaude(prompt);

      // Simulate successful output
      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--dangerously-skip-permissions', '-p', prompt],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
    });

    test('should close stdin immediately', async () => {
      const promise = spawnClaude('test');

      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockChildProcess.stdin.end).toHaveBeenCalled();
    });

    test('should resolve with output from stdout', async () => {
      const expectedOutput = 'Claude response output';
      const promise = spawnClaude('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from(expectedOutput));
      mockChildProcess.emit('close', 0);

      const result = await promise;

      expect(result).toBe(expectedOutput);
    });

    test('should concatenate multiple stdout chunks', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('Hello '));
      mockChildProcess.stdout.emit('data', Buffer.from('World'));
      mockChildProcess.emit('close', 0);

      const result = await promise;

      expect(result).toBe('Hello World');
    });

    test('should log prompt when logPrompt is true', async () => {
      const prompt = 'test prompt';
      const promise = spawnClaude(prompt, true);

      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockLogger.info).toHaveBeenCalledWith(`Prompt: ${prompt}`);
    });

    test('should not log prompt when logPrompt is false', async () => {
      const promise = spawnClaude('test prompt', false);

      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('should not log prompt when logPrompt is not provided', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should reject when spawn fails', async () => {
      const errorMessage = 'spawn ENOENT';
      const promise = spawnClaude('test prompt');

      mockChildProcess.emit('error', new Error(errorMessage));

      await expect(promise).rejects.toThrow(`Failed to spawn Claude: ${errorMessage}`);
    });

    test('should log error when spawn fails', async () => {
      const errorMessage = 'spawn ENOENT';
      const promise = spawnClaude('test prompt');

      mockChildProcess.emit('error', new Error(errorMessage));

      await expect(promise).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to spawn Claude: ${errorMessage}`);
    });

    test('should reject when claude exits with non-zero code', async () => {
      const errorOutput = 'Claude error message';
      const promise = spawnClaude('test prompt');

      mockChildProcess.stderr.emit('data', Buffer.from(errorOutput));
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow(`Claude failed (exit code 1): stderr: ${errorOutput}`);
    });

    test('should log error when claude exits with non-zero code', async () => {
      const errorOutput = 'Claude error message';
      const promise = spawnClaude('test prompt');

      mockChildProcess.stderr.emit('data', Buffer.from(errorOutput));
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Claude process failed with exit code 1',
        expect.objectContaining({
          exitCode: 1,
          stderr: errorOutput,
          stdout: '(empty)'
        })
      );
    });

    test('should handle multiple stderr chunks before failure', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.stderr.emit('data', Buffer.from('Error part 1 '));
      mockChildProcess.stderr.emit('data', Buffer.from('Error part 2'));
      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('Claude failed (exit code 1): stderr: Error part 1 Error part 2');
    });

    test('should handle empty stderr on failure', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('Claude failed (exit code 1): No output captured');
    });
  });

  describe('edge cases', () => {
    test('should handle empty output', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.emit('close', 0);

      const result = await promise;

      expect(result).toBe('');
    });

    test('should handle empty prompt', async () => {
      const promise = spawnClaude('');

      mockChildProcess.stdout.emit('data', Buffer.from('response'));
      mockChildProcess.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--dangerously-skip-permissions', '-p', ''],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
    });

    test('should handle stdout and stderr output together', async () => {
      const promise = spawnClaude('test prompt');

      mockChildProcess.stdout.emit('data', Buffer.from('output'));
      mockChildProcess.stderr.emit('data', Buffer.from('warning'));
      mockChildProcess.emit('close', 0);

      const result = await promise;

      expect(result).toBe('output');
    });
  });
});
