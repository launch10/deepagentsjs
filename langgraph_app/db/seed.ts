import { sql, Table } from "drizzle-orm";

import { db, type DB } from "@db";
import * as schema from "@db/schema";
import * as seeds from "@db/seeds";

async function resetTable(db: DB, table: Table) {
	return db.execute(sql`truncate table ${table} restart identity cascade`);
}

async function main() {
	console.log("Resetting tables...");
	for (const table of [
		// schema.iconEmbedding, // don't do this! This one is very expensive to reset
		schema.themesToThemeLabels, 
		schema.themeLabel,
		schema.theme,
		schema.tenant,
		schema.project,
		schema.page,
		schema.section,
	]) {
		await resetTable(db, table);
	}
	console.log("Tables reset.");

	console.log("Running seed: iconEmbeddings...");
	await seeds.seedIconEmbeddings(db);
	console.log("Finished seed: iconEmbeddings.");

	console.log("Running seed: seedThemes...");
	await seeds.seedThemes(db);
	console.log("Finished seed: seedThemes.");

	console.log("Running seed: fileSpecifications...");
	await seeds.seedFileSpecifications(db);
	console.log("Finished seed: fileSpecifications.");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		console.log("Seeding done!");
		process.exit(0);
	});