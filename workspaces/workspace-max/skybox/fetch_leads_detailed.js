// Fetch leads from Supabase for CorpOS research campaign
const { createClient } = require('@supabase/supabase-js');

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

// Analyze leads
function analyzeLeads(leads) {
  const statusCounts = {};
  const sourceCounts = {};
  const opportunityCounts = {};
  const industryCounts = {};
  const scoreDistribution = { low: 0, medium: 0, high: 0 };
  
  leads.forEach(lead => {
    const status = lead.status || 'Unknown';
    const source = lead.source || 'Unknown';
    const opportunity = lead.opportunity || [];
    const industry = lead.industry || 'Unknown';
    const score = lead.page_quality_score || 0;
    
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    
    if (Array.isArray(opportunity)) {
      opportunity.forEach(opp => {
        opportunityCounts[opp] = (opportunityCounts[opp] || 0) + 1;
      });
    }
    
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
    
    if (score < 40) scoreDistribution.low++;
    else if (score < 70) scoreDistribution.medium++;
    else scoreDistribution.high++;
  });
  
  return {
    total: leads.length,
    statusCounts,
    sourceCounts,
    opportunityCounts,
    industryCounts,
    scoreDistribution,
  };
}

// Run the function
fetchLeads().then(leads => {
  if (leads) {
    const analysis = analyzeLeads(leads);
    console.log('Lead Analysis:');
    console.log('Total leads:', analysis.total);
    console.log('Status distribution:', analysis.statusCounts);
    console.log('Source distribution:', analysis.sourceCounts);
    console.log('Opportunity distribution:', analysis.opportunityCounts);
    console.log('Industry distribution:', analysis.industryCounts);
    console.log('Score distribution:', analysis.scoreDistribution);
    
    // Output leads for further processing
    console.log('\nFirst 5 leads:');
    leads.slice(0, 5).forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.company} (status: ${lead.status}, source: ${lead.source}, score: ${lead.page_quality_score})`);
    });
  }
});