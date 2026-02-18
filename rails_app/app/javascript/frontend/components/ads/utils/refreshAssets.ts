import { Ads, keyBy } from "@shared";

type AssetArrayKey = "headlines" | "descriptions" | "callouts" | "keywords";

export function createRefreshHandler<T extends AssetArrayKey>(
  assetName: T,
  assets: Ads.Asset[] | undefined,
  updateState: (state: Record<string, unknown>) => void,
  stage: string
) {
  const lockedAssets = assets?.filter((a) => a.locked) || [];
  const lockedByText = keyBy(lockedAssets, "text");
  const numLocked = lockedAssets.length;

  const updatedAssets = assets?.map((a) => ({
    ...a,
    locked: !!lockedByText[a.text],
    rejected: !lockedByText[a.text],
  }));

  updateState({
    intent: {
      type: "refresh_assets" as const,
      payload: {
        stage,
        assets: [{ asset: assetName, nVariants: Ads.DefaultNumAssets[assetName] - numLocked }],
      },
      createdAt: new Date().toISOString(),
    },
    [assetName]: updatedAssets,
  });
}
