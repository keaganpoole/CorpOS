$lead = @{
    company = "Young's Garage"
    website = "https://youngsgarage.co"
    city = "Worcester"
    state = "MA"
    phone = "(508) 755-2385"
    page_quality_score = 5
    opportunity = @("No Website")
    discovery = "Website exists but only contains a title; no contact info, services, or functionality. Appears to be a placeholder."
    created_by = "Yanna"
    updated_by = "Yanna"
    industry = "Mechanics"
    status = "Aware"
    source = "Web Search"
}
$json = $lead | ConvertTo-Json -Depth 5
Write-Host $json