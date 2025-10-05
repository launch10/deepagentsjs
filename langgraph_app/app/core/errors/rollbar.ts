import Rollbar from 'rollbar';

const logger = new Rollbar({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
    captureUncaught: !!process.env.ROLLBAR_ACCESS_TOKEN,
    captureUnhandledRejections: !!process.env.ROLLBAR_ACCESS_TOKEN,
    environment: process.env.NODE_ENV || 'development',
    enabled: !!process.env.ROLLBAR_ACCESS_TOKEN,
    verbose: true
});

type LogContext = Record<string, string | number | boolean | null | undefined>;

export const rollbar = {
    error: async (error: Error | unknown, context?: LogContext) => {
      console.log('Sending error to Rollbar:', error);
      if (!logger.enabled) return;

      try {
        const result = await new Promise((resolve, reject) => {
          const callback = (err: any, data: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          };
          
          if (error instanceof Error) {
            logger.error(error, context, callback);
          } else {
            logger.error(String(error), context, callback);
          }
        });
        console.log('Error sent to Rollbar successfully:', result);
      } catch (rollbarError) {
        console.error('Failed to send error to Rollbar:', rollbarError);
      }
    },
    warn: async (message: string, context?: LogContext) => {
        await logger.warning(message, context);
    },
    info: async (message: string, context?: LogContext) => {
        await logger.info(message, context);
    }
};