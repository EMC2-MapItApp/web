# Funciones compartidas por scripts/android-dev.ps1 y scripts/android-release.ps1.
# Dot-source este fichero desde ambos: . "$PSScriptRoot\android-common.ps1"

$ErrorActionPreference = 'Stop'

# Comprueba el exit code del ultimo comando externo (&, no cmdlet) y aborta el script si
# ha fallado. Los cmdlets de PowerShell ya lanzan excepcion solos gracias a $ErrorActionPreference;
# esto cubre los procesos externos (ng, npx, gradlew, adb...), que no lo hacen.
function Assert-LastExitCode {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo en '$Step' (exit code $LASTEXITCODE)"
    }
}

# Fija ANDROID_HOME/JAVA_HOME solo para este proceso (no toca variables de entorno
# persistentes de la maquina, ver docs/CAPACITOR.md) y resuelve las rutas a las
# herramientas que necesitan los scripts.
function Set-AndroidEnv {
    # --- Android SDK: localizar y exportar solo para este proceso ---
    $androidHome = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (-not (Test-Path $androidHome)) {
        throw "No se encuentra el Android SDK en '$androidHome'"
    }
    $env:ANDROID_HOME = $androidHome
    $env:ANDROID_SDK_ROOT = $androidHome

    # --- JDK: usar Corretto 21, no el JBR embebido en Android Studio ---
    # Usamos el mismo JDK que el IDE y gradlew en consola (ver plan-instalacion-limpia.md:
    # "una sola fuente de verdad"), no el JBR embebido en Android Studio.
    $correttoHome = 'C:\Program Files\Amazon Corretto\jdk21.0.12_8'
    if (-not (Test-Path $correttoHome)) {
        throw "No se encuentra el JDK Corretto 21 en '$correttoHome'"
    }
    $env:JAVA_HOME = $correttoHome

    # --- Resolver rutas a los binarios que usan los scripts que llaman a esta funcion ---
    # Gradlew se resuelve relativo al directorio de trabajo actual: los scripts deben
    # lanzarse desde la raiz del proyecto (vía "npm run android:dev/android:release"), no
    # desde dentro de scripts/.
    $paths = [pscustomobject]@{
        Adb      = Join-Path $androidHome 'platform-tools\adb.exe'
        Emulator = Join-Path $androidHome 'emulator\emulator.exe'
        Gradlew  = Join-Path (Join-Path (Get-Location) 'android') 'gradlew.bat'
    }

    # --- Fallar rapido si falta alguna herramienta, antes de compilar nada ---
    foreach ($name in @('Adb', 'Emulator', 'Gradlew')) {
        if (-not (Test-Path $paths.$name)) {
            throw "No se encuentra $name en '$($paths.$name)'"
        }
    }

    return $paths
}

# Reutiliza un emulador/dispositivo ya conectado si existe; si no, arranca el AVD
# indicado y espera a que termine de bootear (timeout 120s).
function Wait-EmulatorReady {
    param(
        [Parameter(Mandatory)][string]$Adb,
        [Parameter(Mandatory)][string]$Emulator,
        [Parameter(Mandatory)][string]$Avd
    )

    # --- Si ya hay un dispositivo/emulador conectado, no arrancar otro ---
    $devices = & $Adb devices | Select-String -Pattern '\bdevice$'
    if ($devices) {
        Write-Host "Reutilizando emulador/dispositivo ya conectado."
        return
    }

    # --- Arrancar el AVD indicado en segundo plano y esperar a que adb lo detecte ---
    Write-Host "Arrancando AVD '$Avd'..."
    Start-Process -FilePath $Emulator -ArgumentList @('-avd', $Avd) -WindowStyle Minimized | Out-Null

    & $Adb wait-for-device
    Assert-LastExitCode "adb wait-for-device"

    # --- Sondear sys.boot_completed hasta que el emulador termine de arrancar (o timeout) ---
    $elapsed = 0
    $timeoutSeconds = 120
    while ($true) {
        $boot = & $Adb shell getprop sys.boot_completed 2>$null
        if ($boot -match '1') {
            break
        }
        if ($elapsed -ge $timeoutSeconds) {
            throw "El emulador '$Avd' no ha terminado de arrancar tras ${timeoutSeconds}s"
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Host "Emulador '$Avd' listo."
}
