
import { type AdsGraphState } from "@state";
import { type Ads } from "@types";

export const previousAssetsContext = (state: AdsGraphState): string[] => {
    const sections: string[] = [];

    const headlinesContext = formatAssetList(state.headlines, 'Headlines');
    const descriptionsContext = formatAssetList(state.descriptions, 'Descriptions');
    const calloutsContext = formatAssetList(state.callouts, 'Callouts');
    const keywordsContext = formatAssetList(state.keywords, 'Keywords');

    if (headlinesContext) sections.push(headlinesContext);
    if (descriptionsContext) sections.push(descriptionsContext);
    if (calloutsContext) sections.push(calloutsContext);
    if (keywordsContext) sections.push(keywordsContext);

    if (state.structuredSnippets) {
        const { category, details } = state.structuredSnippets;
        const lockedDetails = details?.filter(d => d.locked) || [];
        const rejectedDetails = details?.filter(d => d.rejected) || [];
        
        if (category || lockedDetails.length || rejectedDetails.length) {
            const snippetLines: string[] = [];
            if (category) {
                snippetLines.push(`  Snippet Category: "${category}"`);
            }
            if (lockedDetails.length) {
                snippetLines.push(`  Approved Snippet Details:`);
                lockedDetails.forEach(d => snippetLines.push(`    - "${d.text}"`));
            }
            if (rejectedDetails.length) {
                snippetLines.push(`  Rejected Snippet Details (avoid similar):`);
                rejectedDetails.forEach(d => snippetLines.push(`    - "${d.text}"`));
            }
            sections.push(snippetLines.join('\n'));
        }
    }

    return sections;
}

const formatAssetList = (assets: Ads.Asset[] | undefined, label: string): string | null => {
    if (!assets?.length) return null;
    
    const locked = assets.filter(a => a.locked);
    const rejected = assets.filter(a => a.rejected);
    
    if (!locked.length && !rejected.length) return null;

    const lines: string[] = [];
    if (locked.length) {
        lines.push(`  Approved ${label}:`);
        locked.forEach(a => lines.push(`    - "${a.text}"`));
    }
    if (rejected.length) {
        lines.push(`  Rejected ${label} (avoid similar):`);
        rejected.forEach(a => lines.push(`    - "${a.text}"`));
    }
    return lines.join('\n');
};
