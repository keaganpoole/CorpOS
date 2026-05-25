$headers = @{ 'apikey' = $env:SUPABASE_ANON_KEY; 'Authorization' = 'Bearer ' + $env:SUPABASE_ANON_KEY }
$r = Invoke-RestMethod -Uri 'https://jspksetkrprvomilgtyj.supabase.co/rest/v1/research_campaigns?select=*&Status=eq.Active' -Headers $headers
$r | ConvertTo-Json -Depth 5