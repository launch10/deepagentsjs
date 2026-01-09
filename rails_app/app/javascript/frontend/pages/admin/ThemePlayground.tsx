import { useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import {
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// Types matching the controller's as_json output
interface ThemeLabel {
  id: number;
  name: string;
}

interface PairingEntry {
  color: string;
  contrast_ratio: number;
  level: "AAA" | "AA" | "AA-large" | "fail";
}

interface Theme {
  id: number;
  name: string;
  colors: string[];
  theme: Record<string, string>;
  pairings: Record<string, PairingEntry[]>;
  theme_type: "official" | "community";
  theme_labels: ThemeLabel[];
}

interface ThemePlaygroundProps {
  themes: Theme[];
}

// The semantic roles we generate and their Tailwind usage
// shadcn convention: --foreground for background, --muted-foreground is global subdued text
const SEMANTIC_GUIDE = [
  {
    role: "background",
    usage: "bg-background",
    text: "text-foreground",
    desc: "Main page background",
  },
  { role: "card", usage: "bg-card", text: "text-card-foreground", desc: "Card/panel surfaces" },
  {
    role: "primary",
    usage: "bg-primary",
    text: "text-primary-foreground",
    desc: "Primary buttons, CTAs",
  },
  {
    role: "secondary",
    usage: "bg-secondary",
    text: "text-secondary-foreground",
    desc: "Secondary actions",
  },
  { role: "muted", usage: "bg-muted", text: "text-muted-foreground", desc: "Subdued sections" },
  {
    role: "accent",
    usage: "bg-accent",
    text: "text-accent-foreground",
    desc: "Highlights, badges",
  },
  {
    role: "destructive",
    usage: "bg-destructive",
    text: "text-destructive-foreground",
    desc: "Delete, errors",
  },
];

// Transform theme CSS vars to Tailwind v4 format (--var to --color-var)
// Now using shadcn naming convention:
// - --foreground = main text color (not --background-foreground)
// - --muted-foreground = subdued text (global, works on background and muted)
// - --{role}-foreground = text color for each surface
function transformThemeVars(theme: Record<string, string>): React.CSSProperties {
  const transformed: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme)) {
    if (key.startsWith("--") && !key.startsWith("--color-")) {
      transformed[`--color-${key.slice(2)}`] = value;
    } else {
      transformed[key] = value;
    }
  }

  return transformed as React.CSSProperties;
}

