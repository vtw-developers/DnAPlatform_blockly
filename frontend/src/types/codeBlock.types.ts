export interface CodeBlock {
  id: string;
  title: string;
  description: string;
  code: string;
  userId: number;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
} 