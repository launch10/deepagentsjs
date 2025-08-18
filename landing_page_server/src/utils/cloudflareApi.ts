import { Env } from '../types';

export async function updateFirewallList(env: Env, hostname: string, action: 'add' | 'remove') {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items`;

  const body = [{
    "comment": `Auto-suspended by worker on ${new Date().toISOString()}`,
    "hostname": { "url": `http://${hostname}` } // API expects a full URL
  }];

  const options: RequestInit = {
    method: action === 'add' ? 'POST' : 'DELETE',
    headers: {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
  
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();
    if (!data.success) {
      console.error(`Failed to update Firewall List for ${hostname}`, JSON.stringify(data.errors));
    } else {
      console.log(`Successfully updated Firewall List for ${hostname}. Action: ${action}`);
    }
  } catch (error) {
    console.error(`Exception while updating Firewall List for ${hostname}`, error);
  }
}