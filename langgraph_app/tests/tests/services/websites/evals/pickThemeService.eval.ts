import { evalite } from 'evalite';
import { HumanMessage } from '@langchain/core/messages';
import { testGraph } from '@support';
import { routerGraph } from '@graphs';
import { databaseSnapshotter, SearchThemesService, type PickThemeOutputType, type PickThemeProps } from '@services'
import { vi } from 'vitest';

evalite('PickThemeService', {
  data: async() => {
    return [{
      input: {
        userRequest: new HumanMessage("Make a website that sells very cool dogs called Cool Dog"),
      }
    }]
  },
  task: async (input: PickThemeProps) => {
    vi.resetModules();

    await databaseSnapshotter.restoreSnapshot('basic_account');
    
    const result = await testGraph()
        .withGraph(routerGraph)
        .withPrompt("Create a cool website about dogs with animations")
        .withServiceSpy(['PickThemeService'])
        .stopAfter('pickTheme')
        .execute();

    // Lets us spy on the outputs of individual services
    const pickThemeOutputs = result.serviceSpy?.get("PickThemeService")?.[0] as PickThemeOutputType;

    return pickThemeOutputs;
  },
  scorers: [{
    name: "Returns a valid theme",
    scorer: async ({output}: {output: PickThemeOutputType}) => {
      const outputTheme = output.theme;
      const theme = await new SearchThemesService().findThemeById(outputTheme.id);
      return theme ? 1 : 0;
    }
  }]
});