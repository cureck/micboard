# Trigger PCO sync to see debug logs

Write-Host "Triggering PCO sync..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8058/api/pco/sync" -Method Post
    Write-Host "Sync response: $($response | ConvertTo-Json)" -ForegroundColor Cyan
} catch {
    Write-Host "Error triggering sync: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Sync triggered. Check server console for debug logs." -ForegroundColor Yellow
