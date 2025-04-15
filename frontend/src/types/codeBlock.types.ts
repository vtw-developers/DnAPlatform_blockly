export interface CodeBlock {
  id: string;
  title: string;
  description: string;
  code: string;
  user_id: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  blockly_xml?: string;
} 