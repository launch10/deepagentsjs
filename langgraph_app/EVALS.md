### Basic Eval Types:

1. Factuality - Verify that generated content is factually accurate
   compared to your source data

2. AnswerRelevancy - Ensure generated sections directly address the
   user's input requirements

3. EmbeddingSimilarity - Compare semantic similarity when you have
   example/template content

4. Moderation - Critical for safety - screens for inappropriate content

5. ValidJSON - If your system outputs structured data for page
   components

6. ClosedQA - Test if generated FAQ sections or product descriptions
   answer key questions

7. Summary - Evaluate quality of generated meta descriptions or content
   summaries

Quick Implementation Example:

import { Factuality, AnswerRelevancy, Moderation, EmbeddingSimilarity }
from "autoevals";

// Evaluate landing page headline
const headlineScore = await AnswerRelevancy({
input: userRequirements,
context: brandGuidelines,
output: generatedHeadline
});

// Check content safety
const safetyScore = await Moderation({
output: generatedPageContent
});

// Compare to successful templates
const similarityScore = await EmbeddingSimilarity({
output: generatedHeroSection,
expected: highConvertingTemplate,
expectedMin: 0.7
});

### Quality Evaluations:

1. Battle - Compare generated copy against proven high-converting
   examples:
   import { Battle } from "autoevals";

const persuasivenessScore = await Battle({
instructions: "Which copy is more persuasive and likely to convert
visitors into customers? Consider emotional appeal, clarity of value
proposition, and call-to-action strength.",
output: generatedCopy,
expected: highConvertingExample
});

2. ClosedQA with custom criteria - Evaluate against specific writing
   standards:

```typescript
import { ClosedQA } from "autoevals";

const writingQualityScore = await ClosedQA({
  input: generatedLandingPage,
  criteria: {
    clarity: "Is the message clear and easy to understand?",
    persuasiveness: "Does it create urgency and desire?",
    benefits_focused: "Does it focus on customer benefits over features?",
    social_proof: "Does it include credible testimonials or statistics?",
    cta_strength: "Is the call-to-action compelling and clear?",
  },
});
```

Custom LLM Evaluators:

You can create specialized evaluators using LLMClassifier:

```typescript
import { LLMClassifier } from "autoevals";

// Custom persuasiveness scorer
const PersuasivenessScorer = LLMClassifier({
  name: "persuasiveness",
  promptTemplate: `Rate the persuasiveness of this landing page copy on
   a scale of 0-1.

   Consider:

   - Emotional triggers and pain point addressing
   - Value proposition clarity
   - Urgency and scarcity tactics
   - Trust signals and social proof
   - Call-to-action effectiveness

   Copy: {{output}}

   Provide a score and detailed explanation.`,
  choiceScores: { excellent: 1, good: 0.75, average: 0.5, poor: 0.25 },
});
```

// Custom writing quality scorer
const WritingQualityScorer = LLMClassifier({
name: "writing_quality",
promptTemplate: `Evaluate the writing quality for conversion-focused
copy.

Criteria:

- Scannable structure (headlines, bullets, short paragraphs)
- Active voice and power words
- Benefit-driven language
- Readability and flow
- Professional tone without jargon

Content: {{output}}

Rate the quality and explain.`,
choiceScores: { "exceptional": 1, "strong": 0.8, "adequate": 0.6,
"weak": 0.3 }
});

Comprehensive Landing Page Evaluation:

// Combine multiple evaluations
async function evaluateLandingPage(generatedPage: string, userGoals:
string) {
const scores = await Promise.all([
// Writing quality
WritingQualityScorer({ output: generatedPage }),

      // Persuasiveness
      PersuasivenessScorer({ output: generatedPage }),

      // Alignment with goals
      AnswerRelevancy({
        input: userGoals,
        output: generatedPage,
        context: "Landing page for product launch"
      }),

      // Safety check
      Moderation({ output: generatedPage })

]);

return {
writingQuality: scores[0].score,
persuasiveness: scores[1].score,
goalAlignment: scores[2].score,
safety: scores[3].score,
overall: scores.reduce((sum, s) => sum + s.score, 0) / scores.length
};
}
