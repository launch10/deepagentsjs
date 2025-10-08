import { describe, it, vi } from 'vitest';
import { pickThemePrompt, pickThemePromptOutputSchema } from '@prompts';
import { HumanMessage } from '@langchain/core/messages';
import { expectSection, expectPromptHasSections, expectNoStringifiedNulls } from '@support';
import { z } from 'zod';

describe.skip('pickTheme Prompt - Contract Tests', () => {
  const mockThemeService = {
    getAllThemeLabels: vi.fn().mockResolvedValue(['Modern', 'Minimal', 'Dark', 'Light'])
  };

  it('generates valid structured output matching pickThemePromptOutputSchema', async () => {
    const result = await pickThemePrompt({
      userRequest: new HumanMessage("Create a modern website"),
      themeService: mockThemeService as any
    });

    expectSection(result, 'structured-output')
      .toBeValidFormat()
      .toMatchContract(pickThemePromptOutputSchema);
  });

  it('has all required sections', async () => {
    const result = await pickThemePrompt({
      userRequest: new HumanMessage("Build a dark themed site"),
      themeService: mockThemeService as any
    });

    expectPromptHasSections(
      result,
      'role',
      'task',
      'tools',
      'available-theme-labels',
      'user-request',
      'structured-output'
    );
  });

  it('available-theme-labels section is valid pipe or text format', async () => {
    const result = await pickThemePrompt({
      userRequest: new HumanMessage("Create a website"),
      themeService: mockThemeService as any
    });

    const section = expectSection(result, 'available-theme-labels');
    section.toBeValidFormat();
  });

  it('has no stringified nulls or undefined', async () => {
    const result = await pickThemePrompt({
      userRequest: new HumanMessage("Make a site"),
      themeService: mockThemeService as any
    });

    expectNoStringifiedNulls(result);
  });

  it('handles various user requests without breaking contract', async () => {
    const requests = [
      "I need a professional business website",
      "Dark mode gaming site",
      "Minimalist portfolio",
      "Colorful kids website"
    ];

    for (const request of requests) {
      const result = await pickThemePrompt({
        userRequest: new HumanMessage(request),
        themeService: mockThemeService as any
      });

      expectSection(result, 'structured-output')
        .toMatchContract(pickThemePromptOutputSchema);

      expectNoStringifiedNulls(result);
    }
  });

  it('structured output requires themeId to be a number', async () => {
    const result = await pickThemePrompt({
      userRequest: new HumanMessage("Create a website"),
      themeService: mockThemeService as any
    });

    const parsed = expectSection(result, 'structured-output')
      .toMatchContract(
        z.object({
          themeId: z.number()
        })
      );

    expect(typeof parsed.themeId).toBe('number');
  });

  it('errors when userRequest is missing', async () => {
    await expect(
      pickThemePrompt({
        userRequest: null as any,
        themeService: mockThemeService as any
      })
    ).rejects.toThrow();
  });
});
