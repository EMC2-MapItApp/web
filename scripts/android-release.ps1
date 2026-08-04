# Compila la app en modo production (backend real de Cloud Run, ver
# src/environments/environment.prod.ts), genera un .aab firmado con el keystore de
# upload (android/app/build.gradle, ver docs/CAPACITOR.md) y lo verifica instalandolo
# en un emulador via bundletool (un .aab no se puede instalar directamente).
#
# El .aab firmado queda listo para subir a Play Console en:
#   android/app/build/outputs/bundle/release/app-release.aab
# Recuerda incrementar versionCode/versionName a mano en android/app/build.gradle antes
# de cada subida real.
#
# Uso: npm run android:release [-- -Avd "Otro AVD"] [-- -SkipEmulator]

param(
    [string]$Avd = 'Pixel 9',
    [switch]$SkipEmulator
)

# Trae Assert-LastExitCode, Set-AndroidEnv y Wait-EmulatorReady.
. "$PSScriptRoot\android-common.ps1"

# --- Cargar credenciales de firma desde key.properties (fuera del repo, en Drive) ---
# El fichero no viaja con el proyecto porque contiene contraseñas del keystore de upload;
# solo existe en las maquinas autorizadas a generar releases (ver docs/CAPACITOR.md).
$keyPropertiesPath = 'G:\Mi unidad\MapItApp\keystores\key.properties'
if (-not (Test-Path $keyPropertiesPath)) {
    throw "No se encuentra '$keyPropertiesPath' - la firma de release no esta disponible en esta maquina (ver docs/CAPACITOR.md)"
}

# Parseo manual tipo .properties (clave=valor, comentarios con #) porque no hay cmdlet
# nativo de PowerShell para este formato.
$keyProperties = @{}
Get-Content $keyPropertiesPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
        $keyProperties[$matches[1]] = $matches[2]
    }
}
foreach ($field in @('storeFile', 'storePassword', 'keyAlias', 'keyPassword')) {
    if (-not $keyProperties.ContainsKey($field)) {
        throw "'$keyPropertiesPath' no define '$field'"
    }
}
# storeFile en key.properties puede ser relativo (a la carpeta del propio key.properties,
# convencion de Gradle) o absoluto; normalizarlo aqui para poder pasarlo a bundletool mas
# abajo sin depender del directorio de trabajo.
$storeFile = $keyProperties['storeFile']
if (-not [System.IO.Path]::IsPathRooted($storeFile)) {
    $storeFile = Join-Path (Split-Path $keyPropertiesPath -Parent) $storeFile
}

# Fija ANDROID_HOME/JAVA_HOME y resuelve rutas a adb/emulator/gradlew.
$paths = Set-AndroidEnv

# --- 1. Build web de Angular contra el backend real (environment.prod.ts, Cloud Run) ---
Write-Host "Compilando (configuracion production, backend real)..."
ng build --configuration=production
Assert-LastExitCode "ng build --configuration=production"

# --- 2. Copiar el build web al proyecto nativo Android ---
Write-Host "Sincronizando Capacitor..."
npx cap sync android
Assert-LastExitCode "cap sync android"

# --- 3. Compilar el .aab de release, firmado por Gradle con el keystore de upload ---
# (android/app/build.gradle lee key.properties para firmar; este script solo se asegura
# de que el fichero exista antes de invocar Gradle).
Write-Host "Generando .aab firmado..."
Push-Location android
try {
    & .\gradlew.bat bundleRelease
    Assert-LastExitCode "gradlew bundleRelease"
}
finally {
    Pop-Location
}

$repoRoot = Get-Location
$aabPath = Join-Path $repoRoot 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aabPath)) {
    throw "No se ha generado el .aab esperado en '$aabPath'"
}

# --- Verificacion en emulador via bundletool ---
# bundletool no forma parte del Android SDK; se descarga una vez y se cachea en
# scripts/.tools/ (ignorado en git, ver .gitignore).
$toolsDir = Join-Path $PSScriptRoot '.tools'
$bundletoolJar = Join-Path $toolsDir 'bundletool.jar'
if (-not (Test-Path $bundletoolJar)) {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $bundletoolVersion = '1.18.3'
    $bundletoolUrl = "https://github.com/google/bundletool/releases/download/$bundletoolVersion/bundletool-all-$bundletoolVersion.jar"
    Write-Host "Descargando bundletool $bundletoolVersion..."
    Invoke-WebRequest -Uri $bundletoolUrl -OutFile $bundletoolJar
}

$javaExe = Join-Path $env:JAVA_HOME 'bin\java.exe'
$apksPath = Join-Path $toolsDir 'app-release.apks'
if (Test-Path $apksPath) {
    Remove-Item $apksPath -Force
}

# --- 4. Derivar de ese .aab un .apks instalable (solo para verificar el release localmente) ---
# Un .aab no se puede instalar directo en un dispositivo; bundletool genera un "universal
# APK" firmado con el mismo keystore para poder probarlo antes de subirlo a Play Console.
Write-Host "Derivando APK instalable del .aab (modo universal, solo para verificacion local)..."
& $javaExe -jar $bundletoolJar build-apks `
    --bundle=$aabPath `
    --output=$apksPath `
    --mode=universal `
    --ks=$storeFile `
    --ks-pass="pass:$($keyProperties['storePassword'])" `
    --ks-key-alias=$($keyProperties['keyAlias']) `
    --key-pass="pass:$($keyProperties['keyPassword'])"
Assert-LastExitCode "bundletool build-apks"

# --- 5. Instalar y lanzar ese APK derivado, salvo que se pida saltar el paso (-SkipEmulator) ---
if (-not $SkipEmulator) {
    Wait-EmulatorReady -Adb $paths.Adb -Emulator $paths.Emulator -Avd $Avd

    Write-Host "Instalando APK derivado del .aab..."
    & $javaExe -jar $bundletoolJar install-apks --apks=$apksPath --adb=$($paths.Adb)
    Assert-LastExitCode "bundletool install-apks"

    Write-Host "Lanzando app..."
    & $paths.Adb shell am start -n com.emc.mapitapp/.MainActivity
    Assert-LastExitCode "adb shell am start"
}

# --- Resultado final: donde queda el .aab que se sube realmente a Play Console ---
Write-Host ""
Write-Host "AAB firmado listo para subir a Play Console:" -ForegroundColor Green
Write-Host "  $aabPath" -ForegroundColor Green
Write-Host ""
Write-Host "Recuerda incrementar versionCode/versionName en android/app/build.gradle antes de" -ForegroundColor Yellow
Write-Host "subirlo (no lo hace este script)." -ForegroundColor Yellow
