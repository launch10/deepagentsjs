import { expect } from 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> {
    toEqualXml(expected: string): T;
    toMatchXml(expected: string): T;
  }
  interface AsymmetricMatchersContaining {
    toEqualXml(expected: string): any;
    toMatchXml(expected: string): any;
  }
}

export class XmlTestHelper {
  private results: Array<{ 
    description: string; 
    passed: boolean; 
    expected: string;
    actual?: string;
    actualSnippet?: string;
  }> = [];
  
  constructor(private actualXml: string) {}
  
  private findSimilarSection(expected: string, actual: string): string | null {
    // Try to find the most similar section in the actual XML
    const expectedLines = expected.trim().split('\n').filter(line => line.trim());
    if (expectedLines.length === 0) return null;
    
    // Get the first meaningful line (usually an opening tag)
    const firstLine = (expectedLines[0] || '').trim();
    const tagMatch = firstLine.match(/<([\w-]+)[^>]*>/);
    if (!tagMatch) return null;
    
    const tagName = tagMatch[1];
    
    // Find all occurrences of the exact opening tag (not partial matches)
    const openTagPattern = new RegExp(`<${tagName}(?:[\\s>]|$)`, 'g');
    const matches = [...actual.matchAll(openTagPattern)];
    
    if (matches.length === 0) return null;
    
    // For each match, extract the section
    for (const match of matches) {
      const startIndex = match.index!;
      let depth = 1;
      let currentIndex = startIndex + match[0].length;
      let endIndex = -1;
      
      // Find the matching closing tag
      while (currentIndex < actual.length && depth > 0) {
        // Look for exact tag matches (not partial)
        const openPattern = `<${tagName}(?:[\\s>]|$)`;
        const closePattern = `</${tagName}>`;
        
        const remainingText = actual.substring(currentIndex);
        const nextOpenMatch = remainingText.match(openPattern);
        const nextCloseMatch = remainingText.match(closePattern);
        
        if (!nextCloseMatch) break;
        
        const nextCloseIndex = currentIndex + nextCloseMatch.index!;
        
        // Check if we have another opening tag before the closing tag
        if (nextOpenMatch && currentIndex + nextOpenMatch.index! < nextCloseIndex) {
          depth++;
          currentIndex = currentIndex + nextOpenMatch.index! + nextOpenMatch[0].length;
          continue;
        }
        
        depth--;
        if (depth === 0) {
          endIndex = nextCloseIndex + closePattern.length;
          break;
        }
        currentIndex = nextCloseIndex + closePattern.length;
      }
      
      if (endIndex > startIndex) {
        const section = actual.substring(startIndex, endIndex);
        return section;
      }
    }
    
    return null;
  }
  
  expectSection(description: string, expectedXml: string): this {
    const normalizedActual = normalizeXml(this.actualXml);
    const normalizedExpected = normalizeXml(expectedXml);
    
    // First check if it's an XML tag-based expectation or plain text
    const hasXmlTags = /<[^>]+>/.test(expectedXml);
    
    let passed: boolean;
    let actualSnippet: string | undefined;
    
    if (hasXmlTags) {
      // For XML content, use the existing include check
      passed = normalizedActual.includes(normalizedExpected);
      
      if (!passed) {
        // Try to find a similar section to show what was actually there
        const similar = this.findSimilarSection(expectedXml, this.actualXml);
        if (similar) {
          actualSnippet = similar;
        }
      }
    } else {
      // For plain text, be more careful about context
      // Try to find the text in a meaningful context (not inside other unrelated tags)
      const searchText = normalizedExpected.toLowerCase();
      const actualLower = normalizedActual.toLowerCase();
      
      // Check if the text exists at all
      passed = actualLower.includes(searchText);
      
      if (!passed) {
        // Look for partial matches to provide better error messages
        const words = searchText.split(/\s+/).filter(w => w.length > 3);
        for (const word of words) {
          const wordIndex = actualLower.indexOf(word);
          if (wordIndex !== -1) {
            // Found at least one word, extract surrounding context
            const contextStart = Math.max(0, wordIndex - 100);
            const contextEnd = Math.min(this.actualXml.length, wordIndex + 200);
            actualSnippet = this.actualXml.substring(contextStart, contextEnd);
            break;
          }
        }
        
        if (!actualSnippet) {
          // No partial match found, show the beginning of the document
          actualSnippet = this.actualXml.substring(0, Math.min(300, this.actualXml.length));
        }
      }
    }
    
    this.results.push({ 
      description, 
      passed, 
      expected: expectedXml,
      actual: passed ? undefined : this.actualXml,
      actualSnippet
    });
    
    return this;
  }
  
