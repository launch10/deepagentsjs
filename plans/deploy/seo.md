Overview

Implement SEO optimization as a new node in the websiteDeploy Langgraph graph. The AI agent will analyze brainstorm data and generate optimized meta tags for index.html.

Architecture Decision

Approach: AI agent node in websiteDeploy graph (not deterministic Rails step)

Why AI over deterministic:

Good SEO copy requires understanding page content
Brainstorm already has idea, audience, solution - AI synthesizes into optimized tags
Can intelligently select best image for og:image
Fits existing codingAgentGraph subgraph pattern

Scope

In scope:

Meta title (< 60 chars, SEO optimized)
Meta description (150-160 chars)
Favicon link tag (from is_logo upload)
Open Graph tags (og:title, og:description, og:image, og:url)
Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
Canonical URL

Out of scope (future):

User override fields for SEO
Multi-page SEO (only index.html)
JSON-LD structured data

Implementation

Files to Create

Files to Modify

Graph Flow

instrumentation → enqueueOptimizeSEO → optimizeSEO → validateLinks → runtimeValidation → deploy

Node Logic

Check if task already completed (skip if so)
Fetch brainstorm data (idea, audience, solution)
Fetch uploads (logos for favicon, images for og:image)
Invoke coding agent with SEO system prompt to update index.html <head>
Mark task completed

Current State

Already exists:

✅ Favicon generation for is_logo: true uploads (32x32 ICO via CarrierWave)
✅ Query APIs for logos (findLogos(), is_logo filter)
✅ Coding agent pattern in instrumentationNode
✅ Placeholder OG tags in template

Verification

Deploy test website, verify meta tags in output HTML
Facebook Sharing Debugger - validate og tags
Twitter Card Validator - validate twitter tags
Browser DevTools - verify favicon loads
