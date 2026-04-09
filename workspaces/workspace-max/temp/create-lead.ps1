param(
    [string]$CompanyName,
    [string]$Website = "",
    [string]$Phone = "",
    [string]$Notes
)

$key = $env:SUPABASE_ANON_KEY
$url = $env:SUPABASE_URL

$headers = @{
    'apikey' = $key
    'Authorization' = "Bearer $key"
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}

$body = @{
    'company' = $CompanyName
    'website' = $Website
    'phone' = $Phone
    'industry' = 'Mechanics'
    'city' = 'Worcester'
    'state' = 'MA'
    'status' = 'analyzing'
    'notes' = $Notes
    'source' = 'Kickstarter Campaign'
    'created_by' = 'Yanna'
    'updated_by' = 'Yanna'
} | ConvertTo-Json -Depth 3

try {
    $r = Invoke-RestMethod -Uri "$url/rest/v1/leads" -Headers $headers -Method POST -Body $body
    $r | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Error creating lead: $_"
    $errBody = $_.ErrorDetails.Message
    if ($errBody) { Write-Error "Details: $errBody" }
    exit 1
}
