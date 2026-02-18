import { generateUUID, type Ads, type UUIDType } from "@shared";

interface RailsAsset {
  id?: number;
  text?: string;
}

interface RailsSnippet {
  category?: string;
  values?: string[];
}

/** Transform Rails campaign assets (Inertia props) to Langgraph state shape */
export function transformRailsAssetsToState(props: {
  headlines?: RailsAsset[] | null;
  descriptions?: RailsAsset[] | null;
  keywords?: RailsAsset[] | null;
  callouts?: RailsAsset[] | null;
  structured_snippet?: RailsSnippet | null;
}): Partial<Record<string, unknown>> | undefined {
  const hasAny = props.headlines?.length || props.descriptions?.length || props.keywords?.length || props.callouts?.length;
  if (!hasAny) return undefined;

  const toAssets = (rails: RailsAsset[] | null | undefined): Ads.Asset[] | undefined =>
    rails?.map((r) => ({
      id: (r.id != null ? String(r.id) : generateUUID()) as UUIDType,
      text: r.text ?? "",
      locked: true,
      rejected: false,
    }));

  const result: Record<string, unknown> = {};
  if (props.headlines?.length) result.headlines = toAssets(props.headlines);
  if (props.descriptions?.length) result.descriptions = toAssets(props.descriptions);
  if (props.keywords?.length) result.keywords = toAssets(props.keywords);
  if (props.callouts?.length) result.callouts = toAssets(props.callouts);
  if (props.structured_snippet?.values?.length) {
    result.structuredSnippets = {
      category: props.structured_snippet.category,
      details: props.structured_snippet.values.map((v) => ({
        id: generateUUID(),
        text: v,
        locked: true,
        rejected: false,
      })),
    };
  }
  return result;
}
