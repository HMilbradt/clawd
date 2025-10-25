import { describe, test, expect } from '@jest/globals';

const { detectRateLimit, calculateWaitTime, formatWaitTime } = await import('./rate-limit-handler.js');

describe('rate-limit-handler', () => {
  describe('detectRateLimit', () => {
    test('should detect session limit message', () => {
      const output = 'Session limit reached ∙ resets 10pm';
      const result = detectRateLimit(output);

      expect(result).not.toBeNull();
      expect(result.isRateLimited).toBe(true);
      expect(result.resetTime).toBe('10pm');
      expect(result.message).toBe('Session limit reached');
    });

    test('should extract reset time with colon', () => {
      const output = 'Session limit reached ∙ resets 10:30pm';
      const result = detectRateLimit(output);

      expect(result).not.toBeNull();
      expect(result.resetTime).toBe('10:30pm');
    });

    test('should handle "resets at" format', () => {
      const output = 'Session limit reached ∙ resets at 11pm';
      const result = detectRateLimit(output);

      expect(result).not.toBeNull();
      expect(result.resetTime).toBe('11pm');
    });

    test('should return null for non-rate-limit output', () => {
      const output = 'Some other error message';
      const result = detectRateLimit(output);

      expect(result).toBeNull();
    });

    test('should handle empty output', () => {
      const result = detectRateLimit('');
      expect(result).toBeNull();
    });

    test('should handle null output', () => {
      const result = detectRateLimit(null);
      expect(result).toBeNull();
    });

    test('should detect rate limit without reset time', () => {
      const output = 'Session limit reached';
      const result = detectRateLimit(output);

      expect(result).not.toBeNull();
      expect(result.isRateLimited).toBe(true);
      expect(result.resetTime).toBeNull();
    });
  });

  describe('calculateWaitTime', () => {
    test('should return 15 minutes for null reset time', () => {
      const waitTime = calculateWaitTime(null);
      expect(waitTime).toBe(15 * 60 * 1000);
    });

    test('should return 15 minutes for invalid reset time', () => {
      const waitTime = calculateWaitTime('invalid');
      expect(waitTime).toBe(15 * 60 * 1000);
    });

    test('should calculate wait time for future reset time', () => {
      // Test with a time that should be in the future
      const now = new Date();
      let futureHour = now.getHours() + 1;
      let meridiem = 'am';

      if (futureHour >= 12) {
        meridiem = 'pm';
        if (futureHour > 12) {
          futureHour -= 12;
        }
      }

      const resetTime = `${futureHour}${meridiem}`;
      const waitTime = calculateWaitTime(resetTime);

      // Should be between 0 and 2 hours (accounting for the +1 minute buffer)
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
    });

    test('should handle times in the past (assume next day)', () => {
      const now = new Date();
      let pastHour = now.getHours() - 1;
      let meridiem = 'am';

      if (pastHour < 0) {
        pastHour += 12;
      }

      if (pastHour >= 12) {
        meridiem = 'pm';
        if (pastHour > 12) {
          pastHour -= 12;
        }
      }

      const resetTime = `${pastHour}${meridiem}`;
      const waitTime = calculateWaitTime(resetTime);

      // Should be roughly 23 hours (since it's for tomorrow)
      expect(waitTime).toBeGreaterThan(20 * 60 * 60 * 1000);
      expect(waitTime).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });
  });

  describe('formatWaitTime', () => {
    test('should format minutes correctly', () => {
      expect(formatWaitTime(1 * 60 * 1000)).toBe('1 minute');
      expect(formatWaitTime(5 * 60 * 1000)).toBe('5 minutes');
      expect(formatWaitTime(15 * 60 * 1000)).toBe('15 minutes');
      expect(formatWaitTime(59 * 60 * 1000)).toBe('59 minutes');
    });

    test('should format hours correctly', () => {
      expect(formatWaitTime(60 * 60 * 1000)).toBe('1 hour');
      expect(formatWaitTime(2 * 60 * 60 * 1000)).toBe('2 hours');
    });

    test('should format hours and minutes correctly', () => {
      expect(formatWaitTime(90 * 60 * 1000)).toBe('1 hour 30 minutes');
      expect(formatWaitTime(125 * 60 * 1000)).toBe('2 hours 5 minutes');
    });

    test('should round up partial minutes', () => {
      expect(formatWaitTime(30 * 1000)).toBe('1 minute');
      expect(formatWaitTime(90 * 1000)).toBe('2 minutes');
    });
  });
});
