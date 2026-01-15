import { useState, useCallback } from "react";
import { Switch } from "@components/ui/switch";
import { Input } from "@components/ui/input";
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

interface ModelConfig {
  id: number;
  modelKey: string;
  modelCard: string | null;
  enabled: boolean;
  maxUsagePercent: number | null;
  costIn: number | null;
  costOut: number | null;
  updatedAt: string;
}

interface ModelPreference {
  id: number;
  costTier: string;
  speedTier: string;
  skill: string;
  modelKeys: string[];
  updatedAt: string;
}

interface Props {
  modelConfigs: ModelConfig[];
  modelPreferences: ModelPreference[];
}

function ModelsIndex({
  modelConfigs: initialConfigs,
  modelPreferences: initialPreferences,
}: Props) {
  const [configs, setConfigs] = useState<ModelConfig[]>(initialConfigs);
  const [preferences, setPreferences] = useState<ModelPreference[]>(initialPreferences);
  const [savingConfigs, setSavingConfigs] = useState<Record<number, boolean>>({});
  const [savingPrefs, setSavingPrefs] = useState<Record<number, boolean>>({});
  const [configErrors, setConfigErrors] = useState<Record<number, string[]>>({});
  const [prefErrors, setPrefErrors] = useState<Record<number, string[]>>({});

  // Model Config handlers
  const updateConfig = useCallback(
    async (id: number, field: string, value: boolean | number | string | null) => {
      setSavingConfigs((prev) => ({ ...prev, [id]: true }));
      setConfigErrors((prev) => ({ ...prev, [id]: [] }));

      setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

      try {
        const response = await fetch(`/admin/models/configs/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_config: { [camelToSnake(field)]: value },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setConfigErrors((prev) => ({ ...prev, [id]: data.errors || ["Update failed"] }));
          setConfigs(initialConfigs);
        } else {
          const updated = await response.json();
          setConfigs((prev) => prev.map((c) => (c.id === id ? updated : c)));
        }
      } catch {
        setConfigErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setConfigs(initialConfigs);
      } finally {
        setSavingConfigs((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialConfigs]
  );

  // Model Preference handlers
  const updatePreference = useCallback(
    async (id: number, modelKeys: string[]) => {
      setSavingPrefs((prev) => ({ ...prev, [id]: true }));
      setPrefErrors((prev) => ({ ...prev, [id]: [] }));

      setPreferences((prev) => prev.map((p) => (p.id === id ? { ...p, modelKeys } : p)));

      try {
        const response = await fetch(`/admin/models/preferences/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_preference: { model_keys: modelKeys },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setPrefErrors((prev) => ({ ...prev, [id]: data.errors || ["Update failed"] }));
          setPreferences(initialPreferences);
        } else {
          const updated = await response.json();
          setPreferences((prev) => prev.map((p) => (p.id === id ? updated : p)));
        }
      } catch {
        setPrefErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setPreferences(initialPreferences);
      } finally {
        setSavingPrefs((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialPreferences]
  );

  const handleToggle = (id: number, enabled: boolean) => {
    updateConfig(id, "enabled", enabled);
  };

  const handleNumberChange = (id: number, field: string, value: string) => {
    const numValue = value === "" ? null : Number(value);
    updateConfig(id, field, numValue);
  };

  const removeModel = (pref: ModelPreference, index: number) => {
    const newKeys = [...pref.modelKeys];
    newKeys.splice(index, 1);
    updatePreference(pref.id, newKeys);
  };

  const addModel = (pref: ModelPreference, modelKey: string) => {
    if (!pref.modelKeys.includes(modelKey)) {
      updatePreference(pref.id, [...pref.modelKeys, modelKey]);
    }
  };

  const moveModel = (pref: ModelPreference, index: number, direction: -1 | 1) => {
    const newKeys = [...pref.modelKeys];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < newKeys.length) {
      [newKeys[index], newKeys[newIndex]] = [newKeys[newIndex], newKeys[index]];
      updatePreference(pref.id, newKeys);
    }
  };

  // Group preferences by cost tier and speed tier
  const groupedPrefs = preferences.reduce(
    (acc, pref) => {
      const key = `${pref.costTier}-${pref.speedTier}`;
      if (!acc[key]) {
        acc[key] = { costTier: pref.costTier, speedTier: pref.speedTier, prefs: [] };
      }
      acc[key].prefs.push(pref);
      return acc;
    },
    {} as Record<string, { costTier: string; speedTier: string; prefs: ModelPreference[] }>
  );

  const sortedGroups = Object.values(groupedPrefs).sort((a, b) => {
    const costOrder = { paid: 0, free: 1 };
    const speedOrder = { slow: 0, fast: 1, blazing: 2 };
    const costA = costOrder[a.costTier as keyof typeof costOrder] ?? 2;
    const costB = costOrder[b.costTier as keyof typeof costOrder] ?? 2;
    if (costA !== costB) return costA - costB;
    const speedA = speedOrder[a.speedTier as keyof typeof speedOrder] ?? 3;
    const speedB = speedOrder[b.speedTier as keyof typeof speedOrder] ?? 3;
    return speedA - speedB;
  });

  const availableModels = configs.map((c) => c.modelKey).sort();

  return (
    <div className="p-6 space-y-12">
      {/* Model Configs Section */}
      <section>
        <h1 className="text-2xl font-bold mb-2">Model Configuration</h1>
        <p className="text-muted-foreground mb-6">
          Configure available models and their settings. Changes take effect within 5 minutes.
        </p>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium">Model</th>
                <th className="text-left py-3 px-4 font-medium">API Model Card</th>
                <th className="text-center py-3 px-4 font-medium">Enabled</th>
                <th className="text-center py-3 px-4 font-medium">Max Usage %</th>
                <th className="text-center py-3 px-4 font-medium">Cost In ($/1M)</th>
                <th className="text-center py-3 px-4 font-medium">Cost Out ($/1M)</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    savingConfigs[config.id] && "opacity-60",
                    !config.enabled && "bg-muted/30"
                  )}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium capitalize">{config.modelKey}</div>
                    {configErrors[config.id]?.length > 0 && (
                      <div className="text-sm text-destructive mt-1">
                        {configErrors[config.id].join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="text"
                      value={config.modelCard ?? ""}
                      onChange={(e) => updateConfig(config.id, "modelCard", e.target.value || null)}
                      disabled={savingConfigs[config.id]}
                      className="w-64 text-sm font-mono"
                      placeholder="e.g. claude-opus-4-5"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => handleToggle(config.id, checked)}
                      disabled={savingConfigs[config.id]}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={config.maxUsagePercent ?? ""}
                      onChange={(e) =>
                        handleNumberChange(config.id, "maxUsagePercent", e.target.value)
                      }
                      onBlur={(e) =>
                        handleNumberChange(config.id, "maxUsagePercent", e.target.value)
                      }
                      disabled={savingConfigs[config.id]}
                      className="w-20 text-center mx-auto"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={config.costIn ?? ""}
                      onChange={(e) => handleNumberChange(config.id, "costIn", e.target.value)}
                      onBlur={(e) => handleNumberChange(config.id, "costIn", e.target.value)}
                      disabled={savingConfigs[config.id]}
                      className="w-24 text-center mx-auto"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={config.costOut ?? ""}
                      onChange={(e) => handleNumberChange(config.id, "costOut", e.target.value)}
                      onBlur={(e) => handleNumberChange(config.id, "costOut", e.target.value)}
                      disabled={savingConfigs[config.id]}
                      className="w-24 text-center mx-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {configs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No model configurations found. Run{" "}
            <code className="bg-muted px-1 rounded">rails db:seed</code> to create them.
          </div>
        )}
      </section>

      {/* Model Preferences Section */}
      <section>
        <h2 className="text-xl font-bold mb-2">Model Preferences</h2>
        <p className="text-muted-foreground mb-6">
          Configure which models to use for each cost/speed/skill combination. Models are tried in
          order from left to right.
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
                      <th className="text-left py-3 px-4 font-medium w-32">Skill</th>
                      <th className="text-left py-3 px-4 font-medium">
                        Preference Order (Primary → Fallbacks)
                      </th>
                      <th className="text-left py-3 px-4 font-medium w-44">Add Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.prefs
                      .sort((a, b) => a.skill.localeCompare(b.skill))
                      .map((pref) => (
                        <tr
                          key={pref.id}
                          className={cn(
                            "border-b last:border-b-0 transition-colors",
                            savingPrefs[pref.id] && "opacity-60"
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium capitalize">{pref.skill}</div>
                            {prefErrors[pref.id]?.length > 0 && (
                              <div className="text-sm text-destructive mt-1">
                                {prefErrors[pref.id].join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2">
                              {pref.modelKeys.map((model, index) => (
                                <div
                                  key={`${pref.id}-${model}-${index}`}
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
                                      onClick={() => moveModel(pref, index, -1)}
                                      disabled={index === 0 || savingPrefs[pref.id]}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => moveModel(pref, index, 1)}
                                      disabled={
                                        index === pref.modelKeys.length - 1 || savingPrefs[pref.id]
                                      }
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-destructive hover:text-destructive"
                                      onClick={() => removeModel(pref, index)}
                                      disabled={savingPrefs[pref.id]}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {pref.modelKeys.length === 0 && (
                                <span className="text-muted-foreground text-sm italic">
                                  No models configured
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              disabled={savingPrefs[pref.id]}
                              onValueChange={(value: string) => addModel(pref, value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Add model..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels
                                  .filter((m) => !pref.modelKeys.includes(m))
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

        {preferences.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No model preferences found. Run{" "}
            <code className="bg-muted px-1 rounded">rails db:seed</code> to create them.
          </div>
        )}
      </section>
    </div>
  );
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Opt out of SiteLayout since madmin has its own layout
ModelsIndex.layout = (page: React.ReactNode) => page;

export default ModelsIndex;
