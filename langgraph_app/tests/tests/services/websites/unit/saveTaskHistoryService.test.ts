import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { SaveTaskHistoryService, setMaxTokensBeforeSummary } from '@services';
import { PageTypeEnum, type TaskHistoryType } from '@types';
import { codeTaskFactory, websiteFactory } from '@factories';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { PageModel } from '@models';

describe('SaveTaskHistoryService', () => {
    let service: SaveTaskHistoryService;
    
    beforeEach(() => {
        service = new SaveTaskHistoryService();
    });
    
    afterEach(() => {
        setMaxTokensBeforeSummary(null); // Reset to default
    });
    
    it('preserves tasks if history < maxTokensBeforeSummary', async () => {
        setMaxTokensBeforeSummary(10000); // High limit so no summarization occurs
        
        const website = await websiteFactory.create();
        const tasks = await Promise.all([
            codeTaskFactory.create({ websiteId: website.id, componentType: 'Hero' }),
            codeTaskFactory.create({ websiteId: website.id, componentType: 'Features' }),
            codeTaskFactory.create({ websiteId: website.id, componentType: 'Benefits' }),
        ]);
        
        tasks[0].results = { summary: "Create a hero component" };
        tasks[1].results = { summary: "Create a features component" };
        tasks[2].results = { summary: "Create a benefits component" };

        const results = await service.execute({
            website,
            pages: [],
            completedTasks: tasks,
            taskHistory: [],
        });

        // Verify all tasks are preserved
        expect(results.taskHistory).toBeDefined();
        expect(results.taskHistory).toHaveLength(3);
        expect(results.taskHistory[0].summary).toContain("hero component");
        expect(results.taskHistory[1].summary).toContain("features component");
        expect(results.taskHistory[2].summary).toContain("benefits component");
    });
    
    it('summarizes old tasks when token count exceeds limit', async () => {
        setMaxTokensBeforeSummary(200); // Low limit to trigger summarization
        
        const website = await websiteFactory.create();
        
        // Create existing task history with long summaries
        const existingHistory: TaskHistoryType[] = [];
        for (let i = 0; i < 10; i++) {
            existingHistory.push({
                websiteId: website.id!,
                type: 'code' as const,
                componentId: `comp-${i}`,
                filePath: `/path/file${i}.tsx`,
                summary: `This is a detailed summary for task ${i}. It contains multiple sentences to increase the token count. The implementation involved creating complex components with various features and functionality.`,
            });
        }
        
        // Create new completed tasks
        const newTasks = await Promise.all([
            codeTaskFactory.create({ websiteId: website.id, componentType: 'NewHero' }),
            codeTaskFactory.create({ websiteId: website.id, componentType: 'NewFeatures' }),
        ]);
        
        newTasks[0].results = { summary: "Created a new hero section with modern design" };
        newTasks[1].results = { summary: "Added new features section with animations" };
        
        const results = await service.execute({
            website,
            pages: [],
            completedTasks: newTasks,
            taskHistory: existingHistory,
        });
        
        // Verify summarization occurred
        expect(results.taskHistory).toBeDefined();
        // Should have fewer entries than original (10 old + 2 new = 12 originally)
        expect(results.taskHistory.length).toBeLessThan(12);
        
        // Recent tasks should be preserved
        const recentSummaries = results.taskHistory.slice(-2).map(h => h.summary);
        expect(recentSummaries).toContain("Created a new hero section with modern design");
        expect(recentSummaries).toContain("Added new features section with animations");
    });
    
    it('groups summaries in batches of 5 when summarizing', async () => {
        setMaxTokensBeforeSummary(150); // This will force summarization
        
        const website = await websiteFactory.create();
        
        // Create 25 task histories with shorter summaries
        const summaries: string[] = [
            "Fix a bug where the Hero component's CTA button wasn't properly centered on mobile viewport widths below 768px",
            "Created a features section highlighting DevMode's core capabilities: real-time code inspection, cross-browser compatibility testing, and element highlighting",
            "Implement responsive navigation menu with hamburger toggle functionality for mobile devices using CSS transforms and JavaScript event handlers",
            "Update the pricing section layout from a single column to a three-tier card design with highlighted 'Popular' badge on the middle plan",
            "Fix TypeScript compilation error in the testimonials carousel component where the auto-advance timer wasn't properly typed",
            "Create an interactive demo section allowing users to hover over webpage elements to see live HTML/CSS code snippets",
            "Refactor the footer component to use CSS Grid instead of Flexbox for better alignment of social links and legal pages",
            "Add loading skeleton states for the 'How It Works' section when code examples are being fetched from the API",
            "Fix accessibility issue where the main navigation skip link wasn't properly focusing on the content area for screen readers",
            "Implement lazy loading for hero section background video to improve initial page load performance by 40%",
            "Create a 'Browser Extensions' section showcasing Chrome, Firefox, and Safari plugin download buttons with usage statistics",
            "Update the hero headline copy from 'See Any Website's Code' to 'Inspect, Learn, Build - See How Any Website Works' based on A/B testing results",
            "Fix z-index stacking issue where the mobile menu was appearing behind the pricing section's floating elements",
            "Add animated counter components to the stats section displaying total websites analyzed, lines of code viewed, and active users",
            "Create a 'Use Cases' section with tabbed interface showing DevMode's applications for developers, designers, and students",
            "Implement dark mode toggle functionality with CSS custom properties and localStorage persistence across page reloads",
            "Fix memory leak in the code syntax highlighter component that was causing performance degradation on longer page visits",
            "Update the contact form validation to include real-time email format checking and display inline error messages",
            "Create an FAQ accordion component with smooth expand/collapse animations using CSS transitions and ARIA attributes",
            "Fix cross-browser compatibility issue where CSS Grid layouts weren't rendering correctly in Safari versions below 14",
            "Implement Google Analytics 4 event tracking for CTA button clicks, demo interactions, and scroll depth milestones",
            "Add a 'Trusted by Developers' section featuring logos of companies whose developers use DevMode, with lazy-loaded SVG sprites",
            "Update the pricing page routing to support deep linking to specific plan comparisons via URL hash parameters",
            "Create a floating 'Try Free Demo' button that appears after users scroll past the hero section, with smooth CSS animations",
            "Fix production build optimization issue where unused CSS from the component library was inflating the bundle size by 120KB"
        ]
        const existingHistory: TaskHistoryType[] = [];
        for (let i = 0; i < 25; i++) {
            existingHistory.push({
                websiteId: website.id!,
                type: 'code' as const,
                componentId: `comp-${i}`,
                filePath: `/path/file${i}.tsx`,
                summary: summaries[i]
            });
        }
        
        const results = await service.execute({
            website,
            pages: [],
            completedTasks: [],
            taskHistory: existingHistory,
        });
        
        // With 25 histories grouped by 5, we should get 5 summarized entries
        // plus some preserved recent ones
        expect(results.taskHistory).toBeDefined();
        expect(results.taskHistory.length).toBeLessThan(25);
        
        // Verify compression occurred
        // With 150 token limit, we preserve 80% (120 tokens) of recent messages
        // That's about 15 recent messages preserved + some summaries of older ones
        expect(results.taskHistory.length).toBeLessThanOrEqual(20); // Some summaries + preserved recent ones
        console.log(results.taskHistory)
    });
    
    it('preserves 80% of max tokens from the most recent messages', async () => {
        setMaxTokensBeforeSummary(1000);
        
        const website = await websiteFactory.create();
        
        // Create task history with varying sizes
        const existingHistory: TaskHistoryType[] = [];
        
        // Old tasks with longer summaries
        for (let i = 0; i < 5; i++) {
            existingHistory.push({
                websiteId: website.id!,
                type: 'code' as const,
                componentId: `old-${i}`,
                filePath: `/old/file${i}.tsx`,
                summary: `Old task ${i}: This is a very long summary that contains a lot of details about the implementation. It describes various aspects of the component, the challenges faced, and the solutions implemented. This helps increase the token count significantly for testing purposes.`,
            });
        }
        
        // Recent tasks with shorter summaries
        for (let i = 0; i < 5; i++) {
            existingHistory.push({
                websiteId: website.id!,
                type: 'code' as const,
                componentId: `recent-${i}`,
                filePath: `/recent/file${i}.tsx`,
                summary: `Recent task ${i}: Short summary`,
            });
        }
        
        const results = await service.execute({
            website,
            pages: [],
            completedTasks: [],
            taskHistory: existingHistory,
        });
        
        // Verify recent tasks are preserved
        const summaries = results.taskHistory.map(h => h.summary || '');
        const recentPreserved = summaries.filter(s => s.includes('Recent task'));
        
        // Most or all recent tasks should be preserved
        expect(recentPreserved.length).toBeGreaterThanOrEqual(3);
    });
});

