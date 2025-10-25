import logger from './logger.js';

/**
 * Detects if the Claude output indicates a rate limit/session limit
 * @param {string} output - Combined stdout/stderr from Claude
 * @returns {Object|null} - Rate limit info or null if not rate limited
 */
export function detectRateLimit(output) {
  if (!output) return null;

  // Check for "Session limit reached" message
  const sessionLimitMatch = output.match(/Session limit reached/i);
  if (!sessionLimitMatch) return null;

  // Try to extract reset time from message like "resets 10pm" or "resets at 10pm"
  const resetTimeMatch = output.match(/resets?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)/i);
  const resetTime = resetTimeMatch ? resetTimeMatch[1] : null;

  logger.info('Rate limit detected in Claude output', {
    resetTime: resetTime || 'unknown',
    output: output.substring(0, 200) // Log first 200 chars
  });

  return {
    isRateLimited: true,
    resetTime,
    message: 'Session limit reached'
  };
}

/**
 * Calculate wait time in milliseconds until reset time
 * @param {string} resetTime - Time string like "10pm" or "10:30pm"
 * @returns {number} - Milliseconds to wait (min 1 minute, max 24 hours)
 */
export function calculateWaitTime(resetTime) {
  if (!resetTime) {
    // Default to 15 minutes if no reset time specified
    return 15 * 60 * 1000;
  }

  try {
    // Parse the reset time
    const timeMatch = resetTime.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);
    if (!timeMatch) {
      return 15 * 60 * 1000; // Default to 15 minutes
    }

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3].toLowerCase();

    // Convert to 24-hour format
    if (meridiem === 'pm' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }

    // Create date object for reset time today
    const now = new Date();
    const resetDate = new Date(now);
    resetDate.setHours(hours, minutes, 0, 0);

    // If reset time is in the past today, assume it's tomorrow
    if (resetDate <= now) {
      resetDate.setDate(resetDate.getDate() + 1);
    }

    // Calculate wait time
    let waitTime = resetDate - now;

    // Add 1 minute buffer after reset time
    waitTime += 60 * 1000;

    // Ensure wait time is reasonable (1 min to 24 hours)
    const minWait = 60 * 1000; // 1 minute
    const maxWait = 24 * 60 * 60 * 1000; // 24 hours
    waitTime = Math.max(minWait, Math.min(maxWait, waitTime));

    logger.info('Calculated wait time for rate limit', {
      resetTime,
      waitMinutes: Math.round(waitTime / 60000),
      resetDate: resetDate.toISOString()
    });

    return waitTime;
  } catch (error) {
    logger.warn('Failed to parse reset time, using default wait', {
      resetTime,
      error: error.message
    });
    return 15 * 60 * 1000; // Default to 15 minutes
  }
}

/**
 * Format wait time as human-readable string
 * @param {number} milliseconds - Wait time in milliseconds
 * @returns {string} - Formatted string like "15 minutes" or "2 hours 30 minutes"
 */
export function formatWaitTime(milliseconds) {
  const totalMinutes = Math.ceil(milliseconds / 60000);

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
