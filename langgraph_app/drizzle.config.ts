import { defineConfig } from "drizzle-kit";
import { env } from "./app/core/env";

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./app/db", // Generate directly in app/db (no copying needed)
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  introspect: {
    casing: "camel",
  },
  tablesFilter: [
    // Exclude LangGraph checkpoint tables
    "!checkpoint_migrations",
    "!checkpoints",
    "!checkpoint_writes",
    "!checkpoint_blobs",
    // Exclude specific partition tables that are causing issues
    "!domain_request_counts_*", // exclude domain request count partitions
    "!user_request_counts_*", // exclude user request count partitions
    "!account_request_counts_*", // exclude account request count partitions
    // Exclude other system/partition tables
    "!_*", // exclude tables starting with underscore
    "!pg_*", // exclude postgres system tables
    "!partition_*", // exclude partition tables
    "!*_backup", // exclude backup tables
    "!*_archive", // exclude archive tables
    "!*_temp", // exclude temp tables
    "!*_tmp", // exclude temp tables
  ],
});
