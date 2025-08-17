import { Context } from 'hono';
import { getTenantInfo } from '@utils/getTenantInfo';
import { Env } from '~/types';
import { logger } from '@utils/logger';

export const getSiteName = (url: string): string => {
  const tenantInfo = getTenantInfo(url);
  return tenantInfo.siteName;
}

export const scopedLogger = logger.addScope('rateLimiter');