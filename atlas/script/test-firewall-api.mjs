#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Miniflare } from "miniflare";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from .dev.vars
function loadEnvVars() {
  const envPath = path.join(__dirname, ".dev.vars");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts
          .join("=")
          .trim()
          .replace(/^["']|["']$/g, "");
        env[key.trim()] = value;
      }
    }
  });

  return env;
}

async function createMockContext() {
  const envVars = loadEnvVars();

  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch: () => new Response('Test') }`,
    kvNamespaces: {
      DEPLOYS_KV: "deploys",
    },
    kvPersist: "./.wrangler/state/v3/kv",
    bindings: {
      ...envVars,
    },
  });

  const kv = await mf.getKVNamespace("DEPLOYS_KV");

  return {
    mf,
    env: {
      DEPLOYS_KV: kv,
      ...envVars,
    },
  };
}

async function testFirewallAPI() {
  console.log("🔧 Testing Firewall API with mock context...\n");

  const { mf, env } = await createMockContext();

  try {
    console.log("Environment loaded:");
    console.log("Account ID:", env.CLOUDFLARE_ACCOUNT_ID);
    console.log("List ID:", env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID);
    console.log(
      "API Token:",
      env.CLOUDFLARE_API_TOKEN
        ? "***" + env.CLOUDFLARE_API_TOKEN.slice(-4)
        : "NOT SET"
    );
    console.log("\n-----------------------------------\n");

    if (
      !env.CLOUDFLARE_ACCOUNT_ID ||
      !env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID ||
      !env.CLOUDFLARE_API_TOKEN
    ) {
      console.error("❌ Missing required environment variables!");
      process.exit(1);
    }

    // Import the updateFirewallList function
    const { updateFirewallList } = await import(
      "../src/utils/cloudflareApi.ts"
    );

    console.log("📝 Testing updateFirewallList function directly...\n");

    // Test adding example.com
    console.log("Adding example.com to blocklist...");
    await updateFirewallList(env, "bloop.com", "add");

    console.log("\n📝 Now testing raw API call to verify...\n");

    // Verify with raw API call
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items`;

    const listResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("List response status:", listResponse.status);

    if (listResponse.ok) {
      const listData = await listResponse.json();

      if (listData.success) {
        console.log("✅ Successfully retrieved list items!");
        console.log("Total items in list:", listData.result?.length || 0);

        const exampleItem = listData.result?.find((item) =>
          item.hostname?.url?.includes("example.com")
        );

        if (exampleItem) {
          console.log(
            "✅ Found example.com in list:",
            JSON.stringify(exampleItem, null, 2)
          );

          // Clean up - remove example.com
          console.log("\n🧹 Cleaning up - removing example.com...");
          await updateFirewallList(env, "example.com", "remove");
          console.log("✅ Cleanup complete");
        } else {
          console.log("⚠️  example.com not found in list");
          console.log(
            "Items in list:",
            JSON.stringify(listData.result, null, 2)
          );
        }
      } else {
        console.log("❌ API returned success:false");
        console.log("Errors:", JSON.stringify(listData.errors, null, 2));
      }
    } else {
      const errorText = await listResponse.text();
      console.log("❌ Failed to list items. Status:", listResponse.status);
      console.log("Response:", errorText);

      if (listResponse.status === 404) {
        console.log("\n💡 The list ID does not exist. You need to:");
        console.log("1. Go to https://dash.cloudflare.com");
        console.log("2. Navigate to Manage Account → Configurations → Lists");
        console.log("3. Create a new list or use an existing one");
        console.log("4. Copy the list ID from the URL or API");
        console.log(
          "5. Update CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID in .dev.vars"
        );
      } else if (listResponse.status === 403) {
        console.log("\n🔑 Permission denied. Your API token needs:");
        console.log("  - Account: Account Filter Lists:Edit");
        console.log("  - Account: Account Rulesets:Edit");
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mf.dispose();
  }

  console.log("\n-----------------------------------");
  console.log("✨ Test complete!");
}

// Run the test
testFirewallAPI().catch(console.error);
