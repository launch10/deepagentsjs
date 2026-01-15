import { useState, useCallback } from "react";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { cn } from "@lib/utils";

interface FallbackChain {
  id: number;
  costTier: string;
  speedTier: string;
  skill: string;
  modelKeys: string[];
  updatedAt: string;
}

interface Props {
  chains: FallbackChain[];
  availableModels: string[];
}

export default function ModelFallbackChainsIndex({
  chains: initialChains,
  availableModels,
}: Props) {
  const [chains, setChains] = useState<FallbackChain[]>(initialChains);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  const updateChain = useCallback(
    async (id: number, modelKeys: string[]) => {
      setSaving((prev) => ({ ...prev, [id]: true }));
      setErrors((prev) => ({ ...prev, [id]: [] }));

      // Optimistically update local state
      setChains((prev) => prev.map((c) => (c.id === id ? { ...c, modelKeys } : c)));

      try {
        const response = await fetch(`/admin/model_fallback_chains/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_fallback_chain: {
              model_keys: modelKeys,
            },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setErrors((prev) => ({
            ...prev,
            [id]: data.errors || ["Update failed"],
          }));
          // Revert on error
          setChains(initialChains);
        } else {
          const updated = await response.json();
          setChains((prev) => prev.map((c) => (c.id === id ? updated : c)));
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setChains(initialChains);
      } finally {
        setSaving((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialChains]
  );

  const removeModel = (chain: FallbackChain, index: number) => {
    const newKeys = [...chain.modelKeys];
    newKeys.splice(index, 1);
    updateChain(chain.id, newKeys);
  };

  const addModel = (chain: FallbackChain, modelKey: string) => {
    if (!chain.modelKeys.includes(modelKey)) {
      updateChain(chain.id, [...chain.modelKeys, modelKey]);
    }
  };

  const moveModel = (chain: FallbackChain, index: number, direction: -1 | 1) => {
    const newKeys = [...chain.modelKeys];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < newKeys.length) {
      [newKeys[index], newKeys[newIndex]] = [newKeys[newIndex], newKeys[index]];
      updateChain(chain.id, newKeys);
    }
  };

  // Group chains by cost tier and speed tier
  const grouped = chains.reduce(
    (acc, chain) => {
      const key = `${chain.costTier}-${chain.speedTier}`;
      if (!acc[key]) {
        acc[key] = {
          costTier: chain.costTier,
          speedTier: chain.speedTier,
          chains: [],
        };
      }
      acc[key].chains.push(chain);
      return acc;
    },
    {} as Record<string, { costTier: string; speedTier: string; chains: FallbackChain[] }>
  );

  // Sort groups by cost tier (paid first) and speed tier (slow, fast, blazing)
  const sortedGroups = Object.values(grouped).sort((a, b) => {
    const costOrder = { paid: 0, free: 1 };
    const speedOrder = { slow: 0, fast: 1, blazing: 2 };
    if (
      costOrder[a.costTier as keyof typeof costOrder] !==
      costOrder[b.costTier as keyof typeof costOrder]
    ) {
      return (
        costOrder[a.costTier as keyof typeof costOrder] -
        costOrder[b.costTier as keyof typeof costOrder]
      );
    }
    return (
      speedOrder[a.speedTier as keyof typeof speedOrder] -
      speedOrder[b.speedTier as keyof typeof speedOrder]
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">LLM Fallback Chains</h1>
      <p className="text-muted-foreground mb-6">
        Configure fallback chains for each cost/speed/skill combination. Models are tried in order
        from left to right. Changes take effect within 5 minutes.
      </p>

      <div className="space-y-8">
        {sortedGroups.map((group) => (
          <div key={`${group.costTier}-${group.speedTier}`} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={group.costTier === "paid" ? "default" : "secondary"}>
                {group.costTier}
              </Badge>
              <Badge variant="outline">{group.speedTier}</Badge>
            </div>

            <div className="rounded-lg border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium w-28">Skill</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Fallback Chain (Primary → Fallbacks)
                    </th>
                    <th className="text-left py-3 px-4 font-medium w-48">Add Model</th>
                  </tr>
                </thead>
                <tbody>
                  {group.chains
                    .sort((a, b) => a.skill.localeCompare(b.skill))
                    .map((chain) => (
                      <tr
                        key={chain.id}
                        className={cn(
                          "border-b last:border-b-0 transition-colors",
                          saving[chain.id] && "opacity-60"
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium capitalize">{chain.skill}</div>
                          {errors[chain.id]?.length > 0 && (
                            <div className="text-sm text-destructive mt-1">
                              {errors[chain.id].join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-2">
                            {chain.modelKeys.map((model, index) => (
                              <div
                                key={`${chain.id}-${model}-${index}`}
                                className="flex items-center gap-1 bg-muted rounded-md px-2 py-1"
                              >
                                <span className="text-xs text-muted-foreground mr-1">
                                  {index + 1}.
                                </span>
                                <span className="text-sm font-mono">{model}</span>
                                <div className="flex items-center gap-0.5 ml-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveModel(chain, index, -1)}
                                    disabled={index === 0 || saving[chain.id]}
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveModel(chain, index, 1)}
                                    disabled={
                                      index === chain.modelKeys.length - 1 || saving[chain.id]
                                    }
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive hover:text-destructive"
                                    onClick={() => removeModel(chain, index)}
                                    disabled={saving[chain.id]}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {chain.modelKeys.length === 0 && (
                              <span className="text-muted-foreground text-sm italic">
                                No models configured
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Select
                            disabled={saving[chain.id]}
                            onValueChange={(value: string) => addModel(chain, value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Add model..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels
                                .filter((m) => !chain.modelKeys.includes(m))
                                .map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {chains.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No fallback chains found. Run <code className="bg-muted px-1 rounded">rails db:seed</code>{" "}
          to create them.
        </div>
      )}
    </div>
  );
}
