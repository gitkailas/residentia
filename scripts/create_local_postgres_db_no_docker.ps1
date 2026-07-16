# Create a local PostgreSQL database for Residentia without using Docker.
# Requires a PostgreSQL server already installed and running locally.
# If this is not installed, install PostgreSQL for Windows and ensure the `psql` CLI is available.

$databaseName = 'residentia'
$dbUser = 'residentia_user'
$dbPassword = 'ResidentiaPass123!'
$port = 5432

function Write-Info($message) {
    Write-Host $message -ForegroundColor Cyan
}

function Write-ErrorAndExit($message) {
    Write-Host $message -ForegroundColor Red
    exit 1
}

function Find-PsqlPath {
    $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCommand) {
        return $psqlCommand.Source
    }

    $locations = @(
        'C:\Program Files\PostgreSQL',
        'C:\Program Files (x86)\PostgreSQL',
        'C:\Program Files\pgAdmin 4'
    )

    foreach ($location in $locations) {
        if (Test-Path $location) {
            $found = Get-ChildItem -Path $location -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                return $found.FullName
            }
        }
    }

    return $null
}

$psqlPath = Find-PsqlPath
if (-not $psqlPath) {
    Write-ErrorAndExit "psql not found. Install PostgreSQL and ensure the psql CLI is available."
}

Write-Info "Using native Postgres CLI at: $psqlPath"

$postgresPassword = Read-Host -AsSecureString 'Enter the local postgres superuser password'
if (-not $postgresPassword) {
    Write-ErrorAndExit 'Postgres password is required to run this script.'
}

$unsecurePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword))
$env:PGPASSWORD = $unsecurePassword

$createUserSql = @"
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$dbUser') THEN
      CREATE ROLE $dbUser WITH LOGIN PASSWORD '$dbPassword';
   END IF;
END
$do$;
"@

$createDbSql = @"
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$databaseName') THEN
      CREATE DATABASE $databaseName OWNER $dbUser;
   END IF;
END
$do$;
"@

$grantSql = "GRANT ALL PRIVILEGES ON DATABASE $databaseName TO $dbUser;"

$script = "$createUserSql`n$createDbSql`n$grantSql"

$tempFile = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tempFile -Value $script -Encoding ASCII

& $psqlPath -U postgres -h localhost -p $port -d postgres -v ON_ERROR_STOP=1 -f $tempFile
if ($LASTEXITCODE -ne 0) {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Write-ErrorAndExit "Failed to create database and user. Check the Postgres password, service status, and port settings."
}

Remove-Item $tempFile -ErrorAction SilentlyContinue
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Info "Created or verified database '$databaseName' and user '$dbUser'."
Write-Info "Connection string: postgres://${dbUser}:${dbPassword}@localhost:${port}/${databaseName}"
Write-Info "Set DATABASE_URL in your .env or environment to use this local database."
