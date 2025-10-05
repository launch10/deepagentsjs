// This file is automatically loaded by Vitest before running tests
// Import all custom matchers
import "./matchers";
import "./graph";
import { afterAll } from 'vitest';
import { cleanupPool } from '@core';

// Clean up database connections after all tests
afterAll(async () => {
    await cleanupPool();
});