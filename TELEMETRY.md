# Política de Privacidad y Telemetría de MintMind
## Guía para Usuarios Finales: ¿Qué es la Telemetría en MintMind?

Esta sección está diseñada para usuarios comunes que quieren entender de manera sencilla cómo funciona la telemetría en MintMind. Si eres usuario final y no técnico, aquí encontrarás explicaciones claras sobre qué recopilamos y cómo puedes controlarlo.

### ¿Qué es la Telemetría?

La telemetría es como un "informe automático" que MintMind envía para ayudarnos a mejorar el programa. Imagina que es como cuando le cuentas a un fabricante de autos sobre problemas que has tenido: nos ayuda a hacer MintMind mejor para todos.

- **No recopilamos información personal**: No vemos tus archivos, correos electrónicos o datos privados.
- **Es opcional**: Tú decides si quieres ayudar enviando estos informes.
- **Ayuda a mejorar**: Gracias a la telemetría, podemos arreglar errores y añadir funciones que realmente necesitas.

### ¿Qué Datos Recopilamos?

Solo recopilamos información básica y anónima que nos ayuda a entender cómo usas MintMind. Nunca vemos el contenido de tus archivos o conversaciones.

**Datos básicos del sistema:**
- Tipo de computadora (Windows, Mac, Linux) y versión
- Versión de MintMind que usas
- Cuánto tiempo has usado el programa en una sesión

**Si activas más opciones:**
- Errores que ocurren (sin detalles personales)
- Funciones que usas más (como si abres el explorador de archivos o usas el buscador)

**Nunca recopilamos:**
- El contenido de tus archivos
- Tus direcciones de email
- Contraseñas o información de cuentas
- Rutas completas de archivos (las "limpiamos" para proteger tu privacidad)

### ¿Cómo Controlar la Telemetría?

Tienes control total sobre qué información enviamos. Hay cuatro niveles simples:

1. **Apagado completo ("off")**: No enviamos nada. Es como desconectar el "informe automático".
2. **Solo crashes ("crash")**: Solo nos dice si el programa se cierra inesperadamente.
3. **Errores ("error")**: Incluye crashes más errores que ocurren durante el uso.
4. **Todo ("all")**: Incluye todo lo anterior más cómo usas el programa (qué botones presionas, etc.).

**Por defecto, MintMind está configurado en "error"** - solo errores y crashes, nada sobre cómo usas el programa.

### Cómo Cambiar la Configuración

Hay varias formas sencillas de cambiar esto:

**Opción más fácil - Desde el menú:**
1. Ve a "Archivo" > "Preferencias" > "Configuración"
2. Busca "telemetry" en la barra de búsqueda
3. Elige el nivel que prefieras en "Nivel de Telemetría"

**Desde el archivo de configuración (avanzado):**
1. Abre la paleta de comandos (Ctrl+Shift+P en Windows/Linux, Cmd+Shift+P en Mac)
2. Escribe "Preferences: Open Settings (JSON)"
3. Añade esta línea: `"telemetry.telemetryLevel": "off"` (cambia "off" por el nivel que quieras)

**Al iniciar MintMind:**
- Desde la línea de comandos: `mintmind --telemetry-level=off`
- Esto dura solo para esa sesión

### Tus Opciones

| Opción | Qué envía | Recomendado para |
|--------|-----------|------------------|
| **Apagado ("off")** | Nada | Quienes prefieren máxima privacidad |
| **Crashes ("crash")** | Solo cuando se cierra inesperadamente | Compromiso entre ayudar y privacidad |
| **Errores ("error")** | Crashes + errores durante el uso | Configuración por defecto, buen balance |
| **Todo ("all")** | Todo lo anterior + cómo usas el programa | Quienes quieren ayudar al máximo |

**¿Cambiaste de opinión?** Puedes cambiar la configuración en cualquier momento, y los cambios se aplican inmediatamente.

### ¿Es Seguro?

- **Anonimizamos todo**: Los datos se procesan para quitar cualquier información que pueda identificarte.
- **Usamos servidores seguros**: La información va a servidores de Microsoft protegidos.
- **Cumplimos leyes**: Respetamos todas las regulaciones de privacidad de datos.
- **Transparente**: Todo lo que hacemos está explicado y puedes verlo en el código fuente.

