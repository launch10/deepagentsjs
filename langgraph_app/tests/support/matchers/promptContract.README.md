# Prompt Contract Testing

A format-agnostic testing system for validating prompt outputs using Zod schemas.

## Philosophy

Test **contracts** (what the prompt must produce), not **content** (exact wording).

### What to Test
✅ Data structure and types (using Zod schemas)  
✅ Required sections exist  
✅ No nulls/undefined in unexpected places  
✅ Format is parseable (JSON, XML, Pipe)  

### What NOT to Test
❌ Exact wording of instructions  
❌ Order of sections (unless critical)  
❌ Specific examples in the prompt  
❌ Whitespace and formatting details  

## Usage

### 1. Basic Contract Validation

```typescript
import { expectSection } from '@support';
import { pickThemePromptOutputSchema } from '@prompts';

it('generates valid output', async () => {
  const result = await pickThemePrompt({ userRequest });

  expectSection(result, 'structured-output')
    .toMatchContract(pickThemePromptOutputSchema);
});
```

### 2. Check Required Sections

```typescript
import { expectPromptHasSections } from '@support';

it('has all required sections', async () => {
  const result = await planWebsitePrompt({ userRequest });

  expectPromptHasSections(
    result,
    'task',
    'user-request',
    'instructions',
    'structured-output'
  );
});
```

### 3. Null Safety

```typescript
import { expectNoStringifiedNulls, expectSection } from '@support';

it('has no unexpected nulls', async () => {
  const result = await createComponentPrompt({ ... });

  // Check whole prompt
  expectNoStringifiedNulls(result);

  // Check specific section, allowing some nulls
  expectSection(result, 'content-plan')
    .toHaveNoNulls(['overview.copy', 'content.cta']);
});
```

### 4. Format Validation

Works with JSON, XML, or Pipe format automatically:

```typescript
it('handles any format', async () => {
  // JSON
  const jsonPrompt = `<data>{"name": "test"}</data>`;
  expectSection(jsonPrompt, 'data')
    .toMatchContract(z.object({ name: z.string() }));

  // XML
  const xmlPrompt = `<data><name>test</name></data>`;
  expectSection(xmlPrompt, 'data')
    .toMatchContract(z.object({ name: z.string() }));

  // Pipe (CSV)
  const pipePrompt = `<data>name\ntest</data>`;
  expectSection(pipePrompt, 'data')
    .toMatchContract(z.array(z.object({ name: z.string() })));
});
```

## API Reference

### `expectSection(prompt, sectionName)`

Returns a `SectionAssertion` with the following methods:

#### `.toMatchContract<T>(schema: ZodSchema<T>): T`
Validates the section content matches the Zod schema. Returns typed data.

```typescript
const data = expectSection(result, 'content-plan')
  .toMatchContract(contentPlanSchema);

// data is now typed according to schema
console.log(data.content.componentType);
```

#### `.toHaveNoNulls(allowedPaths?: string[]): this`
Checks for unexpected nulls/undefined. Optionally allow specific paths.

```typescript
expectSection(result, 'content-plan')
  .toHaveNoNulls(['overview.copy']); // copy can be null
```

#### `.toBeValidFormat(): this`
Verifies the section can be parsed (JSON/XML/Pipe).

```typescript
expectSection(result, 'structured-output')
  .toBeValidFormat()
  .toMatchContract(schema);
```

### `expectPromptHasSections(prompt, ...sections)`

Validates that all required sections exist in the prompt.

```typescript
expectPromptHasSections(
  result,
  'role',
  'task',
  'context'
);
```

### `expectNoStringifiedNulls(prompt)`

Checks for common corruption patterns:
- `"undefined"` as a string
- `"null"` as a string value
- `null.property` or `undefined.property`
- `[object Object]`
- Empty objects `{}`

```typescript
expectNoStringifiedNulls(result);
```

## Benefits

### Format-Agnostic
Change prompt format (JSON → XML → Pipe) without changing tests.

### Type-Safe
Leverage your existing Zod schemas. Get typed results.

### Clear Errors
```
Section 'content-plan' failed contract validation:
  - content.componentType: Required
  - overview.name: Expected string, received number

Parsed data: {
  "content": {},
  "overview": { "name": 123 }
}
```

### Maintainable
When prompts evolve, tests only break if **contracts** change, not wording.

## Example: Complete Test

```typescript
import { expectSection, expectPromptHasSections, expectNoStringifiedNulls } from '@support';
import { contentStrategySchema } from '@types';

describe('planWebsite Prompt - Contract Tests', () => {
  it('satisfies all contracts', async () => {
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage("Create a SaaS landing page")
    });

    // 1. Has required sections
    expectPromptHasSections(
      result,
      'task',
      'user-request',
      'structured-output'
    );

    // 2. No corruption
    expectNoStringifiedNulls(result);

    // 3. Valid structure
    const data = expectSection(result, 'structured-output')
      .toMatchContract(contentStrategySchema);

    // 4. Additional assertions on typed data
    expect(data.summary.length).toBeGreaterThan(10);
    expect(data.tone).toBeDefined();
  });

  it('handles edge cases', async () => {
    const edgeCases = [
      "Request with\nnewlines",
      "Request with 'quotes'",
      "Request with special: @#$%"
    ];

    for (const request of edgeCases) {
      const result = await planWebsitePrompt({
        userRequest: new HumanMessage(request)
      });

      expectSection(result, 'structured-output')
        .toMatchContract(contentStrategySchema);

      expectNoStringifiedNulls(result);
    }
  });
});
```

## Migration Guide

### Old Brittle Test
```typescript
it('old way - breaks when wording changes', () => {
  expect(result).toMatchXml(`
    <content-plan>
      {
        "content": {
          "componentType": "Hero",
          "headline": "The Final Frontier Is Calling"
        }
      }
    </content-plan>
  `);
});
```

### New Contract Test
```typescript
it('new way - stable as long as structure is valid', () => {
  expectSection(result, 'content-plan')
    .toMatchContract(z.object({
      content: z.object({
        componentType: z.string(),
        headline: z.string()
      })
    }));
});
```

The new test:
- ✅ Allows headline text to change
- ✅ Catches if headline becomes null/undefined
- ✅ Catches if componentType is missing
- ✅ Works with JSON, XML, or Pipe format
- ✅ Gives clear error messages
