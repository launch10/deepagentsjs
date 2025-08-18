import { Command } from 'commander';
import { Tenant, Site, Plan } from '../../models/index.js';
import { getMockContext, cleanup } from '../utils/kv.js';

export const listCommand = new Command('list')
  .description('List data from KV store')
  .addCommand(
    new Command('tenants')
      .description('List all tenants')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await getMockContext();
          const model = new Tenant(context);
          
          const tenants = await model.listAll(parseInt(options.limit));
          console.log(`Found ${tenants.length} tenants:`);
          console.log(JSON.stringify(tenants, null, 2));
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing tenants:', error);
          await cleanup();
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
          const context = await getMockContext();
          const model = new Site(context);
          
          if (options.tenant) {
            const sites = await model.findByTenant(options.tenant);
            console.log(`Found ${sites.length} sites for tenant ${options.tenant}:`);
            console.log(JSON.stringify(sites, null, 2));
          } else {
            const sites = await model.listAll(parseInt(options.limit));
            console.log(`Found ${sites.length} sites:`);
            console.log(JSON.stringify(sites, null, 2));
          }
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing sites:', error);
          await cleanup();
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
          const context = await getMockContext();
          const model = new Plan(context);
          
          const plans = await model.listAll(parseInt(options.limit));
          console.log(`Found ${plans.length} plans:`);
          console.log(JSON.stringify(plans, null, 2));
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing plans:', error);
          await cleanup();
          process.exit(1);
        }
      })
  );