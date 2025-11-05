// This file is automatically loaded by Vitest before running tests
// Import all custom matchers
import "./matchers";
import "./graph";
import { beforeAll, afterAll } from 'vitest';
import { cleanupPool, NodeCache } from '@core';

// Disable NodeCache for all tests
beforeAll(() => {
    NodeCache.disable();
});

// Clean up database connections after all tests
afterAll(async () => {
    await cleanupPool();
});