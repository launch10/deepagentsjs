import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import type { TenantType, SiteType, PlanType } from '../../types.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const setCommand = new Command('set')
  .description('Set data in KV store')
  .addCommand(
    new Command('tenant')
      .description('Set tenant data')
      .requiredOption('-i, --id <id>', 'Tenant ID')
      .requiredOption('-o, --org-id <orgId>', 'Organization ID')
      .requiredOption('-p, --plan-id <planId>', 'Plan ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: TenantType = {
            id: options.id,
            orgId: options.orgId,
            planId: options.planId
          };
          
          const result = await client.tenant.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Tenant ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving tenant: ${result.error}`);
            process.exit(1);
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
      .description('Set site data')
      .requiredOption('-i, --id <id>', 'Site ID')
      .requiredOption('-u, --url <url>', 'Site URL')
      .requiredOption('-t, --tenant-id <tenantId>', 'Tenant ID')
      .option('-l, --live <live>', 'Live deploy SHA', 'ABCD')
      .option('-p, --preview <preview>', 'Preview deploy SHA', 'EFGH')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: SiteType = {
            id: options.id,
            url: options.url,
            tenantId: options.tenantId,
            live: options.live,
            preview: options.preview
          };
          
          const result = await client.site.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Site ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving site: ${result.error}`);
            process.exit(1);
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
      .description('Set plan data')
      .requiredOption('-i, --id <id>', 'Plan ID')
      .requiredOption('-n, --name <name>', 'Plan name')
      .requiredOption('-l, --limit <limit>', 'Usage limit', parseInt)
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: PlanType = {
            id: options.id,
            name: options.name,
            usageLimit: options.limit
          };
          
          const result = await client.plan.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Plan ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving plan: ${result.error}`);
            process.exit(1);
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