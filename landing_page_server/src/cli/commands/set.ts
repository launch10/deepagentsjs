import { Command } from 'commander';
import { Tenant, Site, Plan } from '../../models/index.js';
import type { TenantType, SiteType, PlanType } from '../../types.js';
import { getMockContext, cleanup } from '../utils/kv.js';

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
          const context = await getMockContext();
          const model = new Tenant(context);
          
          const data: TenantType = {
            id: options.id,
            orgId: options.orgId,
            planId: options.planId
          };
          
          await model.set(options.id, data);
          console.log(`✅ Tenant ${options.id} saved successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error saving tenant:', error);
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
          const context = await getMockContext();
          const model = new Site(context);
          
          const data: SiteType = {
            id: options.id,
            url: options.url,
            tenantId: options.tenantId,
            live: options.live,
            preview: options.preview
          };
          
          await model.set(options.id, data);
          console.log(`✅ Site ${options.id} saved successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error saving site:', error);
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
          const context = await getMockContext();
          const model = new Plan(context);
          
          const data: PlanType = {
            id: options.id,
            name: options.name,
            usageLimit: options.limit
          };
          
          await model.set(options.id, data);
          console.log(`✅ Plan ${options.id} saved successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error saving plan:', error);
          process.exit(1);
        }
      })
  );