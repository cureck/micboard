# Test API endpoints for debugging service type 769651

Write-Host "Testing PCO API endpoints..." -ForegroundColor Green

# Test 1: Get integrations config
Write-Host "`n1. Getting integrations config..." -ForegroundColor Yellow
try {
    $integrations = Invoke-RestMethod -Uri "http://localhost:8058/api/integrations" -Method Get
    Write-Host "Service types configured:" -ForegroundColor Cyan
    if ($integrations.planning_center.service_types) {
        foreach ($st in $integrations.planning_center.service_types) {
            Write-Host "  - ID: $($st.id), Teams: $($st.teams.Count)" -ForegroundColor White
        }
    } else {
        Write-Host "  No service types found" -ForegroundColor Red
    }
} catch {
    Write-Host "Error getting integrations: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Get all service types from PCO
Write-Host "`n2. Getting all service types from PCO..." -ForegroundColor Yellow
try {
    $serviceTypes = Invoke-RestMethod -Uri "http://localhost:8058/api/pco/service-types" -Method Get
    Write-Host "Available service types:" -ForegroundColor Cyan
    foreach ($st in $serviceTypes) {
        $highlight = if ($st.id -eq "769651") { "***" } else { "   " }
        Write-Host "$highlight ID: $($st.id), Name: $($st.name)" -ForegroundColor White
    }
} catch {
    Write-Host "Error getting service types: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test teams for service type 769651
Write-Host "`n3. Testing teams for service type 769651..." -ForegroundColor Yellow
try {
    $teams = Invoke-RestMethod -Uri "http://localhost:8058/api/pco/teams?service_type_ids[]=769651" -Method Get
    Write-Host "Teams found: $($teams.Count)" -ForegroundColor Cyan
    foreach ($team in $teams) {
        Write-Host "  - $($team.name) (ID: $($team.id))" -ForegroundColor White
    }
} catch {
    Write-Host "Error getting teams: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test positions for a team (if any teams found)
if ($teams -and $teams.Count -gt 0) {
    $testTeam = $teams[0].name
    Write-Host "`n4. Testing positions for team '$testTeam'..." -ForegroundColor Yellow
    try {
        $positions = Invoke-RestMethod -Uri "http://localhost:8058/api/pco/positions?service_type_ids[]=769651&team_name=$testTeam" -Method Get
        Write-Host "Positions found: $($positions.Count)" -ForegroundColor Cyan
        foreach ($pos in $positions) {
            Write-Host "  - $($pos.name) (ID: $($pos.id))" -ForegroundColor White
        }
    } catch {
        Write-Host "Error getting positions: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n4. Skipping positions test - no teams found" -ForegroundColor Yellow
}

Write-Host "`nDebug complete!" -ForegroundColor Green
