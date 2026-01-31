export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  subcategory: string | null;
  slug: string;
}
