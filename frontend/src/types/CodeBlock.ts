export interface CodeBlock {
  id: number;
  title: string;
  description: string;
  code: string;
  blockly_xml: string;
  user_id?: number;
  is_shared: boolean;
  user?: {
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateCodeBlockDto {
  title: string;
  description: string;
  code: string;
  blockly_xml: string;
} 