import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const listCommand = new Command('list')
  .description('List data from KV store')
  .addCommand(
    new Command('tenants')
      .description('List all tenants')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.list(parseInt(options.limit));
          
          if (!result.success) {
            throw new Error(result.error || 'List failed');
          }
          
          const tenants = result.data || [];
          console.log(`Found ${tenants.length} tenants:`);
          console.log(JSON.stringify(tenants, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing tenants:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('sites')
      .description('List all sites')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .option('--tenant <tenantId>', 'Filter by tenant ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.tenant) {
            const result = await client.site.findByTenant(options.tenant);
            if (!result.success) {
              throw new Error(result.error || 'List failed');
            }
            const sites = result.data || [];
            console.log(`Found ${sites.length} sites for tenant ${options.tenant}:`);
            console.log(JSON.stringify(sites, null, 2));
          } else {
            const result = await client.site.list(parseInt(options.limit));
            if (!result.success) {
              throw new Error(result.error || 'List failed');
            }
            const sites = result.data || [];
            console.log(`Found ${sites.length} sites:`);
            console.log(JSON.stringify(sites, null, 2));
          }
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing sites:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plans')
      .description('List all plans')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.list(parseInt(options.limit));
          
          if (!result.success) {
            throw new Error(result.error || 'List failed');
          }
          
          const plans = result.data || [];
          console.log(`Found ${plans.length} plans:`);
          console.log(JSON.stringify(plans, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing plans:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );