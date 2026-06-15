# Create or recreate a local PostgreSQL database for Residentia.
#
# Requirements:
# - Docker Desktop must be installed and running, or
# - PostgreSQL client tools (psql) must be installed and able to connect to a local server.

$databaseName = 'residentia'
$dbUser = 'residentia_user'
$dbPassword = 'ResidentiaPass123!'
$containerName = 'residentia-postgres'
$port = 5432

function Write-Info($message) {
    Write-Host $message -ForegroundColor Cyan
}

function Write-ErrorAndExit($message) {
    Write-Host $message -ForegroundColor Red
    exit 1
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Info "Docker is installed. Verifying daemon..."
    $dockerStatus = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorAndExit "Docker daemon is not running. Please start Docker Desktop and rerun this script."
    }

    if (docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$containerName$") {
        Write-Info "Removing existing container '$containerName'..."
        docker rm -f $containerName | Out-Null
    }

    Write-Info "Starting local PostgreSQL container '$containerName'..."
    docker run -d --name $containerName `
        -e POSTGRES_USER=$dbUser `
        -e POSTGRES_PASSWORD=$dbPassword `
        -e POSTGRES_DB=$databaseName `
        -p $port:5432 `
        postgres:16 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorAndExit "Failed to start PostgreSQL container."
    }

    Write-Info "PostgreSQL container started successfully."
    Write-Info "Connection string: postgres://$dbUser:$dbPassword@localhost:$port/$databaseName"
    Write-Info "The database is available once the container finishes initialization."
    exit 0
}

if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Info "psql is available. Attempting to create the database and user locally."

    $createSql = @"
CREATE USER $dbUser WITH PASSWORD '$dbPassword';
CREATE DATABASE $databaseName OWNER $dbUser;
GRANT ALL PRIVILEGES ON DATABASE $databaseName TO $dbUser;
"@

    $createSql | psql -v ON_ERROR_STOP=1 postgres
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorAndExit "Failed to create the database or user using psql."
    }

    Write-Info "PostgreSQL database and user created successfully."
    Write-Info "Connection string: postgres://$dbUser:$dbPassword@localhost:$port/$databaseName"
    exit 0
}

Write-ErrorAndExit "Neither Docker nor psql is available. Install Docker Desktop or PostgreSQL client tools and try again."
