import logger, { setLoggerTUI } from './logger.js';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Mock the file system
jest.mock('fs');

describe('Logger', () => {
  let consoleLogSpy;
  let mockTUI;

  beforeEach(() => {
    // Spy on console.log for fallback testing
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Create a mock TUI instance
    mockTUI = {
      log: jest.fn()
    };

    // Clear all transports between tests
    logger.clear();

    // Mock file writes
    jest.spyOn(fs, 'writeFileSync').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Winston Logger Configuration', () => {
    test('should be a winston logger instance', () => {
      expect(logger).toBeInstanceOf(winston.Logger);
    });

    test('should have default log level of info', () => {
      expect(logger.level).toBe('info');
    });

    test('should have correct format configuration', () => {
      expect(logger.format).toBeDefined();
    });
  });

  describe('TUITransport', () => {
    test('should log to console when TUI is not set', (done) => {
      // Re-add the TUI transport for this test
      const TUITransport = require('./logger.js').default.transports.find(
        t => t.constructor.name === 'TUITransport'
      );

      if (TUITransport) {
        logger.add(TUITransport);
      }

      logger.info('Test message');

      setTimeout(() => {
        expect(consoleLogSpy).toHaveBeenCalled();
        const call = consoleLogSpy.mock.calls[0][0];
        expect(call).toContain('info');
        expect(call).toContain('Test message');
        done();
      }, 50);
    });

    test('should log to TUI when TUI is set', (done) => {
      setLoggerTUI(mockTUI);

      logger.info('Test TUI message');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        const call = mockTUI.log.mock.calls[0];
        expect(call[0]).toContain('info');
        expect(call[0]).toContain('Test TUI message');
        expect(call[1]).toBe('info');
        done();
      }, 50);
    });

    test('should map winston levels to TUI levels correctly', (done) => {
      setLoggerTUI(mockTUI);

      const testCases = [
        { method: 'error', expectedLevel: 'error', message: 'Error message' },
        { method: 'warn', expectedLevel: 'warn', message: 'Warning message' },
        { method: 'info', expectedLevel: 'info', message: 'Info message' },
        { method: 'debug', expectedLevel: 'debug', message: 'Debug message' }
      ];

      let callCount = 0;
      const checkComplete = () => {
        callCount++;
        if (callCount === testCases.length) {
          testCases.forEach((testCase, index) => {
            const call = mockTUI.log.mock.calls[index];
            expect(call[0]).toContain(testCase.message);
            expect(call[1]).toBe(testCase.expectedLevel);
          });
          done();
        }
      };

      testCases.forEach(testCase => {
        logger[testCase.method](testCase.message);
        setTimeout(checkComplete, 10);
      });
    });
  });

  describe('setLoggerTUI', () => {
    test('should set TUI instance on the transport', () => {
      setLoggerTUI(mockTUI);
      logger.info('Test after setting TUI');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
      }, 50);
    });

    test('should accept null TUI and fallback to console', (done) => {
      setLoggerTUI(null);
      logger.info('Test with null TUI');

      setTimeout(() => {
        expect(consoleLogSpy).toHaveBeenCalled();
        done();
      }, 50);
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      setLoggerTUI(mockTUI);
    });

    test('should log error messages', (done) => {
      logger.error('Error occurred');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        const call = mockTUI.log.mock.calls[0];
        expect(call[0]).toContain('error');
        expect(call[0]).toContain('Error occurred');
        done();
      }, 50);
    });

    test('should log warning messages', (done) => {
      logger.warn('Warning message');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        const call = mockTUI.log.mock.calls[0];
        expect(call[0]).toContain('warn');
        expect(call[0]).toContain('Warning message');
        done();
      }, 50);
    });

    test('should log info messages', (done) => {
      logger.info('Information message');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        const call = mockTUI.log.mock.calls[0];
        expect(call[0]).toContain('info');
        expect(call[0]).toContain('Information message');
        done();
      }, 50);
    });

    test('should include timestamp in log messages', (done) => {
      logger.info('Timestamped message');

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        const call = mockTUI.log.mock.calls[0][0];
        // Check for timestamp format YYYY-MM-DD HH:mm:ss
        expect(call).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        done();
      }, 50);
    });
  });

  describe('Log Formatting', () => {
    beforeEach(() => {
      setLoggerTUI(mockTUI);
    });

    test('should format messages with objects', (done) => {
      logger.info('User data', { userId: 123, name: 'Test' });

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        done();
      }, 50);
    });

    test('should handle errors with stack traces', (done) => {
      const error = new Error('Test error');
      logger.error('An error occurred', error);

      setTimeout(() => {
        expect(mockTUI.log).toHaveBeenCalled();
        done();
      }, 50);
    });
  });
});
