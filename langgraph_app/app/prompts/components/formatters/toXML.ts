import stringify from 'fast-json-stable-stringify';
import { stripTimestamps } from './utils';
import { kebabCase } from "change-case";

interface toXMLProps {
  values: Record<string, any> | any[];
  tag?: string;
  itemTag?: string; // Only used when values is an array
  sortOption?: 'alphabetical' | 'none'; // Control sorting behavior, defaults to 'alphabetical'
}

const renderArrayAsXML = (items: any[], itemTag: string, sortOption: 'alphabetical' | 'none' = 'alphabetical'): string => {
  // Sort array items for deterministic output if sortOption is 'alphabetical'
  const sortedItems = sortOption === 'alphabetical' 
    ? [...items].sort((a, b) => {
        // Convert to string for comparison
        const aStr = typeof a === 'object' ? stringify(a) : String(a);
        const bStr = typeof b === 'object' ? stringify(b) : String(b);
        return aStr.localeCompare(bStr);
      })
    : items;
  
  const renderedItems = sortedItems.map((item) => {
    let content: string;
    if (typeof item === 'string') {
      content = item;
    } else if (typeof item === 'object' && item !== null) {
      if (Array.isArray(item)) {
        // Nested array - render recursively
        content = renderArrayAsXML(item, 'item', sortOption);
      } else {
        content = stringify(item);
      }
    } else {
      content = String(item);
    }

    if (itemTag === 'none') {
      return content;
    }
    
    return `
      <${itemTag}>
        ${content}
      </${itemTag}>
    `;
  }).join('');
  
  return renderedItems;
};

export const toXML = ({ values, tag, itemTag, sortOption = 'alphabetical' }: toXMLProps): string => {
  // Strip timestamps to ensure deterministic output
  const cleanedValues = stripTimestamps(values);
  
  // Handle direct array input
  if (Array.isArray(cleanedValues)) {
    // Use provided itemTag, or determine based on wrapper tag, or use default
    const finalItemTag = itemTag || (tag ? (tag.endsWith('s') ? tag.slice(0, -1) : `${tag}-item`) : 'item');
    const content = renderArrayAsXML(cleanedValues, finalItemTag, sortOption);
    
    // If tag is provided, wrap the array items
    if (tag) {
      return `<${tag}>${content}</${tag}>`;
    }
    return content;
  }
  
  // Handle object input (existing logic)
  const sortedKeys = sortOption === 'alphabetical' 
    ? Object.keys(cleanedValues).sort()
    : Object.keys(cleanedValues);
  
  const children = sortedKeys.map((key) => {
    const value = cleanedValues[key];
    if (value === undefined || value === null) return null;

    const kebabKey = kebabCase(key);
    let content: string;
    
    if (Array.isArray(value)) {
      // Handle arrays by rendering each item with an item tag
      // Use singular form of the key as the item tag
      const itemTag = kebabKey.endsWith('s') ? kebabKey.slice(0, -1) : `${kebabKey}-item`;
      content = renderArrayAsXML(value, itemTag, sortOption);
    } else if (typeof value === 'string') {
      content = value;
    } else if (typeof value === 'object') {
      content = stringify(value);
    } else {
      content = String(value);
    }
    
    return `
      <${kebabKey}>
        ${content}
      </${kebabKey}>
    `
  }).filter(Boolean);
  
  if (tag) {
    return `<${tag}>${children.join('')}</${tag}>`;
  }
  
  return children.join('');
};