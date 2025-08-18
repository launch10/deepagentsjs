import { Command } from 'commander';
import { Tenant, Site, Plan } from '../../models/index.js';
import { getMockContext, cleanup } from '../utils/kv.js';

export const getCommand = new Command('get')
  .description('Get data from KV store')
  .addCommand(
    new Command('tenant')
      .description('Get tenant data')
      .argument('<id>', 'Tenant ID')
      .action(async (id) => {
        try {
          const context = await getMockContext();
          const model = new Tenant(context);
          
          const tenant = await model.get(id);
          if (tenant) {
            console.log(JSON.stringify(tenant, null, 2));
          } else {
            console.log(`Tenant ${id} not found`);
          }
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error getting tenant:', error);
          await cleanup();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('site')
      .description('Get site data')
      .argument('<id>', 'Site ID')
      .option('--by-url <url>', 'Find by URL instead of ID')
      .option('--by-tenant <tenantId>', 'Find all sites by tenant ID')
      .action(async (id, options) => {
        try {
          const context = await getMockContext();
          const model = new Site(context);
          
          if (options.byUrl) {
            const site = await model.findByUrl(options.byUrl);
            console.log(JSON.stringify(site, null, 2));
          } else if (options.byTenant) {
            const sites = await model.findByTenant(options.byTenant);
            console.log(JSON.stringify(sites, null, 2));
          } else {
            const site = await model.get(id);
            if (site) {
              console.log(JSON.stringify(site, null, 2));
            } else {
              console.log(`Site ${id} not found`);
            }
          }
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error getting site:', error);
          await cleanup();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plan')
      .description('Get plan data')
      .argument('<id>', 'Plan ID')
      .action(async (id) => {
        try {
          const context = await getMockContext();
          const model = new Plan(context);
          
          const plan = await model.get(id);
          if (plan) {
            console.log(JSON.stringify(plan, null, 2));
          } else {
            console.log(`Plan ${id} not found`);
          }
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error getting plan:', error);
          await cleanup();
          process.exit(1);
        }
      })
  );