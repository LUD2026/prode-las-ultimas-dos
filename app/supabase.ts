import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jipgvqshvrloiauhjpig.supabase.co'
const supabaseKey = 'sb_publishable_4w5F0JSPyK7Sm1jq6EZS8Q_DN4Hk8qs'

export const supabase = createClient(supabaseUrl, supabaseKey)