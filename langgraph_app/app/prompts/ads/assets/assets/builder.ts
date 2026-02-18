import { z } from "zod";
import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { AssetPrompts } from "./config";
import { ResponseTemplates } from "./responseTemplates";
import { structuredOutputPrompt } from "@prompts";

export const getAssetPrompts = async (
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<string> => {
  const assetConfigs = getAssetsConfigs(state);

  const prompts = await Promise.all(
    Object.values(assetConfigs).map(async (assetConfig, index) => {
      const prompt = await assetConfig.prompt(state, config);
      return `${index + 1}: ${prompt.trim()}`;
    })
  );

  return `
        <asset_instructions>
            ${prompts
              .map((prompt, index) => {
                return `<instruction index="${index + 1}">${prompt}</instruction>`;
              })
              .join("\n")}
        </asset_instructions>
    `;
};

export const getOutputPrompt = async (
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<string> => {
  const assetConfigs = getAssetsConfigs(state);

  const arrayOfOutputFormats = await Promise.all(
    Object.values(assetConfigs).map(async (assetConfig) => {
      return await assetConfig.outputFormat(state, config);
    })
  );
  const outputFormat = arrayOfOutputFormats.reduce(
    (acc, formatObj) => ({ ...acc, ...formatObj }),
    {}
  );
  const isRefreshMode = !!state.refresh?.length;
  const stage = state.stage as Ads.StageName;
  const responseTemplate = ResponseTemplates[stage];

  return `
        <example_response>
            ${isRefreshMode ? "Here are some fresh suggestions:" : responseTemplate}

            \`\`\`json
            ${JSON.stringify(outputFormat, null, 2)}
            \`\`\`
        </example_response>
    `;
};

export const getStructuredOutputPrompt = async (
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<string> => {
  const assetConfigs = getAssetsConfigs(state);

  const schemas = Object.values(assetConfigs).map((assetConfig) =>
    assetConfig.schema(state, config)
  );

  const combinedSchema = schemas.reduce((acc, schema) => {
    if (acc === null) {
      return schema;
    }
    return acc.and(schema);
  }, null as z.ZodSchema | null);

  if (!combinedSchema) {
    return "";
  }

  return structuredOutputPrompt({ schema: combinedSchema });
};

const getAssetsConfigs = (state: AdsGraphState): Ads.AssetPromptMap => {
  if (!state.stage) {
    throw new Error("Stage is required");
  }

  const stage = Ads.Stages[state.stage];
  if (!stage) {
    throw new Error(`Stage "${state.stage}" is not a valid stage`);
  }
  const assetsToGenerate: Ads.AssetKind[] = state.refresh?.length
    ? state.refresh.map((r) => r.asset)
    : stage.assets;

  const assetConfigs: Ads.AssetPromptMap = assetsToGenerate.reduce(
    (acc: Ads.AssetPromptMap, asset: Ads.AssetKind) => {
      const assetConfig = AssetPrompts[asset];
      return {
        ...acc,
        [asset]: assetConfig,
      };
    },
    {} as Ads.AssetPromptMap
  );

  return assetConfigs;
};
