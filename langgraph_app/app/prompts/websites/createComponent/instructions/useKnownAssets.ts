import { renderPrompt } from '@prompts';

export const useKnownAssetsPrompt = async (): Promise<string> => {
    return renderPrompt(`
        For visual elements, ONLY use Lucide icons from lucide-react that you know exist, OR stock photos from unsplash whose valid URLs you know exist. Do not download the images, only link to them in image tags.
        DO NOT suggest images or animations that do not exist. We do not have the resources to create them.
    `)
}