import { type GraphState } from "@shared/state/graph";
import { PromptTemplate } from "@langchain/core/prompts";
import { type ZodType } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import stringify from "fast-json-stable-stringify";

export type DefaultsGetter = (state: GraphState) => Partial<Record<string, any>>;
export type OverridesGetter = (state: GraphState, defaults: Record<string, any>) => Partial<Record<string, any>>;
export type ValueFormatter = (values: Record<string, any>) => string;

/**
 * Creates a reusable prompt generation function based on a template and state processing logic.
 * This factory simplifies the process of combining default state values, applying specific overrides,
 * formatting complex values into strings, and populating a LangChain PromptTemplate.
 *
 * @param options - Configuration options for the prompt factory.
 * @param options.template - The LangChain PromptTemplate instance to format.
 * @param options.schema - The Zod schema used for structured output parsing (to get formatInstructions).
 * @param options.getDefaults - A function (`DefaultsGetter`) that takes the full GraphState and returns an object
 *   containing default values for the prompt template. Values can be of any type.
 * @param options.formatters - An optional record mapping template variable names to `ValueFormatter` functions.
 *   Each formatter receives the *entire* combined map of default and override values and should return the final
 *   string representation for that specific variable to be inserted into the template.
 *
 * @returns A function that accepts an `OverridesGetter`. This `OverridesGetter` is a function that
 *   takes the *current* GraphState and returns an object with override values.
 *   This returned function then returns the main async prompt generation function, which takes the `GraphState`
 *   and produces the final, formatted prompt string.
 *
 * @example
 * const myPrompt = createPromptFactory({ template, schema, getDefaults, formatters });
 * const specificPrompt = myPrompt(getOverridesForScenarioX);
 * const promptString = await specificPrompt(graphState);
 *
 * // Inside the factory:
 * // 1. Calls getDefaults(state)
 * // 2. Calls getOverrides(state)
 * // 3. Combines defaults and overrides (overrides win)
 * // 4. Gets formatInstructions from schema
 * // 5. Iterates through template.inputVariables:
 * //    - Finds the corresponding value in the combined map.
 * //    - If a formatter exists for the variable name, calls formatter(combinedValues).
 * //    - Otherwise, stringifies the value (JSON for objects, String() otherwise).
 * //    - Throws error if a required variable is missing.
 * // 6. Calls template.format() with the final string dictionary.
 */
export const createPromptFactory = (options: {
    template: PromptTemplate;
    schema: ZodType;
    getDefaults: DefaultsGetter;
    formatters?: Record<string, ValueFormatter>; 
}) => {
    return (promptName: string, getOverrides: OverridesGetter) => {
        return async (state: GraphState): Promise<string> => {
            try {
                const defaultValues = await options.getDefaults(state);
                const parser = StructuredOutputParser.fromZodSchema(options.schema);
                const formatInstructions = parser.getFormatInstructions();
            
                const opts: Record<string, any> = {
                    ...defaultValues,
                    formatInstructions,
                };

                const combinedValues = getOverrides ? await getOverrides(state, opts) : opts;

                const formattedValues: Record<string, string> = {};
                const requiredVars = options.template.inputVariables;

                for (const key of requiredVars) {
                    if (Object.prototype.hasOwnProperty.call(combinedValues, key)) {
                        const value = combinedValues[key];
                        const formatter = options.formatters?.[key];

                        if (formatter) {
                            formattedValues[key] = formatter(combinedValues);
                        } else if (value !== undefined && value !== null) {
                            if (typeof value === 'object') {
                                formattedValues[key] = stringify(value);
                            } else {
                                formattedValues[key] = String(value);
                            }
                        } else {
                            formattedValues[key] = ""; 
                        }
                    } else {
                        if (key !== 'formatInstructions') {
                            throw new Error(`Missing required template variable "${key}". It was not found in getDefaults or getOverrides.`);
                        }
                    }
                }
                if (requiredVars.includes('formatInstructions') && !formattedValues.hasOwnProperty('formatInstructions')) {
                    formattedValues['formatInstructions'] = formatInstructions;
                }

                return await options.template.format(formattedValues);
            } catch (error) {
                throw new Error(`Failed to generate prompt for ${promptName}: ${error}`);
            }
        };
    }
}