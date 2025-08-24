import { Env } from './types';
import { updateFirewallList } from './cloudflare-api';

export async function handleScheduled(controller: ScheduledController, env: Env) {
  console.log('Running daily usage reset cron job...');
  
  // This is a simplified version. In production, you would get the list of active
  // accounts from your main database rather than trying to list all KV keys.
  const list = await env.DEPLOYS_KV.list({ prefix: 'status:' });

  for (const key of list.keys) {
    const accountId = key.name.split(':')[1];
    const hostname = `${accountId}`; // This assumes accountId is the full hostname. Adjust as needed.

    console.log(`Resetting usage for account: ${accountId}`);

    // Remove from the firewall suspension list
    await updateFirewallList(env, hostname, 'remove');
    
    // Delete the usage tracking keys from KV
    await env.DEPLOYS_KV.delete(`count:${accountId}`);
    await env.DEPLOYS_KV.delete(`status:${accountId}`);
  }
  
  console.log('Daily usage reset complete.');
}