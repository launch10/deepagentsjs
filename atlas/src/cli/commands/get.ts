import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const getCommand = new Command('get')
  .description('Get data from KV store')
  .addCommand(
    new Command('tenant')
      .description('Get tenant data')
      .argument('<id>', 'Tenant ID')
      .action(async (id) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.get(id);
          
          if (result.success && result.data) {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(result.error || `Tenant ${id} not found`);
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
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
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.byUrl) {
            const result = await client.site.findByUrl(options.byUrl);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || 'Site not found');
            }
          } else if (options.byTenant) {
            const result = await client.site.findByTenant(options.byTenant);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || 'No sites found');
            }
          } else {
            const result = await client.site.get(id);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || `Site ${id} not found`);
            }
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
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
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.get(id);
          
          if (result.success && result.data) {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(result.error || `Plan ${id} not found`);
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );