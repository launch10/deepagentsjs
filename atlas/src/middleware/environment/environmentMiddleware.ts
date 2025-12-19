import { MiddlewareHandler } from 'hono';
import { Env, CloudEnvironment, AppVariables } from '../../types';

const ALLOWED_ENVS: CloudEnvironment[] = ['development', 'staging', 'production'];
const DEFAULT_ENV: CloudEnvironment = 'production';

export const environmentMiddleware = (): MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> => async (c, next) => {
  const envHeader = c.req.header('x-environment');
  
  let cloudEnv: CloudEnvironment = DEFAULT_ENV;
  if (envHeader && ALLOWED_ENVS.includes(envHeader as CloudEnvironment)) {
    cloudEnv = envHeader as CloudEnvironment;
  }
  
  c.set('cloudEnv', cloudEnv);
  
  await next();
};