  private formatSideBySide(expected: string, actual: string, description: string): string {
    const expectedLines = expected.trim().split('\n');
    const actualLines = actual ? actual.trim().split('\n') : ['(Section not found in XML)'];
    
    // Normalize indentation for both sides
    const normalizeIndent = (lines: string[]) => {
      const minIndent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^\s*/)?.[0].length || 0));
      return lines.map(l => l.substring(minIndent));
    };
    
    const normalizedExpected = normalizeIndent(expectedLines);
    const normalizedActual = normalizeIndent(actualLines);
    
    // Determine column width
    const maxExpectedLength = Math.max(...normalizedExpected.map(l => l.length), 20);
    const columnWidth = Math.min(maxExpectedLength + 5, 55);
    
    let output = `\n❌ ${description}\n`;
    output += '─'.repeat(columnWidth * 2 + 7) + '\n';
    output += 'EXPECTED'.padEnd(columnWidth) + ' │ ' + 'ACTUAL\n';
    output += '─'.repeat(columnWidth) + '─┼─' + '─'.repeat(columnWidth) + '\n';
    
    // Simple line-by-line comparison
    const maxLines = Math.max(normalizedExpected.length, normalizedActual.length);
    
    for (let i = 0; i < maxLines; i++) {
      const expectedLine = normalizedExpected[i] || '';
      const actualLine = normalizedActual[i] || '';
      
      // Truncate long lines
      const truncatedExpected = expectedLine.length > columnWidth - 2 
        ? expectedLine.substring(0, columnWidth - 5) + '...' 
        : expectedLine;
      const truncatedActual = actualLine.length > columnWidth - 2 
        ? actualLine.substring(0, columnWidth - 5) + '...' 
        : actualLine;
      
      // Mark differences
      const marker = expectedLine.trim() !== actualLine.trim() ? '≠' : ' ';
      
      output += truncatedExpected.padEnd(columnWidth) + marker + '│ ' + truncatedActual + '\n';
    }
    
    return output;
  }
  
  assertAll(): void {
    const failures = this.results.filter(r => !r.passed);
    
    if (failures.length > 0) {
      // Create side-by-side comparisons for failures
      const failureReports = failures.map(f => 
        this.formatSideBySide(f.expected, f.actualSnippet || '', f.description)
      );
      
      const successCount = this.results.filter(r => r.passed).length;
      const successNames = this.results.filter(r => r.passed).map(r => r.description).join(', ');
      
      throw new Error(
        `\n╔════════════════════════════════════════════════╗\n` +
        `║ XML Test Failed: ${failures.length}/${this.results.length} sections don't match     ║\n` +
        `╚════════════════════════════════════════════════╝\n` +
        failureReports.join('\n') +
        `\n\n✅ Passed (${successCount}): ${successNames}`
      );
    }
  }
}

export function xmlTest(actualXml: string): XmlTestHelper {
  return new XmlTestHelper(actualXml);
}

const normalizeXml = (str: string): string => {
  return str
    .replace(/>\s+</g, '><')           // Remove whitespace between tags
    .replace(/>\s+/g, '>')             // Remove whitespace after opening tags
    .replace(/\s+</g, '<')             // Remove whitespace before closing tags
    .replace(/\s+/g, ' ')              // Normalize remaining whitespace to single spaces
    .trim();
};

expect.extend({
  toEqualXml(received: string, expected: string) {
    const normalizedReceived = normalizeXml(received);
    const normalizedExpected = normalizeXml(expected);

    const pass = normalizedReceived === normalizedExpected;

    if (pass) {
      return {
        pass: true,
        message: () => `XML strings match (ignoring whitespace)`,
      };
    }

    return {
      pass: false,
      message: () =>
        `XML strings do not match (ignoring whitespace)\n\n` +
        `Expected (normalized):\n${normalizedExpected}\n\n` +
        `Received (normalized):\n${normalizedReceived}`,
    };
  },

  toMatchXml(received: string, expected: string) {
    const normalizedReceived = normalizeXml(received);
    const normalizedExpected = normalizeXml(expected);

    const pass = normalizedReceived.includes(normalizedExpected);

    if (pass) {
      return {
        pass: true,
        message: () => `XML substring found (ignoring whitespace)`,
      };
    }

    return {
      pass: false,
      message: () =>
        `XML substring not found (ignoring whitespace)\n\n` +
        `Expected substring (normalized):\n${normalizedExpected}\n\n` +
        `Received (normalized):\n${normalizedReceived}`,
    };
  },
});