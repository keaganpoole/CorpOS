param(
    [Parameter(Mandatory=$true)]
    [string]$DisplayName,

    [Parameter(Mandatory=$true)]
    [string]$RedirectUri,

    [string]$EnvPath = ".env",

    [ValidateSet("read-send", "readwrite-send")]
    [string]$PermissionSet = "read-send",

    [ValidateSet("AzureADandPersonalMicrosoftAccount", "AzureADMultipleOrgs", "AzureADMyOrg")]
    [string]$SignInAudience = "AzureADandPersonalMicrosoftAccount",

    [int]$SecretYears = 1
)

$ErrorActionPreference = "Stop"

function Assert-AzCli {
    $az = Get-Command az -ErrorAction SilentlyContinue
    if (-not $az) {
        throw "Azure CLI is not installed or not available on PATH. Install Azure CLI, run 'az login', then rerun this script."
    }

    $account = az account show 2>$null | ConvertFrom-Json
    if (-not $account) {
        throw "Azure CLI is not authenticated. Run 'az login' first."
    }
    return $account
}

function Get-GraphScopeId {
    param([string]$ScopeValue)

    $graphAppId = "00000003-0000-0000-c000-000000000000"
    $sp = az ad sp show --id $graphAppId | ConvertFrom-Json
    $scope = $sp.oauth2PermissionScopes | Where-Object { $_.value -eq $ScopeValue -and $_.isEnabled -eq $true } | Select-Object -First 1
    if (-not $scope) {
        throw "Could not find Microsoft Graph delegated scope '$ScopeValue'. Check Microsoft docs and Azure CLI access."
    }
    return $scope.id
}

function Add-OrReplaceEnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    if (-not (Test-Path $Path)) {
        New-Item -ItemType File -Path $Path -Force | Out-Null
    }

    $escaped = [regex]::Escape($Key)
    $line = "$Key=$Value"
    $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue

    if ($content -match "(?m)^$escaped=") {
        $content = [regex]::Replace($content, "(?m)^$escaped=.*$", $line)
        Set-Content -Path $Path -Value $content -NoNewline
    } else {
        Add-Content -Path $Path -Value $line
    }
}

$account = Assert-AzCli
$graphAppId = "00000003-0000-0000-c000-000000000000"

$scopeValues = @("User.Read", "Mail.Read", "Mail.Send")
$runtimeScopes = "openid profile email offline_access User.Read Mail.Read Mail.Send"

if ($PermissionSet -eq "readwrite-send") {
    $scopeValues = @("User.Read", "Mail.ReadWrite", "Mail.Send")
    $runtimeScopes = "openid profile email offline_access User.Read Mail.ReadWrite Mail.Send"
}

Write-Host "Creating Microsoft Entra app registration: $DisplayName"
$app = az ad app create `
    --display-name $DisplayName `
    --sign-in-audience $SignInAudience `
    --web-redirect-uris $RedirectUri | ConvertFrom-Json

$appId = $app.appId
Write-Host "App created: $appId"

foreach ($scopeValue in $scopeValues) {
    $scopeId = Get-GraphScopeId -ScopeValue $scopeValue
    Write-Host "Adding delegated Microsoft Graph permission: $scopeValue"
    az ad app permission add --id $appId --api $graphAppId --api-permissions "$scopeId=Scope" | Out-Null
}

Write-Host "Creating client secret..."
$secret = az ad app credential reset `
    --id $appId `
    --display-name "outlook-mail-secret" `
    --years $SecretYears | ConvertFrom-Json

if (-not $secret.password) {
    throw "Azure CLI did not return a client secret value."
}

$resolvedEnvPath = Resolve-Path -Path (Split-Path -Path $EnvPath -Parent) -ErrorAction SilentlyContinue
if (-not $resolvedEnvPath -and (Split-Path -Path $EnvPath -Parent)) {
    New-Item -ItemType Directory -Path (Split-Path -Path $EnvPath -Parent) -Force | Out-Null
}

Write-Host "Writing Outlook mail variables to $EnvPath"
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_CLIENT_ID" -Value $appId
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_CLIENT_SECRET" -Value $secret.password
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_TENANT_ID" -Value "common"
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_AUTHORITY" -Value "https://login.microsoftonline.com/common"
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_REDIRECT_URI" -Value $RedirectUri
Add-OrReplaceEnvValue -Path $EnvPath -Key "OUTLOOK_SCOPES" -Value $runtimeScopes
Add-OrReplaceEnvValue -Path $EnvPath -Key "MICROSOFT_GRAPH_BASE_URL" -Value "https://graph.microsoft.com/v1.0"

Write-Host "Done. Review API permissions in Microsoft Entra. Some tenants may require admin consent before users can authorize the app."
Write-Host "Client ID: $appId"
