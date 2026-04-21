// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Sonar Supabase project
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure to set them in your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generic function to fetch user-specific data
export const fetchUserTable = async (tableName) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error fetching user:', userError);
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', user.id); // Assuming 'id' is the primary key for the users table

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
  }
  
  return { data, error };
};

// Specific function to fetch user's plan and plan_change_popup status
export const fetchUserPlanAndPopupStatus = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error fetching user:', userError);
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('plan, plan_change_popup, identity_questions')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user plan and popup status:', error);
  }
  
  return { data, error };
};

export const fetchUserBreezyIntroStatusAndFirstName = async () => {
  console.log('fetchUserBreezyIntroStatusAndFirstName called.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error fetching user (in fetchUserBreezyIntroStatusAndFirstName):', userError);
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('first_name, breezy_intro_popup')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user breezy intro status and first name:', error);
  }
  console.log('fetchUserBreezyIntroStatusAndFirstName returned:', { data, error });
  return { data, error };
};

// Specific function to fetch user's swiper popup status
export const fetchUserSwiperPopupStatus = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error fetching user for swiper popup status:', userError);
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .select('popup_swiper')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user swiper popup status:', error);
  }
  return { data, error };
};

// Specific function to update user's swiper popup status
export const updateUserSwiperPopupStatus = async (status) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error fetching user for swiper popup update:', userError);
    return { data: null, error: userError || new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ popup_swiper: status })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user swiper popup status:', error);
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
    console.error(`Error updating ${tableName}:`, error);
  }

  return { data, error };
};

// Generic function to create a record in a table
export const createTableRecord = async (tableName, record) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error('Error fetching user:', userError);
        return { data: null, error: userError || new Error('User not found') };
    }

    const recordWithUser = { ...record, user: user.id };

    const { data, error } = await supabase
        .from(tableName)
        .insert([recordWithUser])
        .select()
        .single();

    if (error) {
        console.error(`Error creating record in ${tableName}:`, error);
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
        console.error(`Error deleting record from ${tableName}:`, error);
    }

    return { error };
};

// Specific function for fetching leads with related data
export const fetchLeadsWithDetails = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error('Error fetching user:', userError);
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
        console.error('Error fetching leads with details:', error);
    }

    return { data, error };
};

// Generic function to fetch all records from a table
export const fetchAllFromTable = async (tableName, columns = '*') => {
  const { data, error } = await supabase
    .from(tableName)
    .select(columns);

  if (error) {
    console.error(`Error fetching all from ${tableName}:`, error);
  }
  
  return { data, error };
};