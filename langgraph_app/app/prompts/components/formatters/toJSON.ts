import stringify from 'fast-json-stable-stringify';
import { stripTimestamps } from './utils';

export const toJSON = (data: Record<string, any>): string => {
  const cleanedData = stripTimestamps(data);
  return stringify(cleanedData);
};