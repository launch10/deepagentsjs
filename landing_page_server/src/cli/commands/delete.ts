import { Command } from 'commander';
import { Tenant, Site, Plan } from '../../models/index.js';
import { getMockContext, cleanup } from '../utils/kv.js';

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
            await cleanup();
            process.exit(0);
          }
          
          const context = await getMockContext();
          const model = new Tenant(context);
          
          await model.delete(id);
          console.log(`✅ Tenant ${id} deleted successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting tenant:', error);
          await cleanup();
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
            await cleanup();
            process.exit(0);
          }
          
          const context = await getMockContext();
          const model = new Site(context);
          
          await model.delete(id);
          console.log(`✅ Site ${id} deleted successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting site:', error);
          await cleanup();
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
            await cleanup();
            process.exit(0);
          }
          
          const context = await getMockContext();
          const model = new Plan(context);
          
          await model.delete(id);
          console.log(`✅ Plan ${id} deleted successfully`);
          await cleanup();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting plan:', error);
          await cleanup();
          process.exit(1);
        }
      })
  );