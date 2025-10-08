import { z } from 'zod';

interface FormatParser {
  canParse(content: string): boolean;
  parse(content: string): unknown;
}

class JsonParser implements FormatParser {
  canParse(content: string): boolean {
    const trimmed = content.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }
  
  parse(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

class XmlParser implements FormatParser {
  canParse(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('<') && trimmed.includes('</');
  }
  
  parse(content: string): unknown {
    const result: Record<string, any> = {};
    
    const elementRegex = /<(\w+)(?:\s[^>]*)?>([^<]*(?:<(?!\1)[^<]*)*)<\/\1>/g;
    let match;
    
    while ((match = elementRegex.exec(content)) !== null) {
      const [, tagName, value] = match;
      const trimmedValue = value.trim();
      
      if (!result[tagName]) {
        result[tagName] = [];
      }
      
      if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
        try {
          result[tagName].push(JSON.parse(trimmedValue));
        } catch {
          result[tagName].push(trimmedValue);
        }
      } else {
        result[tagName].push(trimmedValue);
      }
    }
    
    Object.keys(result).forEach(key => {
      if (result[key].length === 1) {
        result[key] = result[key][0];
      }
    });
    
    return result;
  }
}

class PipeParser implements FormatParser {
  canParse(content: string): boolean {
    const lines = content.trim().split('\n');
    return lines.length > 1 && lines[0].includes('|');
  }
  
  parse(content: string): unknown {
    const lines = content.trim().split('\n');
    const headers = lines[0].split('|').map(h => h.trim());
    
    const rows = lines.slice(1).map(line => {
      const values = line.split('|').map(v => v.trim());
      const obj: Record<string, any> = {};
      
      headers.forEach((header, i) => {
        const value = values[i] || '';
        
        if (!isNaN(Number(value)) && value !== '') {
          obj[header] = Number(value);
        } else if (value.startsWith('{') || value.startsWith('[')) {
          try {
            obj[header] = JSON.parse(value);
          } catch {
            obj[header] = value;
          }
        } else if (value === 'null') {
          obj[header] = null;
        } else if (value === '' || value === 'undefined') {
          obj[header] = undefined;
        } else {
          obj[header] = value;
        }
      });
      
      return obj;
    });
    
    return rows;
  }
}

class FormatDetector {
  private parsers: FormatParser[] = [
    new JsonParser(),
    new PipeParser(),
    new XmlParser()
  ];
  
  parse(content: string): unknown {
    for (const parser of this.parsers) {
      if (parser.canParse(content)) {
        return parser.parse(content);
      }
    }
    
    throw new Error(
      `Could not detect format for content:\n${content.slice(0, 100)}...`
    );
  }
}

class SectionAssertion<T = unknown> {
  private content: string;
  private detector = new FormatDetector();
  
  constructor(private prompt: string, private sectionName: string) {
    this.content = this.extractSection(sectionName);
  }
  
  toMatchContract<S>(contract: z.ZodSchema<S>): S {
    let parsed: unknown;
    
    try {
      parsed = this.detector.parse(this.content);
    } catch (e) {
      throw new Error(
        `Failed to parse section '${this.sectionName}': ${e instanceof Error ? e.message : String(e)}\n` +
        `Content: ${this.content.slice(0, 200)}...`
      );
    }
    
    const result = contract.safeParse(parsed);
    
    if (!result.success) {
      const errors = result.error.issues.map(issue => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      throw new Error(
        `Section '${this.sectionName}' failed contract validation:\n${errors}\n\n` +
        `Parsed data: ${JSON.stringify(parsed, null, 2)}`
      );
    }
    
    return result.data;
  }
  
  toHaveNoNulls(allowedPaths: string[] = []): this {
    const parsed = this.detector.parse(this.content);
    const nulls = this.findNullsAndUndefineds(parsed);
    
    const disallowed = nulls.filter(path => 
      !allowedPaths.some(allowed => path.startsWith(allowed))
    );
    
    if (disallowed.length > 0) {
      throw new Error(
        `Section '${this.sectionName}' has unexpected nulls/undefined at:\n` +
        disallowed.map(p => `  - ${p}`).join('\n')
      );
    }
    
    return this;
  }
  
  toBeValidFormat(): this {
    try {
      this.detector.parse(this.content);
    } catch (e) {
      throw new Error(
        `Section '${this.sectionName}' is not in a valid format: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    
    return this;
  }
  
  private extractSection(name: string): string {
    const regex = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
    const match = this.prompt.match(regex);
    
    if (!match) {
      throw new Error(
        `Section '${name}' not found in prompt.\n` +
        `Available sections: ${this.findAvailableSections().join(', ')}`
      );
    }
    
    return match[1].trim();
  }
  
  private findAvailableSections(): string[] {
    const regex = /<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
    const sections = new Set<string>();
    let match;
    
    while ((match = regex.exec(this.prompt)) !== null) {
      sections.add(match[1]);
    }
    
    return Array.from(sections);
  }
  
  private findNullsAndUndefineds(obj: any, path = ''): string[] {
    const issues: string[] = [];
    
    if (obj === null || obj === undefined) {
      issues.push(path);
      return issues;
    }
    
    if (typeof obj === 'string' && (obj === 'null' || obj === 'undefined')) {
      issues.push(`${path} (string value "${obj}")`);
    }
    
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key;
        
        if (value === null || value === undefined) {
          issues.push(newPath);
        } else if (typeof value === 'object') {
          issues.push(...this.findNullsAndUndefineds(value, newPath));
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const newPath = `${path}[${index}]`;
        if (item === null || item === undefined) {
          issues.push(newPath);
        } else if (typeof item === 'object') {
          issues.push(...this.findNullsAndUndefineds(item, newPath));
        }
      });
    }
    
    return issues;
  }
}

export function expectSection(prompt: string, sectionName: string) {
  return new SectionAssertion(prompt, sectionName);
}

export function expectPromptHasSections(prompt: string, ...sections: string[]): void {
  const missing: string[] = [];
  
  for (const section of sections) {
    const regex = new RegExp(`<${section}[^>]*>[\\s\\S]*?</${section}>`, 'i');
    if (!regex.test(prompt)) {
      missing.push(section);
    }
  }
  
  if (missing.length > 0) {
    const available = prompt.match(/<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi)
      ?.map(tag => tag.match(/<(\w+)/)?.[1])
      .filter(Boolean) || [];
    
    throw new Error(
      `Missing required sections: ${missing.join(', ')}\n` +
      `Available sections: ${available.join(', ')}`
    );
  }
}

export function expectNoStringifiedNulls(prompt: string): void {
  const issues: string[] = [];
  
  const patterns = [
    { pattern: /[^a-zA-Z]undefined[^a-zA-Z]/g, description: 'string "undefined"' },
    { pattern: /:\s*"null"/g, description: 'string "null" as value' },
    { pattern: /\{\s*\}/g, description: 'empty object {}' },
    { pattern: /null\./g, description: 'null.property access' },
    { pattern: /undefined\./g, description: 'undefined.property access' },
    { pattern: /\[object Object\]/g, description: '[object Object]' },
  ];
  
  for (const { pattern, description } of patterns) {
    if (pattern.test(prompt)) {
      issues.push(description);
    }
  }
  
  if (issues.length > 0) {
    throw new Error(
      `Found stringified nulls/undefined in prompt:\n` +
      issues.map(i => `  - ${i}`).join('\n')
    );
  }
}
