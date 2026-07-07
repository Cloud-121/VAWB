export interface User {
  id: string;
  discord_id: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  bio: string | null;
}

export interface Relationship {
  id: number;
  user_id: string;
  from_id: string;
  to_id: string;
  type: 'parent' | 'child' | 'sibling' | 'spouse' | 'friend';
  label: string | null;
}

export interface TreeData {
  users: User[];
  relationships: Relationship[];
}

export interface MeResponse {
  user: User | undefined;
  isDemo: boolean;
}
