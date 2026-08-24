// Kept in sync by hand with supabase/migrations/*.sql. Once a real project
// is linked, prefer regenerating instead:
//   supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      likes: {
        Row: {
          id: string;
          card_id: string;
          visitor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          visitor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          visitor_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
