const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sont requis pour Supabase Storage.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
