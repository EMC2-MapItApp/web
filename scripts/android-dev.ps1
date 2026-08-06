# Compila la app en modo development (backend local, ver src/environments/environment.ts),
# genera un APK debug, lo instala y lo lanza en un emulador Android.
#
# Requiere el backend local (../BACK, perfil dev) arrancado en :8081.
#
# Uso: npm run android:dev [-- -Avd "Otro AVD"]

param(
    [string]$Avd = 'Pixel 9'
)

# Trae Assert-LastExitCode, Set-AndroidEnv y Wait-EmulatorReady.
. "$PSScriptRoot\android-common.ps1"

# Fija ANDROID_HOME/JAVA_HOME y resuelve rutas a adb/emulator/gradlew (falla rapido si
# falta alguna herramienta, antes de gastar tiempo compilando).
$paths = Set-AndroidEnv

# --- 1. Build web de Angular contra el backend local (environment.ts, puerto 8081) ---
Write-Host "Compilando (configuracion development)..."
ng build --configuration=development
Assert-LastExitCode "ng build --configuration=development"

# --- 2. Copiar el build web al proyecto nativo Android (www/ dentro de android/) ---
Write-Host "Sincronizando Capacitor..."
npx cap sync android
Assert-LastExitCode "cap sync android"

# --- 3. Compilar el APK debug con Gradle (firmado automaticamente con el keystore debug) ---
Write-Host "Generando APK debug..."
Push-Location android
try {
    & .\gradlew.bat assembleDebug
    Assert-LastExitCode "gradlew assembleDebug"
}
finally {
    Pop-Location
}

$apkPath = Join-Path (Get-Location) 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apkPath)) {
    throw "No se ha generado el APK esperado en '$apkPath'"
}

# --- 4. Asegurar un emulador/dispositivo listo (reutiliza uno conectado si existe) ---
Wait-EmulatorReady -Adb $paths.Adb -Emulator $paths.Emulator -Avd $Avd

# --- 5. Instalar y lanzar el APK recien compilado ---
Write-Host "Instalando APK..."
& $paths.Adb install -r $apkPath
Assert-LastExitCode "adb install"

Write-Host "Lanzando app..."
& $paths.Adb shell am start -n com.emc.mapitapp/.MainActivity
Assert-LastExitCode "adb shell am start"

Write-Host ""
Write-Host "Listo. Recuerda que el backend local (../BACK, perfil dev, puerto 8081) debe estar" -ForegroundColor Yellow
Write-Host "arrancado para que el login y las llamadas API funcionen." -ForegroundColor Yellow
