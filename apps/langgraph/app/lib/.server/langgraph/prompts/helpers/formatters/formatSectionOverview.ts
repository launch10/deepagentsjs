import { z } from 'zod';
import { type sectionOverviewSchema } from '@models/section';

// Helper to format section overview
export const formatSectionOverview = (overview: z.infer<typeof sectionOverviewSchema>) => {
    // Construct the string safely, handling potentially undefined fields
    let overviewString = "";
    overviewString += `  - Section Name: ${overview.name || 'N/A'}\n`;
    overviewString += `  - Section Type: ${overview.sectionType || 'N/A'}\n`;
    overviewString += `  - Belongs to Page: ${overview.page || 'N/A'}\n`;
    overviewString += `  - Primary Goal: ${overview.purpose || 'N/A'}\n`;
    overviewString += `  - Context: ${overview.context || 'N/A'}\n`;
    overviewString += `  - Background: ${overview.background || 'N/A'}\n`;
    overviewString += `  - Text color: Suggest a color that contrasts well with the background color, ideally a color from the global brand theme.\n`;
    overviewString += "";

    return overviewString;
}