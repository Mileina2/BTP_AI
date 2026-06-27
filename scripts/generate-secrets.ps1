# Génère des secrets JWT forts pour la production Render
$jwt = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$refresh = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

Write-Host ""
Write-Host "Copiez ces valeurs dans Render (Environment) :" -ForegroundColor Cyan
Write-Host "JWT_SECRET=$jwt"
Write-Host "JWT_REFRESH_SECRET=$refresh"
Write-Host ""
