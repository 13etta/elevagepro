const { createClient } = require('@supabase/supabase-js');

// Ces clés devront être ajoutées dans les variables d'environnement de Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;