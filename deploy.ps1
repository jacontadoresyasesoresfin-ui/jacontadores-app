# deploy.ps1
# Script ultra-confiable para construir y subir a la rama 'production'

$repoUrl = "https://github.com/jacontadoresyasesoresfin-ui/jacontadores-app.git"

Write-Host "Realizando build del proyecto..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en el build. Abortando." -ForegroundColor Red
    exit
}

Write-Host "Preparando archivos para cPanel..." -ForegroundColor Cyan

# Copiar el .cpanel.yml si no está en out
if (Test-Path "public\.cpanel.yml") {
    Copy-Item "public\.cpanel.yml" "out\.cpanel.yml" -Force
}

# Entrar a la carpeta out y subirla como una rama nueva
Push-Location out

# Inicializar un git temporal solo en la carpeta out
git init
git checkout -b production
git add .
git commit -m "deploy: update production build $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Subir a la fuerza a la rama production del repositorio
Write-Host "Subiendo a la rama 'production'..." -ForegroundColor Cyan
git push $repoUrl production --force

Pop-Location

Write-Host "¡Listo! Ahora ve a cPanel -> Git Control -> Manage -> Pull or Deploy." -ForegroundColor Green
Write-Host "Asegúrate de cambiar la rama a 'production' si aún dice 'main'." -ForegroundColor Yellow
