/**
 * Schema Validation Initializer
 * 
 * This initializer runs on app startup to validate that all model schemas
 * match their corresponding database tables. It will fail fast with a clear
 * error message if any mismatches are detected.
 * 
 * The numeric prefix ensures this runs early in the initialization process.
 */

import { 
  ComponentModel,
  ComponentOverviewModel,
  ComponentContentPlanModel,
  CodeTaskModel,
  ContentStrategyModel,
  FileSpecificationModel,
  PageModel,
  ProjectModel,
  TemplateModel,
  TemplateFileModel,
  ThemeModel,
  ThemeVariantModel,
  WebsiteModel,
  WebsiteFileModel,
} from '@models';

/**
 * Columns to ignore during validation
 * These are typically:
 * - Full-text search columns (tsvector)
 * - Computed/generated columns
 * - Database-specific columns that shouldn't be in the application layer
 */
const IGNORED_COLUMNS: Record<string, string[]> = {
  'website_files': ['contentTsv'],
  'template_files': ['contentTsv', 'shasum'],
  'website_file_histories': ['contentTsv'],
  'code_files': ['contentTsv'],
  'file_specifications': ['schema'],
};

const MODELS_TO_VALIDATE = [
  { name: 'ComponentModel', model: ComponentModel },
  { name: 'ComponentOverviewModel', model: ComponentOverviewModel },
  { name: 'ComponentContentPlanModel', model: ComponentContentPlanModel },
  { name: 'CodeTaskModel', model: CodeTaskModel },
  { name: 'ContentStrategyModel', model: ContentStrategyModel },
  { name: 'FileSpecificationModel', model: FileSpecificationModel },
  { name: 'PageModel', model: PageModel },
  { name: 'ProjectModel', model: ProjectModel },
  { name: 'TemplateModel', model: TemplateModel },
  { name: 'TemplateFileModel', model: TemplateFileModel },
  { name: 'ThemeModel', model: ThemeModel },
  { name: 'ThemeVariantModel', model: ThemeVariantModel },
  { name: 'WebsiteModel', model: WebsiteModel },
  { name: 'WebsiteFileModel', model: WebsiteFileModel },
];

let _validatedModels = false;
export default function validateSchemas(): void {
  if (_validatedModels) {
    return;
  }
  // console.log('🔍 Validating model schemas...');
  
  let hasErrors = false;
  const errors: { model: string; error: string }[] = [];
  const passed: string[] = [];

  for (const { name, model } of MODELS_TO_VALIDATE) {
    try {
      // Get the table name to look up ignored columns
      const tableName = model.getTableName();
      const ignoredColumns = tableName ? (IGNORED_COLUMNS[tableName] || []) : [];
      
      model.validateSchema(ignoredColumns);
      passed.push(name);
      // console.log(`  ✅ ${name}`);
    } catch (error) {
      hasErrors = true;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ model: name, error: errorMessage });
      console.log(`  ❌ ${name}`);
    }
  }

  if (hasErrors) {
    console.error('\n🚨 SCHEMA VALIDATION FAILED!\n');
    console.error(`${errors.length} model(s) have schema mismatches:\n`);
    
    // Show a quick summary first
    console.error('FAILED MODELS:');
    errors.forEach(({ model }) => {
      console.error(`  ❌ ${model}`);
    });
    
    console.error('\nDETAILS:');
    console.error('=' .repeat(60));
    
    for (const { model, error } of errors) {
      console.error(error);
    }
    
    console.error('\n🔧 HOW TO FIX:');
    console.error('1. Check the Zod schema files for each model listed above');
    console.error('2. ADD any missing fields that exist in the database table');
    console.error('3. REMOVE any extra fields that don\'t exist in the database table');
    console.error('4. Common locations:');
    console.error('   - app/shared/types/website/*.ts');
    console.error('   - app/shared/types/*.ts');
    console.error('\n');
    process.exit(1);
  }
  
  console.log(`✨ All ${passed.length} model schemas validated successfully!\n`);
}