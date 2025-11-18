import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchThemesService, type ThemeResult } from '@services';

describe('SearchThemesService', () => {
  let service: SearchThemesService;
  let mockService: SearchThemesService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      selectDistinct: vi.fn(),
      from: vi.fn(),
      orderBy: vi.fn(),
      select: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      leftJoin: vi.fn(),
    };
    mockService = new SearchThemesService(mockDb);
    service = new SearchThemesService();
  });

  describe('getAllThemeLabels', () => {
    it('should fetch all unique theme labels', async () => {
      const result = await service.getAllThemeLabels();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual('autumn')
    });

    it('should return empty array when no labels exist', async () => {
      mockDb.selectDistinct.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.orderBy.mockResolvedValue([]);

      const result = await mockService.getAllThemeLabels();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.selectDistinct.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.orderBy.mockRejectedValue(new Error('Database error'));

      await expect(mockService.getAllThemeLabels()).rejects.toThrow('Failed to fetch theme labels');
    });
  });

  describe('searchThemesByLabels', () => {
    it('should search themes by labels and return results', async () => {
      const result = await service.searchThemesByLabels(['modern'], 50);

      expect(result.length).toBeGreaterThan(1);
      const theme = result.sort((a, b) => b.name.localeCompare(a.name))[0]
      expect(theme.name).toEqual("theme 97")
      expect(theme.labels).toContain('modern')
      const themeTheme = {
        '--card': 'hsl(0, 0%, 100%)',
        '--ring': 'hsl(199, 27%, 18%)',
        '--input': 'hsl(210, 9%, 96%)',
        '--muted': 'hsl(0, 0%, 69%)',
        '--accent': 'hsl(33, 20%, 31%)',
        '--border': 'hsl(210, 9%, 96%)',
        '--popover': 'hsl(0, 0%, 100%)',
        '--primary': 'hsl(199, 27%, 18%)',
        '--success': 'hsl(152, 69%, 31%)',
        '--warning': 'hsl(30, 11%, 4%)',
        '--neutral-1': 'hsl(210, 6%, 94%)',
        '--neutral-2': 'hsl(210, 4%, 89%)',
        '--neutral-3': 'hsl(210, 3%, 85%)',
        '--secondary': 'hsl(31, 33%, 88%)',
        '--background': 'hsl(210, 17%, 98%)',
        '--card-foreground': 'hsl(0, 0%, 4%)',
        '--ring-foreground': 'hsl(0, 0%, 98%)',
        '--muted-foreground': 'hsl(0, 0%, 98%)',
        '--accent-foreground': 'hsl(0, 0%, 98%)',
        '--popover-foreground': 'hsl(0, 0%, 4%)',
        '--primary-foreground': 'hsl(0, 0%, 98%)',
        '--success-foreground': 'hsl(0, 0%, 98%)',
        '--warning-foreground': 'hsl(0, 0%, 98%)',
        '--secondary-foreground': 'hsl(0, 0%, 4%)',
        '--background-foreground': 'hsl(0, 0%, 4%)',
        '--card-foreground-muted': 'hsl(0, 0%, 28%)',
        '--destructive': 'hsl(354, 70%, 54%)',
        '--ring-foreground-muted': 'hsl(200, 5%, 78%)',
        '--destructive-foreground': 'hsl(0, 0%, 98%)',
        '--muted-foreground-muted': 'hsl(0, 0%, 94%)',
        '--accent-foreground-muted': 'hsl(38, 8%, 81%)',
        '--popover-foreground-muted': 'hsl(0, 0%, 28%)',
        '--primary-foreground-muted': 'hsl(200, 5%, 78%)',
        '--success-foreground-muted': 'hsl(153, 28%, 81%)',
        '--warning-foreground-muted': 'hsl(0, 0%, 75%)',
        '--secondary-foreground-muted': 'hsl(36, 4%, 25%)',
        '--background-foreground-muted': 'hsl(0, 0%, 27%)',
        '--destructive-foreground-muted': 'hsl(354, 64%, 87%)'
      }
      expect(theme.theme).toEqual(themeTheme)
    });
  });
});