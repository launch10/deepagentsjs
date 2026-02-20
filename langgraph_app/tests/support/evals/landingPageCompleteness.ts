/**
 * Programmatic scorer for landing page completeness.
 * No LLM call needed — checks structural requirements directly.
 */

export interface LandingPageFiles {
  [path: string]: { content: string } | string;
}

interface CheckResult {
  passed: boolean;
  label: string;
}

function getContent(file: { content: string } | string): string {
  return typeof file === "string" ? file : file.content;
}

/**
 * Score a set of landing page files on structural completeness.
 * Returns 0-1 based on how many checks pass.
 */
export function LandingPageCompletenessScorer(files: LandingPageFiles): number {
  const allContent = Object.entries(files)
    .map(([, f]) => getContent(f))
    .join("\n");

  const componentPaths = Object.keys(files).filter((p) => p.includes("src/components"));
  const pagePaths = Object.keys(files).filter(
    (p) => p.includes("src/pages") || p.includes("src/App")
  );

  const checks: CheckResult[] = [
    // Structural completeness
    {
      label: "Has hero section",
      passed: componentPaths.some((p) => /hero/i.test(p)),
    },
    {
      label: "Has ≥3 component files",
      passed: componentPaths.length >= 3,
    },
    {
      label: "Has page composition root (IndexPage or App)",
      passed: pagePaths.length > 0,
    },
    {
      label: "Has CTA or signup section",
      passed:
        componentPaths.some((p) => /cta|signup|waitlist/i.test(p)) ||
        allContent.includes("LeadForm"),
    },
    {
      label: "Has footer",
      passed: componentPaths.some((p) => /footer/i.test(p)),
    },

    // Tracking
    {
      label: "Has LeadForm tracking",
      passed: allContent.includes("LeadForm"),
    },

    // Design system usage
    {
      label: "Uses semantic color classes (bg-primary)",
      passed: allContent.includes("bg-primary"),
    },
    {
      label: "Uses section rhythm (bg-muted)",
      passed: allContent.includes("bg-muted"),
    },
    {
      label: "Has responsive breakpoints (md: or lg:)",
      passed: /\b(md|lg):/.test(allContent),
    },

    // Typography & spacing
    {
      label: "Has large headlines (text-4xl or larger)",
      passed: /text-(4xl|5xl|6xl|7xl|8xl|9xl)/.test(allContent),
    },
    {
      label: "Has generous section padding (py-16 or larger)",
      passed: /py-(16|20|24|28|32)/.test(allContent),
    },

    // Interactivity
    {
      label: "Has hover effects",
      passed: /hover:/.test(allContent),
    },
  ];

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;

  // Log details for debugging
  const failures = checks.filter((c) => !c.passed);
  if (failures.length > 0) {
    console.log(`Completeness failures: ${failures.map((f) => f.label).join(", ")}`);
  }

  return passed / total;
}
