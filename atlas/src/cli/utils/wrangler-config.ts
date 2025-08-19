import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';

interface WranglerConfig {
  name?: string;
  main?: string;
  kv_namespaces?: Array<{
    binding: string;
    id: string;
    preview_id?: string;
  }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name: string;
  }>;
  durable_objects?: {
    bindings: Array<{
      name: string;
      class_name: string;
      script_name?: string;
    }>;
  };
}

export function loadWranglerConfig(configPath?: string): WranglerConfig {
  // Check environment variable first
  const envPath = process.env.WRANGLER_CONFIG_PATH;
  const tomlPath = configPath || envPath || path.resolve(process.cwd(), 'wrangler.toml');
  
  if (!fs.existsSync(tomlPath)) {
    // Fall back to wrangler-public.toml if default doesn't exist
    const publicPath = path.resolve(process.cwd(), 'wrangler-public.toml');
    if (fs.existsSync(publicPath)) {
      console.log(`Using config: ${publicPath}`);
      const content = fs.readFileSync(publicPath, 'utf-8');
      return toml.parse(content);
    }
    throw new Error(`Wrangler config not found at ${tomlPath}`);
  }
  
  console.log(`Using config: ${tomlPath}`);
  const content = fs.readFileSync(tomlPath, 'utf-8');
  return toml.parse(content);
}

export function getKVNamespaceId(config: WranglerConfig, binding: string): string | undefined {
  const namespace = config.kv_namespaces?.find(ns => ns.binding === binding);
  return namespace?.id;
}

export function getR2BucketName(config: WranglerConfig, binding: string): string | undefined {
  const bucket = config.r2_buckets?.find(b => b.binding === binding);
  return bucket?.bucket_name;
}