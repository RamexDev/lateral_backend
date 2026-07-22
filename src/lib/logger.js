// Import Pino, the base logger.
import pino from 'pino';

// Import validated environment variables.
import { env } from '../config/env.js';

// Decide whether logs should be silent during tests.
const isTest = env.NODE_ENV === 'test';

// Decide whether logs should be pretty-printed in development.
const isPretty = env.NODE_ENV === 'development';

// Store the optional pretty-print stream.
let prettyStream;

// Only load pino-pretty in development.
if (isPretty) {
  try {
    // Dynamically import pino-pretty so production does not require it.
    const pretty = (await import('pino-pretty')).default;

    // Create a human-readable log stream.
    prettyStream = pretty({
      // Add colors to development logs.
      colorize: true,

      // Keep each log on one line.
      singleLine: true,

      // Show a simple local timestamp.
      translateTime: 'SYS:HH:MM:ss.l',

      // Hide noisy fields from the output.
      ignore: 'pid,hostname,req,res,responseTime,requestId',

      // Print only the formatted message body.
      messageFormat: '{msg}'
    });
  } catch {
    // If pino-pretty is missing, fall back to normal JSON logs.
    console.warn('pino-pretty is not installed. Falling back to JSON logs.');
  }
}

// Export the shared application logger.
export const logger = pino(
  {
    // Set the active log level from environment variables.
    level: isTest ? 'silent' : env.LOG_LEVEL,

    // Remove default pid/hostname noise in development.
    base: undefined,

    // Use readable ISO timestamps.
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive fields from logs.
    redact: {
      // List sensitive paths that should never appear in logs.
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-telegram-init-data"]',
        'req.headers["chapa-signature"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.password_hash',
        '*.token',
        '*.access_token',
        '*.refresh_token',
        '*.secret',
        '*.signature',
        '*.init_data',
        '*.initData'
      ],

      // Replace sensitive values with this text.
      censor: '[REDACTED]'
    },

    // Use Pino's default error serializer.
    serializers: {
      err: pino.stdSerializers.err
    }
  },

  // Use the pretty stream when available.
  prettyStream
);