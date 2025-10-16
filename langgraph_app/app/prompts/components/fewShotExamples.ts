import { z } from 'zod';
import { renderPrompt } from '@prompts';
import { type SchemaFewShotExample } from '@types';
import { toXML } from '@prompts';

/**
 * The fewShotExamples function renders a <few-shot-examples> tag,
 * listing examples as <example> sub-elements.
 *
 * @param examples - An array of examples.
 *
 * @example
 * ```ts
 * const examples: SchemaFewShotExample<typeof schema>[] = [
 *   { input: "Hello", output: { intro: "Hello", question: "Hello", sampleResponses: ["Hello"], conclusion: "Hello" } },
 *   { input: "Hello", output: { intro: "Hello", question: "Hello", sampleResponses: ["Hello"], conclusion: "Hello" } }
 * ];
 *
 * fewShotExamplesPrompt(examples, schema);
 * ```
 */
export async function fewShotExamplesPrompt<T extends z.ZodType<any>>({
    fewShotExamples,
    schema
}: {
    fewShotExamples?: SchemaFewShotExample<T>[],
    schema: T
}) {
  if (!fewShotExamples) return "";
  
  const exampleElements = fewShotExamples?.map(({ input, output }: SchemaFewShotExample<T>) => {
    // const validatedOutput = schema.parse(output);

    return `<example>
      <input>${input}</input>
      <output>${toXML({values: output, sortOption: "none"})}</output>
    </example>`
  }).join('') || '';
  
  return renderPrompt(`<few-shot-examples>${exampleElements}</few-shot-examples>`);
}