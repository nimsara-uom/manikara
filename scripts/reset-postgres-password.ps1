# Resets the local PostgreSQL 'postgres' password and points Manikara's .env at it.
# Run from an ADMINISTRATOR PowerShell:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\H P\manikara\scripts\reset-postgres-password.ps1"
#
# What it does:
#   1. Backs up pg_hba.conf and temporarily lets local connections in without a password
#   2. Sets a new random password for the 'postgres' user
#   3. Creates the 'manikara' database
#   4. Restores pg_hba.conf exactly as it was (always, even if a step fails)
#   5. Writes the new DATABASE_URL into Manikara's .env

$ErrorActionPreference = 'Stop'
$pgRoot  = 'C:\Program Files\PostgreSQL\18'
$service = 'postgresql-x64-18'
$hba     = Join-Path $pgRoot 'data\pg_hba.conf'
$psql    = Join-Path $pgRoot 'bin\psql.exe'
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'Please run this from PowerShell opened with "Run as administrator".' -ForegroundColor Red
  exit 1
}
foreach ($p in @($hba, $psql, $envFile)) {
  if (-not (Test-Path $p)) { Write-Host "Not found: $p" -ForegroundColor Red; exit 1 }
}

# Letters and digits only, so it is safe inside a URL without escaping
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })

$backup = "$hba.manikara-backup"
Copy-Item $hba $backup -Force
Write-Host 'Backed up pg_hba.conf'

try {
  # Temporarily trust local connections (localhost only, for a few seconds)
  $original = [IO.File]::ReadAllText($hba)
  $trusting = ($original -split "`n" | ForEach-Object {
    if ($_ -match '^\s*host\s+\S+\s+\S+\s+(127\.0\.0\.1/32|::1/128)\s+') { $_ -replace '(scram-sha-256|md5|password)\s*$', 'trust' } else { $_ }
  }) -join "`n"
  [IO.File]::WriteAllText($hba, $trusting)
  Restart-Service $service
  Start-Sleep -Seconds 3
  Write-Host 'PostgreSQL restarted in temporary local-trust mode'

  & $psql -h localhost -U postgres -d postgres -w -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '$password';" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not set the new password.' }
  Write-Host 'New password set for user postgres'

  $exists = & $psql -h localhost -U postgres -d postgres -w -tAc "SELECT 1 FROM pg_database WHERE datname = 'manikara';"
  if ("$exists".Trim() -ne '1') {
    & $psql -h localhost -U postgres -d postgres -w -v ON_ERROR_STOP=1 -c 'CREATE DATABASE manikara;' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the manikara database.' }
    Write-Host 'Created database manikara'
  } else {
    Write-Host 'Database manikara already exists'
  }
}
finally {
  Copy-Item $backup $hba -Force
  Restart-Service $service
  Write-Host 'Restored the original pg_hba.conf and restarted PostgreSQL (passwords required again)'
}

# Update .env (UTF-8 without BOM so every parser reads the first line correctly)
$url = "postgresql://postgres:$password@localhost:5432/manikara?schema=public"
$envText = [IO.File]::ReadAllText($envFile)
if ($envText -match '(?m)^DATABASE_URL=.*$') {
  $envText = [regex]::Replace($envText, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=`"$url`"")
} else {
  $envText = $envText.TrimEnd() + "`nDATABASE_URL=`"$url`"`n"
}
[IO.File]::WriteAllText($envFile, $envText, (New-Object Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Done. Manikara''s .env now has the new database password.' -ForegroundColor Green
Write-Host "New postgres password: $password" -ForegroundColor Yellow
Write-Host 'Write it down if you want to use pgAdmin; it is also saved in .env.'