Si tienes dudas o quieres más información, puedes consultar la [Declaración de Privacidad de Microsoft](https://privacy.microsoft.com/) o contactar con el equipo de MintMind.

---


## Resumen

MintMind recopila datos de uso y errores para mejorar la experiencia del usuario y mantener la calidad del producto. Esta documentación explica qué datos se recopilan, cómo se envían, cuándo se envían y cómo controlar la telemetría.

## ¿Qué datos se recopilan?

### Datos de uso (Usage Data)
Cuando la telemetría está habilitada en nivel "all" o "error", se recopilan los siguientes tipos de datos:

**Propiedades comunes del sistema:**
- ID de sesión único (generado aleatoriamente)
- ID de máquina (hash del identificador de dispositivo)
- ID de SQM (identificador de usuario pseudonimizado)
- ID de dispositivo de desarrollo
- Versión del producto y fecha de lanzamiento
- Plataforma del sistema operativo (Windows, macOS, Linux)
- Arquitectura del sistema (x64, arm64, etc.)
- Fecha de primera sesión
- Tiempo desde el inicio de la sesión
- Número de secuencia de eventos

**Datos de uso específicos:**
- Eventos de acciones del usuario (como clics en botones, comandos ejecutados)
- Estadísticas de edición (solo si está habilitado específicamente)
- Uso de características del editor
- Información de acceso remoto (tipo de autoridad remota: SSH, contenedor, WSL, etc.)

### Datos de errores (Error Data)
Cuando la telemetría está habilitada en nivel "all", "error" o "crash", se recopilan:

**Información de errores y crashes:**
- Errores no manejados y excepciones
- Información del stack trace (con rutas de archivos limpiadas)
- Información del sistema operativo
- Versión del producto y componentes

**Información de crashes del sistema operativo:**
- Reportes de crashes a nivel del SO (cuando está habilitado)

### Limpieza de datos
Antes de enviar cualquier dato, MintMind:

1. **Elimina información sensible** como:
   - Rutas de archivos del sistema (`/home/user/`, `C:\Users\`, etc.)
   - Claves API y tokens (Google API, JWT, GitHub tokens, etc.)
   - Información de credenciales (nombres de usuario, contraseñas)
   - Correos electrónicos

2. **Anonimiza datos**: Las rutas de archivos del usuario se reemplazan con `<REDACTED: user-file-path>`

3. **Usa valores de confianza**: Algunos datos marcados como `TelemetryTrustedValue` se excluyen de la limpieza

## ¿Cuándo se envían los datos?

### Niveles de telemetría

| Nivel | Datos de uso | Datos de errores | Datos de crash |
|-------|--------------|------------------|----------------|
| `all` | ✓           | ✓               | ✓             |
| `error`| -           | ✓               | ✓             |
| `crash`| -           | -               | ✓             |
| `off`  | -           | -               | -             |

### Momento del envío
- **Datos de uso**: Se envían en tiempo real cuando ocurren eventos
- **Datos de errores**: Se envían inmediatamente cuando ocurre un error
- **Datos de crash**: Dependiente del sistema operativo

### Condiciones para el envío
Los datos se envían solo si:
1. La telemetría está habilitada según la configuración del usuario
2. El producto está configurado para permitir telemetría
3. No es un entorno de desarrollo/testing sin claves de configuración

## ¿Cómo se configura la telemetría?

### Configuración por defecto
- **Nivel por defecto**: `error`
- Esto significa que se recopilan datos de errores y crashes, pero no datos de uso

### Configuraciones disponibles
- **`"telemetry.telemetryLevel": "all"`**: Envía datos de uso, errores y crashes
- **`"telemetry.telemetryLevel": "error"`**: Envía errores y crashes (por defecto)
- **`"telemetry.telemetryLevel": "crash"`**: Envía solo datos de crash del SO
- **`"telemetry.telemetryLevel": "off"`**: Deshabilita toda la telemetría

### Configuraciones obsoletas
- **`"telemetry.enableTelemetry": false`**: Deshabilita toda la telemetría (obsoleto)
- **`"telemetry.enableCrashReporter": false`**: Deshabilita reportes de crash (obsoleto)

## ¿Cómo controlar la telemetría?

### A través de la interfaz de usuario
1. Abre la paleta de comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Busca "Preferences: Open Settings (UI)"
3. Busca "telemetry" en la barra de búsqueda
4. Selecciona el nivel deseado en "Telemetry Level"

### A través del archivo de configuración
Edita el archivo `settings.json`:

```json
{
  "telemetry.telemetryLevel": "off"
}
```

### A través de variables de entorno
- `VSCODE_TELEMETRY_LEVEL=off`: Deshabilita la telemetría
- `VSCODE_DISABLE_TELEMETRY=1`: Deshabilita la telemetría (CLI)

### Para servidores remotos
- `--telemetry-level=all|error|crash|off`: Controla la telemetría del servidor
- `--disable-telemetry`: Deshabilita completamente la telemetría

### Comandos de ejemplo

#### Deshabilitar telemetría completamente:
```bash
# En el cliente
code --disable-telemetry

# En el servidor remoto
code-server --disable-telemetry
```

#### Configurar nivel específico:
```bash
# Nivel de error (por defecto)
code --telemetry-level=error

# Solo crashes
code --telemetry-level=crash

# Todo habilitado
code --telemetry-level=all
```

## ¿Dónde se envían los datos?

### Entorno de desarrollo/testing
- Si no hay claves de configuración (`ariaKey`) y es un build de desarrollo, los datos se registran localmente en lugar de enviarse
- Útil para debugging sin enviar datos reales

### Entorno de producción
- Los datos se envían a los endpoints de telemetría de Microsoft (Azure Application Insights)
- Se requieren claves de configuración válidas (`ariaKey`) en `product.json`

## Consideraciones de privacidad

- **Pseudonimización**: Los identificadores de usuario son hashes irreversibles
- **No se recopilan datos personales**: Correos, nombres, contenido de archivos
- **Transparencia**: Todos los eventos están documentados en el código fuente
- **Control del usuario**: Los usuarios pueden deshabilitar la telemetría completamente
- **Cumplimiento legal**: Respeta configuraciones de empresa y políticas de privacidad

## Información técnica adicional

### Arquitectura de telemetría
- **TelemetryService**: Servicio principal que maneja el envío de datos
- **ServerTelemetryService**: Versión para servidores remotos con control de cliente
- **Appenders**: Componentes que envían datos a diferentes destinos (Azure AI, logging local)
- **Limpieza automática**: Procesamiento de datos antes del envío

### Extensiones
- Las extensiones pueden enviar telemetría propia
- Respeta la configuración del usuario
- Debe usar las APIs oficiales de telemetría de VS Code

### Políticas de retención
- Los datos se retienen según las políticas de Microsoft Azure Application Insights
- Típicamente 90 días para datos operacionales
- Consultar la documentación de Azure para detalles específicos

---

Para más información sobre privacidad y telemetría, consulta:
- [Declaración de privacidad de Microsoft](https://privacy.microsoft.com/)
- [Datos que recopilamos](https://aka.ms/vscode-telemetry)