import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Required so modules that import supabase (via env.ts) can load under vitest.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
