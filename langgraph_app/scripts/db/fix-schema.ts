#!/usr/bin/env tsx

import fs from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "app/db/schema.ts");

function fixSchemaIssues() {
  let content = fs.readFileSync(schemaPath, "utf-8");
  let changesMade = false;

  // Fix 1: Fix improper import syntax (e.g., "} , customType from")
  const improperImportRegex = /}\s*,\s*customType\s+from/g;
  if (improperImportRegex.test(content)) {
    content = content.replace(improperImportRegex, ", customType } from");
    changesMade = true;
    console.log("✅ Fixed import syntax with customType outside brackets");
  }

  // Fix 2: Fix duplicate customType imports
  const duplicateCustomTypeRegex = /,\s*customType\s*,\s*customType/g;
  if (duplicateCustomTypeRegex.test(content)) {
    content = content.replace(duplicateCustomTypeRegex, ", customType");
    changesMade = true;
    console.log("✅ Fixed duplicate customType imports");
  }

  // Fix 3: Ensure customType is properly imported (only if not already present)
  const hasCustomTypeImport =
    /import\s*{[^}]*\bcustomType\b[^}]*}\s*from\s*["']drizzle-orm\/pg-core["']/.test(content);
  if (!hasCustomTypeImport && !content.includes("customType")) {
    // Add customType to the imports
    content = content.replace(
      /(import\s*{[^}]*)(}\s*from\s*["']drizzle-orm\/pg-core["'])/,
      "$1, customType$2"
    );
    changesMade = true;
    console.log("✅ Added customType to imports");
  }

  // Fix 4: Add tsvector custom type if not present
  if (!content.includes("const tsvector = customType")) {
    const importEndIndex =
      content.indexOf('import { sql } from "drizzle-orm"') +
      'import { sql } from "drizzle-orm"'.length;
    const tsvectorDefinition = `

// Custom type for PostgreSQL tsvector
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});`;

    content = content.slice(0, importEndIndex) + tsvectorDefinition + content.slice(importEndIndex);
    changesMade = true;
    console.log("✅ Added tsvector custom type definition");
  }

  // Fix 4b: Add bytea custom type if not present
  if (!content.includes("const bytea = customType")) {
    const importEndIndex =
      content.indexOf('import { sql } from "drizzle-orm"') +
      'import { sql } from "drizzle-orm"'.length;
    const byteaDefinition = `

// Custom type for PostgreSQL bytea
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});`;

    // Find where to insert - after tsvector if it exists, otherwise after imports
    if (content.includes("const tsvector = customType")) {
      const tsvectorEnd =
        content.indexOf("});", content.indexOf("const tsvector = customType")) + "});".length;
      content = content.slice(0, tsvectorEnd) + byteaDefinition + content.slice(tsvectorEnd);
    } else {
      content = content.slice(0, importEndIndex) + byteaDefinition + content.slice(importEndIndex);
    }
    changesMade = true;
    console.log("✅ Added bytea custom type definition");
  }

  // Fix 5: Fix improper default values like default(') or default(")
  // This regex matches default(' or default(" followed by ) - improper syntax
  const improperDefaultRegex = /\.default\(['"]?\)(?!\))/g;
  if (improperDefaultRegex.test(content)) {
    content = content.replace(improperDefaultRegex, ".default('')");
    changesMade = true;
    console.log("✅ Fixed improper default values");
  }

  // Fix 6: Fix any standalone (') patterns that might appear
  const standaloneQuoteRegex = /\('\)/g;
  if (standaloneQuoteRegex.test(content)) {
    content = content.replace(standaloneQuoteRegex, "('')");
    changesMade = true;
    console.log("✅ Fixed standalone quote patterns");
  }

  // Fix 7: Replace unknown("content_tsv") or text("content_tsv") with tsvector
  const tsvectorFieldRegex =
    /(\s*)(?:\/\/ TODO: failed to parse database type 'tsvector'\n\s*)?contentTsv: (?:unknown|text)\("content_tsv"\)/g;
  if (tsvectorFieldRegex.test(content)) {
    content = content.replace(tsvectorFieldRegex, '$1contentTsv: tsvector("content_tsv")');
    changesMade = true;
    console.log("✅ Fixed tsvector column types");
  }

  // Fix 8: Handle any other tsvector columns that might exist
  const otherTsvectorRegex = /(\w+): (?:unknown|text)\("(\w+)"\),?\s*\/\/\s*tsvector/g;
  if (otherTsvectorRegex.test(content)) {
    content = content.replace(otherTsvectorRegex, '$1: tsvector("$2"),');
    changesMade = true;
    console.log("✅ Fixed other tsvector columns");
  }

  // Fix 9: Fix any .default(') patterns (single quote not closed)
  const unclosedSingleQuoteRegex = /\.default\('\)(?!\))/g;
  if (unclosedSingleQuoteRegex.test(content)) {
    content = content.replace(unclosedSingleQuoteRegex, ".default('')");
    changesMade = true;
    console.log("✅ Fixed unclosed single quote defaults");
  }

  // Fix 10: Fix any .default(") patterns (double quote not closed)
  const unclosedDoubleQuoteRegex = /\.default\("\)(?!\))/g;
  if (unclosedDoubleQuoteRegex.test(content)) {
    content = content.replace(unclosedDoubleQuoteRegex, ".default('')");
    changesMade = true;
    console.log("✅ Fixed unclosed double quote defaults");
  }

  // Fix 11: Convert bigint columns to use mode: 'number'
  const bigintRegex = /(\w+):\s*bigint\("([^"]+)"\)(?!.*mode:)/g;
  if (bigintRegex.test(content)) {
    content = content.replace(bigintRegex, '$1: bigint("$2", { mode: "number" })');
    changesMade = true;
    console.log('✅ Converted bigint columns to use mode: "number"');
  }

  // Fix 11b: Convert bigserial columns to use mode: 'number'
  const bigserialRegex = /(\w+):\s*bigserial\((?!.*mode:)/g;
  if (bigserialRegex.test(content)) {
    content = content.replace(bigserialRegex, '$1: bigserial({ mode: "number" }');
    changesMade = true;
    console.log('✅ Converted bigserial columns to use mode: "number"');
  }

  // Fix 11c: Update existing bigserial columns that have mode: 'bigint' to mode: 'number'
  const bigserialModeRegex = /bigserial\(\s*{\s*mode:\s*["']bigint["']\s*}\)/g;
  if (bigserialModeRegex.test(content)) {
    content = content.replace(bigserialModeRegex, 'bigserial({ mode: "number" })');
    changesMade = true;
    console.log('✅ Updated existing bigserial columns from mode: "bigint" to mode: "number"');
  }

  // Fix 12: Update existing bigint columns that have mode: 'bigint' to mode: 'number'
  const bigintModeRegex = /bigint\(([^,]+),\s*{\s*mode:\s*["']bigint["']\s*}\)/g;
  if (bigintModeRegex.test(content)) {
    content = content.replace(bigintModeRegex, 'bigint($1, { mode: "number" })');
    changesMade = true;
    console.log('✅ Updated existing bigint columns from mode: "bigint" to mode: "number"');
  }

  // Fix 13: Replace unknown("blob") with bytea("blob") for checkpoint_blobs table
  const unknownBlobRegex = /blob:\s*unknown\("blob"\)/g;
  if (unknownBlobRegex.test(content)) {
    content = content.replace(unknownBlobRegex, 'blob: bytea("blob")');
    changesMade = true;
    console.log("✅ Fixed blob column to use bytea type");
  }

  // Fix 14: Remove LangGraph checkpoint tables completely
  const checkpointTableNames = [
    "checkpoint_migrations",
    "checkpoints",
    "checkpoint_writes",
    "checkpoint_blobs",
  ];

  for (const tableName of checkpointTableNames) {
    // Create regex to match the entire table definition
    const tableRegex = new RegExp(
      `export const ${tableName} = pgTable\\("${tableName.replace(/_/g, "_")}"[^;]*\\);(?:\\n\\nexport const ${tableName}Relations[^;]*;)?`,
      "gs"
    );

    if (tableRegex.test(content)) {
      content = content.replace(tableRegex, "");
      changesMade = true;
      console.log(`✅ Removed ${tableName} table`);
    }
  }

  // Fix 15: Remove any trailing empty lines that might be left after table removal
  content = content.replace(/\n\n\n+/g, "\n\n");

  if (changesMade) {
    fs.writeFileSync(schemaPath, content);
    console.log("✅ Schema fixes applied successfully");
  } else {
    console.log("ℹ️  No schema fixes needed");
  }
}

try {
  fixSchemaIssues();
} catch (error) {
  console.error("❌ Error fixing schema:", error);
  process.exit(1);
}
