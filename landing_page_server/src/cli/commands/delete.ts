import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const deleteCommand = new Command('delete')
  .description('Delete data from KV store')
  .addCommand(
    new Command('tenant')
      .description('Delete tenant data')
      .argument('<id>', 'Tenant ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete tenant ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Tenant ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting tenant:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('site')
      .description('Delete site data')
      .argument('<id>', 'Site ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete site ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.site.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Site ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting site:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plan')
      .description('Delete plan data')
      .argument('<id>', 'Plan ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete plan ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Plan ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting plan:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );