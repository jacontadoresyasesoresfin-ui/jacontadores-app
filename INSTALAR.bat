@echo off
title J^&A Contadores - Instalador
color 0A
cls

echo.
echo  ================================================
echo    J^&A CONTADORES Y ASESORES - INSTALADOR
echo  ================================================
echo.
echo  Este programa instalara la aplicacion en tu equipo.
echo  Por favor NO cierres esta ventana hasta que termine.
echo.
pause

:: ── Verificar Node.js ────────────────────────────────────────────────────────
echo.
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  Node.js no esta instalado. Descargando...
    echo.
    echo  Se abrira el navegador para descargar Node.js.
    echo  Descarga la version LTS e instalala, luego vuelve a ejecutar este archivo.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  OK - Node.js %%v encontrado
)

:: ── Verificar Git ────────────────────────────────────────────────────────────
echo.
echo [2/5] Verificando Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  Git no esta instalado. Descargando...
    echo.
    echo  Se abrira el navegador para descargar Git.
    echo  Instalalo con las opciones por defecto, luego vuelve a ejecutar este archivo.
    echo.
    start https://git-scm.com/download/win
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('git --version') do echo  OK - %%v encontrado
)

:: ── Elegir carpeta de instalacion ────────────────────────────────────────────
echo.
echo [3/5] Configurando carpeta de instalacion...
set "INSTALL_DIR=%USERPROFILE%\JA_Contadores"

if exist "%INSTALL_DIR%\.git" (
    echo  La aplicacion ya esta instalada. Actualizando...
    cd /d "%INSTALL_DIR%"
    git pull origin main
    echo  OK - Aplicacion actualizada.
) else (
    echo  Clonando la aplicacion desde GitHub...
    git clone https://github.com/jacontadoresyasesoresfin-ui/jacontadores-app.git "%INSTALL_DIR%"
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: No se pudo clonar el repositorio.
        echo  Verifica tu conexion a internet y vuelve a intentarlo.
        pause
        exit /b 1
    )
    echo  OK - Aplicacion descargada en %INSTALL_DIR%
)

:: ── Instalar dependencias ────────────────────────────────────────────────────
echo.
echo [4/5] Instalando dependencias (puede tardar 2-5 minutos)...
cd /d "%INSTALL_DIR%"
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo  ERROR al instalar dependencias.
    pause
    exit /b 1
)
echo  OK - Dependencias instaladas.

:: ── Crear archivo de configuracion si no existe ──────────────────────────────
echo.
echo [5/5] Configurando conexion a la base de datos...
if not exist "%INSTALL_DIR%\.env.local" (
    :: Copiar la plantilla que ya trae la mayoria de valores configurados
    copy "%INSTALL_DIR%\.env.example" "%INSTALL_DIR%\.env.local" >nul 2>&1
    echo.
    echo  IMPORTANTE: Necesitas ingresar la clave secreta del servidor.
    echo  Pidela al administrador del sistema (es una cadena larga de texto).
    echo.
    set /p "SERVICE_KEY=Pega aqui la SUPABASE_SERVICE_ROLE_KEY y presiona Enter: "
    
    :: Reemplazar el placeholder con la clave real
    powershell -Command "(Get-Content '%INSTALL_DIR%\.env.local') -replace 'PEDIR_AL_ADMINISTRADOR', '%SERVICE_KEY%' | Set-Content '%INSTALL_DIR%\.env.local'"
    echo.
    echo  OK - Credenciales configuradas correctamente.
) else (
    echo  OK - Ya tienes configuracion existente. Verificando actualizacion de claves publicas...
    :: Actualizar solo las variables publicas que no cambian (URL de Supabase, info empresa)
    powershell -Command "$env = Get-Content '%INSTALL_DIR%\.env.local'; $example = Get-Content '%INSTALL_DIR%\.env.example'; foreach ($line in $example) { if ($line -match '^NEXT_PUBLIC_' -and $line -notmatch 'TU_VALOR' -and $line -notmatch '^#') { $key = $line.Split('=')[0]; if (-not ($env -match \"^$key=\")) { Add-Content '%INSTALL_DIR%\.env.local' $line } } }" >nul 2>&1
    echo  OK - Variables publicas verificadas.
)

:: ── Crear acceso directo en el escritorio ────────────────────────────────────
echo.
echo  Creando acceso directo en el Escritorio...
set "SHORTCUT=%USERPROFILE%\Desktop\J&A Contadores.bat"
echo @echo off > "%SHORTCUT%"
echo title J^&A Contadores >> "%SHORTCUT%"
echo cd /d "%INSTALL_DIR%" >> "%SHORTCUT%"
echo start "" "http://localhost:3000/dashboard" >> "%SHORTCUT%"
echo npm run dev >> "%SHORTCUT%"
echo  OK - Acceso directo creado en el Escritorio.

:: ── Finalizar ────────────────────────────────────────────────────────────────
echo.
echo  ================================================
echo    INSTALACION COMPLETADA EXITOSAMENTE
echo  ================================================
echo.
echo  Para usar la aplicacion cada dia:
echo  1. Haz doble-clic en "J^&A Contadores" en tu Escritorio
echo  2. Espera a que aparezca: "Ready in X.Xs"  
echo  3. El navegador se abrira automaticamente
echo.
echo  Presiona cualquier tecla para iniciar la aplicacion ahora...
pause >nul

cd /d "%INSTALL_DIR%"
start "" "http://localhost:3000/dashboard"
npm run dev
