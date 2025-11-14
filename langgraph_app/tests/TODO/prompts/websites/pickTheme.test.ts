// import { describe, it, expect, vi } from 'vitest';
// import { pickThemePrompt } from '@prompts';
// import { HumanMessage } from '@langchain/core/messages';
// import { themeFactory } from '@factories';

// describe.sequential('pickTheme Prompt', () => {
//   it('should render pick theme prompt with mocked theme service', async () => {
//     const userRequest = new HumanMessage("Create an incredible website");
    
//     // Create mock theme data using our factories
//     const mockThemeLabels = ['Modern', 'Minimal', 'Tech', 'Professional', 'Business'];
    
//     // Create themes using the factory
//     const theme1 = await themeFactory.create({ 
//       name: 'Ultra Modern',
//       labels: ['Modern', 'Minimal', 'Tech'] 
//     });
//     const theme2 = await themeFactory.create({ 
//       name: 'Corporate Professional',
//       labels: ['Professional', 'Business', 'Classic'] 
//     });
//     const theme3 = await themeFactory.create({ 
//       name: 'Tech Startup',
//       labels: ['Tech', 'Modern', 'Bold'] 
//     });
    
//     const mockThemes = [theme1, theme2, theme3];
    
//     const mockThemeService = {
//       getAllThemeLabels: vi.fn().mockResolvedValue(mockThemeLabels),
//       searchThemesByLabels: vi.fn().mockResolvedValue(mockThemes)
//     };
    
//     // Pass the mock service directly to the prompt
//     const result = await pickThemePrompt({
//       userRequest,
//       themeService: mockThemeService as any
//     });

//     expect(result).toMatchXml(`
//       <available-theme-labels>
//         ${mockThemeLabels.join(', ')}
//       </available-theme-labels>
//     `);

//     expect(result).toMatchXml(`
//       <user-request>
//         ${userRequest.content}
//       </user-request>
//     `);
    
//     // Verify the mock was called
//     expect(mockThemeService.getAllThemeLabels).toHaveBeenCalled();
//   });
  
//   it('should work with specific theme collections', async () => {
//     const userRequest = new HumanMessage("Build me a dark themed website");
    
//     // Use specific labels for testing
//     const specificLabels = ['Dark', 'Light', 'Colorful', 'Monochrome'];
    
//     // Create themes using the factory
//     const darkTheme = await themeFactory.create({
//       name: 'Midnight Dark',
//       labels: ['Dark', 'Modern']
//     });
//     const lightTheme = await themeFactory.create({
//       name: 'Pure Light',
//       labels: ['Light', 'Minimal']
//     });
    
//     const specificThemes = [darkTheme, lightTheme];
    
//     const mockThemeService = {
//       getAllThemeLabels: vi.fn().mockResolvedValue(specificLabels),
//       searchThemesByLabels: vi.fn().mockResolvedValue(specificThemes)
//     };
    
//     const result = await pickThemePrompt({
//       userRequest,
//       themeService: mockThemeService as any
//     });
    
//     expect(result).toMatchXml(`
//       <available-theme-labels>
//         ${specificLabels.join(', ')}
//       </available-theme-labels>
//     `);
    
//     expect(result).toMatchXml(`
//       <user-request>
//         ${userRequest.content}
//       </user-request>
//     `);
    
//     // Verify the mock was called
//     expect(mockThemeService.getAllThemeLabels).toHaveBeenCalled();
//   });

// });