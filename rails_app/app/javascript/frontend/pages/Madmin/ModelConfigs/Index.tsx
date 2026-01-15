import { useState, useCallback } from "react";
import { Switch } from "@components/ui/switch";
import { Input } from "@components/ui/input";
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

interface Props {
  modelConfigs: ModelConfig[];
}

export default function ModelConfigsIndex({ modelConfigs: initialConfigs }: Props) {
  const [configs, setConfigs] = useState<ModelConfig[]>(initialConfigs);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  const updateConfig = useCallback(
    async (id: number, field: string, value: boolean | number | null) => {
      setSaving((prev) => ({ ...prev, [id]: true }));
      setErrors((prev) => ({ ...prev, [id]: [] }));

      // Optimistically update local state
      setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

      try {
        const response = await fetch(`/admin/model_configs/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_config: {
              [camelToSnake(field)]: value,
            },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setErrors((prev) => ({ ...prev, [id]: data.errors || ["Update failed"] }));
          // Revert on error
          setConfigs(initialConfigs);
        } else {
          const updated = await response.json();
          setConfigs((prev) => prev.map((c) => (c.id === id ? updated : c)));
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setConfigs(initialConfigs);
      } finally {
        setSaving((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialConfigs]
  );

  const handleToggle = (id: number, enabled: boolean) => {
    updateConfig(id, "enabled", enabled);
  };

  const handleNumberChange = (id: number, field: string, value: string) => {
    const numValue = value === "" ? null : Number(value);
    updateConfig(id, field, numValue);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">LLM Model Configuration</h1>
      <p className="text-muted-foreground mb-6">
        Configure model availability and usage limits. Changes take effect within 5 minutes.
      </p>

      <div className="rounded-lg border bg-card">
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
                  saving[config.id] && "opacity-60",
                  !config.enabled && "bg-muted/30"
                )}
              >
                <td className="py-3 px-4">
                  <div className="font-medium capitalize">{config.modelKey}</div>
                  {errors[config.id]?.length > 0 && (
                    <div className="text-sm text-destructive mt-1">
                      {errors[config.id].join(", ")}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Input
                    type="text"
                    value={config.modelCard ?? ""}
                    onChange={(e) => updateConfig(config.id, "modelCard", e.target.value || null)}
                    disabled={saving[config.id]}
                    className="w-48 text-sm font-mono"
                    placeholder="e.g. claude-opus-4-5"
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => handleToggle(config.id, checked)}
                    disabled={saving[config.id]}
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
                    onBlur={(e) => handleNumberChange(config.id, "maxUsagePercent", e.target.value)}
                    disabled={saving[config.id]}
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
                    disabled={saving[config.id]}
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
                    disabled={saving[config.id]}
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
    </div>
  );
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
