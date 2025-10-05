export function upsertArray<T>(
  array: T[], 
  item: T, 
  matchFn: (existing: T) => boolean
): T[] {
  const existingIndex = array.findIndex(matchFn);
  
  if (existingIndex >= 0) {
    // Update existing item
    array[existingIndex] = item;
  } else {
    // Insert new item
    array.push(item);
  }
  
  return array;
}

// Upsert by key property
export function upsertArrayByKey<T, K extends keyof T>(
  array: T[], 
  item: T, 
  key: K
): T[] {
  return upsertArray(array, item, existing => existing[key] === item[key]);
}