export default function ThemePlayground({ themes }: ThemePlaygroundProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(themes[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"preview" | "surfaces" | "pairings">("preview");
  const selectedTheme = themes.find((t) => t.id === selectedThemeId) ?? null;

  const themeStyles = selectedTheme?.theme ? transformThemeVars(selectedTheme.theme) : undefined;

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Left sidebar: Theme selector */}
      <aside className="w-72 border-r border-neutral-200 bg-white flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <h1 className="text-lg font-semibold text-neutral-900">Theme Playground</h1>
          <p className="text-sm text-neutral-500 mt-1">Test semantic color roles</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {themes.map((theme) => (
            <ThemeRow
              key={theme.id}
              theme={theme}
              isSelected={selectedThemeId === theme.id}
              onSelect={() => setSelectedThemeId(theme.id)}
            />
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-neutral-200 bg-white px-4">
          <nav className="flex gap-4">
            {(["preview", "surfaces", "pairings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={twMerge(
                  "py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                )}
              >
                {tab === "preview" && "Landing Page Preview"}
                {tab === "surfaces" && "Surface Reference"}
                {tab === "pairings" && "Color Pairings"}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTheme ? (
            <div style={themeStyles}>
              {activeTab === "preview" && <LandingPagePreview />}
              {activeTab === "surfaces" && <SurfaceReference theme={selectedTheme} />}
              {activeTab === "pairings" && (
                <PairingsDisplay colors={selectedTheme.colors} pairings={selectedTheme.pairings} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-400">
              Select a theme to preview
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Landing page preview with realistic sections
function LandingPagePreview() {
  return (
    <div>
      {/* Hero - bg-background */}
      <section className="bg-background p-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-foreground mb-4">Transform Your Workflow</h1>
          <p className="text-xl text-[var(--color-muted-foreground)] mb-8 max-w-2xl mx-auto">
            Boost productivity by 40% with our AI-powered platform. Join thousands of teams already
            saving time.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold">
              Get Started Free
            </button>
            <button className="bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features - bg-muted with bg-card cards */}
      <section className="bg-muted p-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-muted-foreground text-center mb-12">
            Powerful Features
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { title: "Real-time Sync", desc: "Changes sync instantly across all devices." },
              { title: "Smart Analytics", desc: "AI-powered insights for better decisions." },
              { title: "Team Collaboration", desc: "Built-in chat and seamless sharing." },
            ].map((feature, i) => (
              <div key={i} className="bg-card text-card-foreground p-6 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center mb-4">
                  <span className="text-accent-foreground font-bold">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-[var(--color-muted-foreground)] text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - bg-primary (inverted) */}
      <section className="bg-primary p-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Join thousands of teams already using our platform.
          </p>
          <button className="bg-background text-foreground px-8 py-3 rounded-lg font-semibold">
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Status Messages Demo */}
      <section className="bg-background p-16">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-foreground mb-6">Status Messages</h2>

          <div className="bg-[var(--color-success)] text-[var(--color-success-foreground)] p-4 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span>Success! Your changes have been saved.</span>
          </div>

          <div className="bg-[var(--color-warning)] text-[var(--color-warning-foreground)] p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span>Warning: Your session will expire in 5 minutes.</span>
          </div>

          <div className="bg-destructive text-destructive-foreground p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>Error: Unable to process your request.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// Surface reference showing all semantic roles
function SurfaceReference({ theme }: { theme: Theme }) {
  return (
    <div className="p-8 bg-neutral-100 min-h-full">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Semantic Surface Reference</h2>
        <p className="text-neutral-600 mb-8">
          Each surface has a background color and matching foreground (text) color. Per shadcn
          convention, <code className="bg-neutral-200 px-1 rounded">--muted-foreground</code> is a
          global subdued text color for use on{" "}
          <code className="bg-neutral-200 px-1 rounded">--background</code> and
          <code className="bg-neutral-200 px-1 rounded">--muted</code> surfaces.
        </p>

        <div className="space-y-4">
          {SEMANTIC_GUIDE.map(({ role, usage, text, desc }) => {
            const bgVar = `--color-${role}`;
            // shadcn convention: --foreground for background, --muted-foreground for muted, --{role}-foreground for others
            const fgVar =
              role === "background" ? "--color-foreground" : `--color-${role}-foreground`;
            // Use muted-foreground as the subdued text color (shadcn convention)
            const showMuted = role === "background" || role === "muted";

            return (
              <div key={role} className="bg-white rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-[200px_1fr] items-stretch">
                  {/* Label */}
                  <div className="p-4 border-r border-neutral-100">
                    <div className="font-mono text-sm font-semibold text-neutral-900">{role}</div>
                    <div className="text-xs text-neutral-500 mt-1">{desc}</div>
                    <div className="mt-2 space-y-1">
                      <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 block">
                        {usage}
                      </code>
                      <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 block">
                        {text}
                      </code>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-6" style={{ backgroundColor: `var(${bgVar})` }}>
                    <p style={{ color: `var(${fgVar})` }} className="font-semibold mb-1">
                      Primary text on {role}
                    </p>
                    {showMuted ? (
                      <p style={{ color: `var(--color-muted-foreground)` }} className="text-sm">
                        Subdued text (--muted-foreground)
                      </p>
                    ) : (
                      <p style={{ color: `var(${fgVar})`, opacity: 0.7 }} className="text-sm">
                        Use opacity for de-emphasis on colored surfaces
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CSS Variables Reference */}
        <div className="mt-12 bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-neutral-900 mb-4">Generated CSS Variables</h3>
          <div className="grid grid-cols-2 gap-4 font-mono text-xs">
            {Object.entries(theme.theme || {}).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-neutral-200 flex-shrink-0"
                  style={{ backgroundColor: value.toString() }}
                />
                <span className="text-neutral-600">{key}:</span>
                <span className="text-neutral-900 truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Theme row component for the sidebar
function ThemeRow({
  theme,
  isSelected,
  onSelect,
}: {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const normalizeColor = (color: string) => (color.startsWith("#") ? color : `#${color}`);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={twMerge(
        "w-full p-3 rounded-lg text-left transition-all mb-1",
        "hover:bg-neutral-50",
        isSelected && "bg-neutral-100 ring-2 ring-blue-500"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-900 truncate">{theme.name}</span>
        {isSelected && <Check className="w-4 h-4 text-blue-500" />}
      </div>
      <div className="flex h-6 rounded overflow-hidden">
        {theme.colors.slice(0, 5).map((color, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: normalizeColor(color) }} />
        ))}
      </div>
    </button>
  );
}

// Pairings display - shows which colors work together
function PairingsDisplay({
  colors,
  pairings,
}: {
  colors: string[];
  pairings: Record<string, PairingEntry[]>;
}) {
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());

  if (!pairings || Object.keys(pairings).length === 0) {
    return (
      <div className="p-8">
        <p className="text-neutral-500">No pairing data available for this theme.</p>
      </div>
    );
  }

  const toggleColor = (color: string) => {
    setExpandedColors((prev) => {
      const next = new Set(prev);
      next.has(color) ? next.delete(color) : next.add(color);
      return next;
    });
  };

  const normalizeColor = (color: string) => (color.startsWith("#") ? color : `#${color}`);

  const colorsWithPairings = Object.keys(pairings);

  return (
    <div className="p-8 bg-neutral-100 min-h-full">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">WCAG Color Pairings</h2>
        <p className="text-neutral-600 mb-8">
          These color combinations meet WCAG contrast requirements. Use any pair where the
          background and text colors have sufficient contrast.
        </p>

        <div className="space-y-2">
          {colorsWithPairings.map((bgColor) => {
            const pairs = pairings[bgColor] || [];
            const isExpanded = expandedColors.has(bgColor);
            const aaaPairs = pairs.filter((p) => p.level === "AAA").length;
            const aaPairs = pairs.filter((p) => p.level === "AA").length;

            return (
              <div key={bgColor} className="bg-white rounded-lg overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleColor(bgColor)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                  <div
                    className="w-8 h-8 rounded border border-neutral-200"
                    style={{ backgroundColor: normalizeColor(bgColor) }}
                  />
                  <span className="font-mono text-sm text-neutral-700">#{bgColor}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {aaaPairs > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {aaaPairs} AAA
                      </span>
                    )}
                    {aaPairs > 0 && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        {aaPairs} AA
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && pairs.length > 0 && (
                  <div className="border-t border-neutral-100 p-4 bg-neutral-50">
                    <p className="text-xs text-neutral-500 mb-3">
                      Text colors that work on #{bgColor} background:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {pairs.map((pair) => (
                        <div
                          key={pair.color}
                          className="flex items-center gap-2 p-2 rounded border border-neutral-200 bg-white"
                        >
                          <div
                            className="w-10 h-10 rounded flex items-center justify-center text-sm font-bold"
                            style={{
                              backgroundColor: normalizeColor(bgColor),
                              color: normalizeColor(pair.color),
                            }}
                          >
                            Aa
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs text-neutral-700">#{pair.color}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-neutral-500">
                                {pair.contrast_ratio.toFixed(1)}:1
                              </span>
                              <span
                                className={twMerge(
                                  "text-xs px-1 rounded",
                                  pair.level === "AAA" && "bg-green-100 text-green-700",
                                  pair.level === "AA" && "bg-yellow-100 text-yellow-700",
                                  pair.level === "AA-large" && "bg-orange-100 text-orange-700"
                                )}
                              >
                                {pair.level}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Opt out of the default SiteLayout
ThemePlayground.layout = (page: ReactNode) => page;
