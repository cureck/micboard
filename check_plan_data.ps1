# Check current plan data for service type 769651

Write-Host "Checking plan data for service type 769651..." -ForegroundColor Green

try {
    # Get upcoming plans
    $plans = Invoke-RestMethod -Uri "http://localhost:8058/api/pco/upcoming-plans" -Method Get
    
    Write-Host "`nUpcoming plans:" -ForegroundColor Cyan
    foreach ($plan in $plans) {
        $highlight = if ($plan.service_type_id -eq "769651") { "***" } else { "   " }
        Write-Host "$highlight Service Type: $($plan.service_type_id) - $($plan.service_type_name)" -ForegroundColor White
        Write-Host "$highlight Plan ID: $($plan.plan_id)" -ForegroundColor White
        Write-Host "$highlight Title: $($plan.title)" -ForegroundColor White
        Write-Host "$highlight Slot Assignments: $($plan.slot_assignments | ConvertTo-Json -Compress)" -ForegroundColor White
        Write-Host ""
    }
    
    # Find service type 769651 specifically
    $plan769651 = $plans | Where-Object { $_.service_type_id -eq "769651" }
    if ($plan769651) {
        Write-Host "`n🎯 Service Type 769651 Details:" -ForegroundColor Yellow
        Write-Host "Plan ID: $($plan769651.plan_id)" -ForegroundColor White
        Write-Host "Title: $($plan769651.title)" -ForegroundColor White
        Write-Host "Service Time: $($plan769651.service_time)" -ForegroundColor White
        Write-Host "Slot Assignments: $($plan769651.slot_assignments | ConvertTo-Json -Compress)" -ForegroundColor White
        Write-Host "Assignments Count: $($plan769651.assignments.Count)" -ForegroundColor White
        
        if ($plan769651.assignments) {
            Write-Host "`n📋 Assignments in Plan:" -ForegroundColor Cyan
            foreach ($assignment in $plan769651.assignments) {
                Write-Host "  - $($assignment | ConvertTo-Json -Compress)" -ForegroundColor White
            }
        }
    } else {
        Write-Host "`n❌ Service Type 769651 not found in upcoming plans" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}