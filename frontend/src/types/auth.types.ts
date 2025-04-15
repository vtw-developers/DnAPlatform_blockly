export interface User {
  id: number;
  email: string;
  name: string;
  organization?: string;
  role?: string;
  is_active?: boolean;
} 