// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { clearLegacySensitiveStorage, clearTransient } from './lib/browserPrivacy';
import { auditedRead } from './lib/auditedRead';

// Sonar Supabase project
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or publishable key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.");
}

const client = createClient(supabaseUrl, supabaseAnonKey);
async function readRecords(table, body) {
  const {data} = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error('Authentication required');
  const base = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${base}/api/sonar/${table}/read`, {method:'POST',
    headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!response.ok) throw new Error('Record access failed');
  return response.json();
}
let workforceContext = null;
export function setWorkforceContext(value) {
  if (workforceContext?.actor_id !== value?.actor_id || workforceContext?.business_id !== value?.business_id) clearTransient();
  workforceContext = value || null;
  if (typeof window !== 'undefined') clearLegacySensitiveStorage(window.localStorage);
}
const businessOwnedTables = new Set(['businesses','people','appointments','services','scenarios','hired_receptionists','payments','invoices','account_settings','call_logs','nest','reviews','checkpoints']);
// Compatibility for existing owner-keyed screens. This is routing only: RLS and
// the API independently authorize membership. No frontend state grants access.
function businessQuery(query, table) {
  return new Proxy(query, { get(target, key) {
    const value = target[key];
    if (typeof value !== 'function') return value;
    return (...args) => {
      if (businessOwnedTables.has(table) && workforceContext) {
        if (key === 'eq' && args[0] === 'user_id' && String(args[1]) === workforceContext.actor_id) args[1] = workforceContext.owner_id;
        if (['insert','upsert'].includes(key) && args[0]) {
          const bind = row => row.user_id === workforceContext.actor_id ? {...row, user_id:workforceContext.owner_id} : row;
          args[0] = Array.isArray(args[0]) ? args[0].map(bind) : bind(args[0]);
        }
      }
      const result = value.apply(target,args);
      return result && typeof result === 'object' && typeof result.eq === 'function' ? businessQuery(result,table) : result;
    };
  }});
}
export const supabase = new Proxy(client, { get(target,key) {
  if (key === 'from') return table => {
    const source = target.from(table);
    if (['people','appointments'].includes(table)) {
      return businessQuery(new Proxy(source, {get(object, method) {
        if (method === 'select') return columns => auditedRead(table, columns, readRecords);
        const value = object[method];
        return typeof value === 'function' ? value.bind(object) : value;
      }}), table);
    }
    return businessQuery(source,table);
  };
  const value = target[key];
  return typeof value === 'function' ? value.bind(target) : value;
}});

// Generic function to fetch user-specific data
export const fetchUserTable = async (tableName) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("supabaseClient.js:event_45");
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', user.id); // Assuming 'id' is the primary key for the users table

  if (error) {
    console.error("supabaseClient.js:event_55");
  }
  
  return { data, error };
};

// Specific function to fetch user's plan and welcome popup status
export const fetchUserPlanAndPopupStatus = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("supabaseClient.js:event_65");
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('plan, popups, identity_questions')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("supabaseClient.js:event_76");
  }
  
  return { data, error };
};

export const fetchUserBreezyIntroStatusAndFirstName = async () => {
  console.log('fetchUserBreezyIntroStatusAndFirstName called.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("supabaseClient.js:event_86");
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('first_name, breezy_intro_popup')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("supabaseClient.js:event_97");
  }
  console.debug("supabaseClient.js:event_99");
  return { data, error };
};

// Specific function to fetch user's swiper popup status
export const fetchUserSwiperPopupStatus = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("supabaseClient.js:event_107");
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('popup_swiper')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("supabaseClient.js:event_118");
  }
  return { data, error };
};

// Specific function to update user's swiper popup status
export const updateUserSwiperPopupStatus = async (status) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("supabaseClient.js:event_127");
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ popup_swiper: status })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error("supabaseClient.js:event_139");
  }
  return { data, error };
};

// Generic function to update a record in a table
export const updateTableRecord = async (tableName, recordId, updates) => {
  const { data, error } = await supabase
    .from(tableName)
    .update(updates)
    .eq('id', recordId)
    .select()
    .single(); // .single() is crucial to get the updated record back

  if (error) {
    console.error("supabaseClient.js:event_154");
  }

  return { data, error };
};

// Generic function to create a record in a table
export const createTableRecord = async (tableName, record) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error("supabaseClient.js:event_164");
        return { data: null, error: userError || new Error('User not found') };
    }

    const recordWithUser = { ...record, user: user.id };

    const { data, error } = await supabase
        .from(tableName)
        .insert([recordWithUser])
        .select()
        .single();

    if (error) {
        console.error("supabaseClient.js:event_177");
    }

    return { data, error };
};

// Generic function to delete a record from a table
export const deleteTableRecord = async (tableName, recordId) => {
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId);

    if (error) {
        console.error("supabaseClient.js:event_191");
    }

    return { error };
};

// Specific function for fetching leads with related data
export const fetchLeadsWithDetails = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error("supabaseClient.js:event_201");
        return { data: null, error: userError || new Error('User not found') };
    }

    const { data, error } = await supabase
        .from('leads')
        .select(`
            *,
            campaigns:lead_campaigns(*,
                campaign:campaigns(name)
            ),
            purchases:purchases(*)
        `)
        .eq('user', user.id);

    if (error) {
        console.error("supabaseClient.js:event_217");
    }

    return { data, error };
};

// Generic function to fetch all records from a table
export const fetchAllFromTable = async (tableName, columns = '*') => {
  const { data, error } = await supabase
    .from(tableName)
    .select(columns);

  if (error) {
    console.error("supabaseClient.js:event_230");
  }
  
  return { data, error };
};
