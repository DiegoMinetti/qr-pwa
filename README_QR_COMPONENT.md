# QRImageStyler (React)

Componente React que renderiza un código QR y permite usar una imagen para
reemplazar los módulos (cada módulo oscuro dibuja la `moduleImage`). También
soporta un `imageUrl` centrado (logo) y export a PNG y SVG.

Instalación (proyecto React existente):

```bash
npm install qrcode
```

Uso mínimo:

```jsx
import React from 'react'
import QRImageStyler from './src/components/QRImageStyler'

function App(){
  return (
    <div>
      <h3>QR con imagen por módulo</h3>
      <QRImageStyler
        value="https://example.com"
        size={320}
        imageUrl="/path/to/center-logo.png"
        moduleImageUrl="/path/to/module-pattern.png"
      />
    </div>
  )
}

export default App
```

Notas:
- Este componente usa la función `QRCode.create` del paquete `qrcode` para
  obtener la matriz de módulos; si la API no está disponible en el entorno
  (por ejemplo con una versión diferente), el componente cae en un fallback
  que dibuja el QR en canvas usando `QRCode.toCanvas`.
- Para que el reemplazo de módulos funcione correctamente, la `moduleImage`
  debe servirse con `Access-Control-Allow-Origin: *` si proviene de un CDN,
  o estar alojada en el mismo dominio (evitar errores CORS).
- SVG generado incluye elementos `<image>` para cada módulo cuando
  `moduleImageUrl` está definido; algunos viewers pueden rasterizar la SVG
  según el soporte del navegador.

Siguientes mejoras posibles:
- Integrar `qr-code-styling` para efectos visuales y mejor control de puntos.
- Añadir opciones para patrones (líneas, diagonales, rotaciones) por módulo.
- Añadir tests visuales y ejemplo demo en `index.html`.
