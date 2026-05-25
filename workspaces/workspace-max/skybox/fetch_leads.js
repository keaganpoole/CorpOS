// Fetch leads from Supabase for CorpOS research campaign
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env file (assuming it's in skybox directory)
const supabaseUrl = 'https://jspksetkrprvomilgtyj.supabase.co';
const supabaseAnonKey = 'sb_publishable_LjxUo8j__ixUP6iWdf_DBQ_CMuSxAa3';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchLeads() {
  console.log('Fetching leads from Supabase...');
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('date_created', { ascending: false })
      .limit(100); // Adjust limit as needed

    if (error) {
      console.error('Error fetching leads:', error);
      return null;
    }

    console.log(`Fetched ${data.length} leads.`);
    return data;
  } catch (err) {
    console.error('Exception:', err);
    return null;
  }
}

// Run the function
fetchLeads().then(leads => {
  if (leads) {
    // Analyze leads: count by status, source, etc.
    const statusCounts = {};
    const sourceCounts = {};
    leads.forEach(lead => {
      const status = lead.status || 'Unknown';
      const source = lead.source || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    console.log('Lead Analysis:');
    console.log('Status distribution:', statusCounts);
    console.log('Source distribution:', sourceCounts);

    // Output leads for further processing
    console.log('First 5 leads:');
    leads.slice(0, 5).forEach(lead => {
      console.log(`- ${lead.company} (${lead.status}, ${lead.source})`);
    });
  }
});