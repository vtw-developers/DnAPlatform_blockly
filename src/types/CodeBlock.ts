export interface CodeBlock {
  id?: number;
  title: string;
  description: string;
  code: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCodeBlockDto {
  title: string;
  description: string;
  code: string;
} 