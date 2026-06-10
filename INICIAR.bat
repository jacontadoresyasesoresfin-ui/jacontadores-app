@echo off
title J^&A Contadores - Iniciando...
color 0A
cls

set "INSTALL_DIR=%USERPROFILE%\JA_Contadores"

echo.
echo  ================================================
echo    J^&A CONTADORES Y ASESORES
echo  ================================================
echo.

:: ── Verificar si hay actualizacion disponible ────────────────────────────────
echo  Verificando actualizaciones...
cd /d "%INSTALL_DIR%"
git fetch origin main >nul 2>&1
for /f %%i in ('git rev-list HEAD..origin/main --count 2^>nul') do set UPDATES=%%i
if "%UPDATES%" == "" set UPDATES=0

if %UPDATES% gtr 0 (
    echo  Hay %UPDATES% actualizacion(es) disponible(s). Actualizando...
    git pull origin main >nul 2>&1
    npm install --legacy-peer-deps --silent >nul 2>&1
    echo  Aplicacion actualizada.
) else (
    echo  La aplicacion esta al dia.
)

echo.
echo  Iniciando servidor...
echo  (Esto puede tardar 5-10 segundos)
echo.

:: Abrir el navegador despues de 6 segundos
start /b cmd /c "ping -n 7 127.0.0.1 >nul && start http://localhost:3000/dashboard"

:: Iniciar la aplicacion
npm run dev
