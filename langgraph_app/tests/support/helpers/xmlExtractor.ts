/**
 * XML Extraction Helpers for Tests
 * 
 * Utilities to extract specific XML tags and their content from strings,
 * making it easier to assert against specific parts of XML output.
 */

interface ExtractOptions {
  /** Whether to include the tag itself in the extracted content */
  includeTag?: boolean;
  /** Whether to normalize whitespace in the extracted content */
  normalizeWhitespace?: boolean;
  /** Extract all occurrences of the tag (default: false - returns first match only) */
  all?: boolean;
}

/**
 * Extracts content from a specific XML tag
 * @param xml The XML string to extract from
 * @param tagName The name of the tag to extract
 * @param options Options for extraction
 * @returns The extracted content or null if not found
 */
export function extractXmlTag(
  xml: string,
  tagName: string,
  options: ExtractOptions = {}
): string | null {
  const {
    includeTag = true,
    normalizeWhitespace = true,
    all = false
  } = options;

  // Create regex pattern for the tag
  // This handles both self-closing tags and tags with content
  const selfClosingPattern = `<${tagName}(?:\\s+[^>]*)?\\s*/>`;
  const withContentPattern = `<${tagName}(?:\\s+[^>]*)?>(.*?)</${tagName}>`;
  const pattern = new RegExp(`(${selfClosingPattern}|${withContentPattern})`, 'gs');
  
  const matches = Array.from(xml.matchAll(pattern));
  
  if (matches.length === 0) {
    return null;
  }

  const processMatch = (match: RegExpMatchArray): string => {
    let result: string;
    
    if (includeTag) {
      result = match[0]; // Full match including tags
    } else {
      // Extract just the content (group 2 is the content from withContentPattern)
      result = match[2] || ''; // Empty string for self-closing tags
    }
    
    if (normalizeWhitespace) {
      result = result
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .replace(/\s+/g, ' ')    // Collapse multiple spaces to single space
        .trim();
    }
    
    return result;
  };

  if (all) {
    // Return all matches as a concatenated string
    return matches.map(processMatch).join('\n');
  } else {
    // Return first match only
    if (!matches[0]) {
      return null;
    }
    return processMatch(matches[0]);
  }
}

/**
 * Extracts multiple XML tags from a string
 * @param xml The XML string to extract from
 * @param tagNames Array of tag names to extract
 * @param options Options for extraction
 * @returns Object with tag names as keys and extracted content as values
 */
export function extractXmlTags(
  xml: string,
  tagNames: string[],
  options: ExtractOptions = {}
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  
  for (const tagName of tagNames) {
    result[tagName] = extractXmlTag(xml, tagName, options);
  }
  
  return result;
}

/**
 * Extracts nested XML structure preserving hierarchy
 * @param xml The XML string to extract from
 * @param path Dot-separated path to the nested tag (e.g., "component-overview.background-color")
 * @param options Options for extraction
 * @returns The extracted content or null if not found
 */
export function extractNestedXmlTag(
  xml: string,
  path: string,
  options: ExtractOptions = {}
): string | null {
  const tags = path.split('.');
  let currentContent = xml;
  
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    const isLastTag = i === tags.length - 1;
    
    // For all tags except the last, we want to include the tag to search within it
    const extracted = extractXmlTag(currentContent, tag, {
      ...options,
      includeTag: isLastTag ? options.includeTag : true
    });
    
    if (!extracted) {
      return null;
    }
    
    currentContent = extracted;
  }
  
  return currentContent;
}

/**
 * Parses XML content and returns it as a JavaScript object
 * Note: This is a simple parser for test purposes, not suitable for complex XML
 * @param xml The XML string to parse
 * @returns Parsed object representation
 */
export function parseSimpleXml(xml: string): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Remove XML declaration if present
  const cleanXml = xml.replace(/<\?xml[^>]*\?>/g, '').trim();
  
  // Function to parse XML recursively
  const parseXmlString = (xmlStr: string): Record<string, any> => {
    const obj: Record<string, any> = {};
    
    // Match all tags at the current level
    const tagRegex = /<([\w-]+)(?:\s+[^>]*)?>([^<]*(?:<(?!\/\1>).)*?)<\/\1>/gs;
    let match;
    
    while ((match = tagRegex.exec(xmlStr)) !== null) {
      const [, tagName, content] = match;
      if (!tagName || !content) {
        continue;
      }
      const trimmedContent = content.trim();
      
      // Check if content contains nested tags
      if (/<[\w-]+[^>]*>/.test(trimmedContent)) {
        // Recursively parse nested content
        obj[tagName] = parseXmlString(trimmedContent);
      } else {
        // Store the text content
        obj[tagName] = trimmedContent;
      }
    }
    
    return obj;
  };
  
  // If the XML starts with a root tag, parse it
  const rootMatch = cleanXml.match(/^<([\w-]+)(?:\s+[^>]*)?>(.+)<\/\1>$/s);
  if (rootMatch) {
    const [, rootTag, content] = rootMatch;
    if (!rootTag || !content) {
      return {};
    }
    result[rootTag] = parseXmlString(content);
  } else {
    // Parse without a root tag
    return parseXmlString(cleanXml);
  }
  
  return result;
}

/**
 * Asserts that an XML string contains specific tag with expected content
 * @param xml The XML string to check
 * @param tagName The tag to look for
 * @param expectedContent The expected content (can be string or regex)
 * @returns boolean indicating if the assertion passes
 */
export function xmlTagContains(
  xml: string,
  tagName: string,
  expectedContent: string | RegExp
): boolean {
  const extracted = extractXmlTag(xml, tagName, { includeTag: false });
  
  if (!extracted) {
    return false;
  }
  
  if (typeof expectedContent === 'string') {
    return extracted.includes(expectedContent);
  } else {
    return expectedContent.test(extracted);
  }
}

/**
 * Extracts all text content from XML, stripping all tags
 * @param xml The XML string
 * @returns Plain text content
 */
export function extractTextContent(xml: string): string {
  // First remove all tags
  let text = xml.replace(/<[^>]*>/g, ' ');
  // Then normalize whitespace while preserving word boundaries
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

/**
 * Extracts attributes from an XML tag
 * @param xml The XML string
 * @param tagName The tag name to extract attributes from
 * @returns Object with attribute names as keys and values
 */
export function extractXmlAttributes(
  xml: string,
  tagName: string
): Record<string, string> | null {
  const tagPattern = new RegExp(`<${tagName}([^>]*)>`, 's');
  const match = xml.match(tagPattern);
  
  if (!match || !match[1]) {
    return null;
  }
  
  const attributes: Record<string, string> = {};
  const attrPattern = /(\w+)=["']([^"']*)["']/g;
  let attrMatch;
  
  while ((attrMatch = attrPattern.exec(match[1])) !== null) {
    if (!attrMatch[1] || !attrMatch[2]) {
      continue;
    }
    attributes[attrMatch[1]] = attrMatch[2];
  }
  
  return Object.keys(attributes).length > 0 ? attributes : null;
}