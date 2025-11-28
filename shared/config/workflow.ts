export const workflow = {
  launch: {
    steps: {
      brainstorm: {
        order: 1
      },
      website: {
        order: 2
      },
      ad_campaign: {
        order: 3,
        substeps: ["content", "highlights", "keywords", "settings", "launch", "review"] as const
      },
      launch: {
        order: 4,
        substeps: ["settings", "review", "deployment"] as const
      }
    }
  }
} as const;
