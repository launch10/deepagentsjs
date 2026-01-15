# Scheduling Tool Landing Page

## Overview
A high-converting landing page for a scheduling tool that automatically finds meeting times across teams in different time zones.

## Design Highlights

### Visual Identity
- **Typography**: Space Grotesk (headlines) + DM Sans (body)
- **Color Palette**: Warm earth tones (#264653, #2A9D8F, #E9C46A, #F4A261, #E76F51)
- **Memorable Element**: "Calendar Tetris" metaphor + atmospheric gradient orbs
- **Style**: Modern, professional, with depth and visual interest

### Section Structure
1. **Header** - Sticky navigation with smooth scroll
2. **Hero** - Bold bg-primary with email capture, atmospheric effects
3. **Problem Section** - 3 relatable pain points (bg-muted)
4. **How It Works** - 3-step process with large numbers (bg-background)
5. **Features** - 5 key capabilities in cards (bg-muted)
6. **Social Proof** - Stats + 3 testimonials (bg-background)
7. **Final CTA** - Urgent call-to-action with email capture (bg-primary)
8. **Footer** - Links and branding (bg-primary)

## Components Created

### `/src/components/`
- `Header.tsx` - Sticky navigation with smooth scroll
- `Hero.tsx` - Main hero with email capture form
- `ProblemSection.tsx` - 3 pain points with icons
- `HowItWorks.tsx` - 3-step process explanation
- `Features.tsx` - 5 feature cards
- `SocialProof.tsx` - Stats + testimonials
- `FinalCTA.tsx` - Final conversion section with email form
- `Footer.tsx` - Footer with links

### `/src/pages/`
- `LandingPage.tsx` - Main landing page composition
- `IndexPage.tsx` - Entry point (renders LandingPage)

## Lead Capture Implementation

Both Hero and FinalCTA sections include email capture forms using `L10.createLead()`:

```tsx
import { L10 } from '@/lib/tracking';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await L10.createLead(email);
    setStatus('success');
  } catch (err) {
    setStatus('error');
    setError(err.message);
  }
};
```

This automatically:
- Submits lead to backend API
- Fires Google Ads conversion tracking
- Handles success/error states

## Design Quality Checklist ✅

### Visual Impact
- ✅ Hero uses bg-primary with dramatic gradients
- ✅ Headline is text-7xl (bold and memorable)
- ✅ Atmospheric elements (gradient orbs, subtle grid pattern)
- ✅ Section backgrounds alternate (primary → muted → background)

### Typography
- ✅ Headlines are text-4xl to text-7xl
- ✅ Custom fonts loaded (Space Grotesk + DM Sans)
- ✅ Clear hierarchy with color accents
- ✅ Responsive text sizes

### Spacing & Layout
- ✅ Generous section padding (py-20 md:py-24 lg:py-28)
- ✅ Consistent gaps (gap-8 lg:gap-10)
- ✅ Mobile-first responsive design
- ✅ Cards have depth (rounded-3xl, shadows)

### Interactivity
- ✅ Hover effects on all interactive elements
- ✅ Smooth transitions (duration-200 to duration-300)
- ✅ Entrance animations (slide-up, fade-in, zoom-in)
- ✅ Staggered animation delays on cards

### Memorable Elements
- ✅ "Calendar Tetris" headline metaphor
- ✅ Atmospheric gradient orbs throughout
- ✅ Warm, distinctive color palette
- ✅ Subtle grid pattern texture

## Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

The following are injected at build time (handled by L10 platform):
- `VITE_API_BASE_URL` - API endpoint
- `VITE_SIGNUP_TOKEN` - Authentication token
- `VITE_GOOGLE_ADS_ID` - Google Ads tracking ID

## Key Features

1. **Email Capture**: Two conversion points (Hero + Final CTA)
2. **Smooth Scrolling**: Navigation links scroll to sections
3. **Responsive Design**: Mobile-first, works on all devices
4. **Animations**: Subtle entrance animations and hover effects
5. **Accessibility**: Semantic HTML, proper contrast ratios
6. **Performance**: CSS-only animations, optimized images

## Copy Highlights

- **Headline**: "Stop Playing Calendar Tetris Across Time Zones"
- **Value Prop**: Eliminates back-and-forth scheduling for distributed teams
- **Social Proof**: 2,000+ teams, 80% time saved, 15 hours/week saved
- **CTA**: "Start Scheduling Smarter" (benefit-focused)

## Next Steps

1. Test email capture forms
2. Verify Google Ads conversion tracking
3. A/B test headline variations
4. Add more testimonials as they come in
5. Consider adding a demo video in Hero section
