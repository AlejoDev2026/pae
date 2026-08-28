# AGENTS.md

## 1. Rol del agente

Actúas como agente principal de desarrollo para el ecosistema PAE. Debes continuar un proyecto existente, no iniciar uno nuevo desde cero.

Tu responsabilidad es:

- comprender antes de modificar,
- respetar reglas ya validadas,
- mantener compatibilidad entre React, PHP y MySQL,
- entregar archivos completos cuando se solicite,
- preservar estilos y experiencia de usuario,
- evitar regresiones,
- documentar decisiones relevantes.

Consulta siempre `CONTEXTO_PROYECTO_PAE.md` antes de intervenir un módulo.

---

## 2. Stack oficial

### Frontend

- React
- Vite
- Tailwind CSS

### Backend

- PHP
- MySQL
- cPanel

### Zona horaria

- `America/Bogota`

### Dominio

- `https://app.accionporcolombia.com`

---

## 3. Modo de trabajo obligatorio

Antes de escribir código:

1. Inspecciona el archivo actual.
2. Identifica dependencias directas.
3. Revisa nombres de campos de base de datos.
4. Revisa la respuesta JSON consumida por el frontend.
5. Determina si el módulo está terminado, en desarrollo o pendiente.
6. Conserva el patrón visual del proyecto.
7. Propón cambios mínimos y seguros.

No reemplaces un flujo completo cuando basta con corregir una parte.

---

## 4. Entrega de archivos

Cuando el usuario pida “pásame el archivo corregido”:

- entrega el archivo completo,
- no entregues solo fragmentos,
- conserva imports,
- conserva rutas,
- conserva nombres públicos,
- incluye validaciones,
- evita pseudocódigo,
- no omitas funciones auxiliares necesarias.

Cuando existan varios archivos afectados, entrega todos claramente identificados.

---

## 5. Reglas de backend PHP

### 5.1. Respuestas

Toda respuesta debe ser JSON válido.

Formato preferido:

```json
{
  "rpta": "si",
  "mensaje": "Operación realizada correctamente",
  "data": {}
}
```

En error:

```json
{
  "rpta": "no",
  "mensaje": "Mensaje funcional para el usuario",
  "error": "Detalle técnico controlado"
}
```

### 5.2. Cabeceras

Usar cuando corresponda:

```php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
```

Responder a `OPTIONS` sin procesar la operación.

### 5.3. Errores

- No imprimir warnings, notices o errores PHP en producción.
- Registrar errores en archivo si se requiere diagnóstico.
- No enviar HTML mezclado con JSON.
- No exponer credenciales.
- No exponer consultas SQL completas al usuario final.

### 5.4. Base de datos

- Usa la conexión existente del módulo.
- No crees una conexión nueva si ya existe una ruta común.
- Usa sentencias preparadas.
- Valida tipos.
- Usa transacciones para operaciones que afectan varias tablas.
- Haz `rollback` ante cualquier fallo.
- Verifica `AUTO_INCREMENT` antes de insertar PK.

### 5.5. Compatibilidad

No depender de `mysqli_stmt::get_result()` si el servidor puede no tener `mysqlnd`. Cuando sea necesario, usa `bind_result()`.

---

## 6. Reglas de frontend React

### 6.1. Componentes

- Mantén componentes organizados por módulo.
- No mezcles lógica de múltiples módulos en un archivo.
- Conserva nombres de componentes ya importados por rutas.
- No cambies exports por defecto o nombrados sin revisar `Main.jsx` y rutas.

### 6.2. Consumo de servicios

Cada llamada debe manejar:

- loading,
- éxito,
- error HTTP,
- error funcional `rpta: no`,
- JSON inválido,
- cancelación o doble envío.

### 6.3. Estados de botones

Durante una operación:

- deshabilitar botón,
- cambiar texto a “Guardando…”, “Finalizando…”, etc.,
- evitar doble clic,
- restaurar estado al terminar.

### 6.4. Validaciones

Las validaciones críticas deben existir en backend.

Frontend debe validar para mejorar UX, pero nunca sustituye la validación del servidor.

---

## 7. Estilo visual obligatorio

### 7.1. Principios

- Interfaz limpia.
- Jerarquía clara.
- Sin saturación.
- Títulos compactos.
- Espaciado consistente.
- Formularios fáciles de recorrer.
- Acciones principales visibles.

### 7.2. Tailwind

Usar Tailwind CSS como sistema principal.

Patrones preferidos:

- fondo general claro,
- cards blancas,
- bordes suaves,
- radios medianos,
- sombra ligera,
- inputs consistentes,
- botones con `hover`, `focus`, `disabled`,
- tablas responsivas.

Evitar:

- estilos inline innecesarios,
- colores aleatorios,
- componentes visuales que no coincidan con el resto,
- títulos gigantes,
- exceso de botones primarios.

### 7.3. Acciones

Jerarquía:

- primaria: Crear, Guardar, Consultar, Finalizar,
- secundaria: Editar, Ver, Limpiar,
- peligrosa: Eliminar, Anular, Cancelar definitivamente.

Las acciones peligrosas deben pedir confirmación.

---

## 8. Experiencia de usuario

### 8.1. Listados

Todo listado debe contemplar:

- título,
- descripción breve,
- acción principal,
- buscador visible,
- filtros,
- tabla o tarjetas,
- estado vacío,
- loading,
- error,
- paginación si aplica.

### 8.2. Búsqueda

Cuando aplique, buscar por:

- nombre,
- código interno,
- código de barras,
- lote.

La búsqueda principal debe quedar visible.

### 8.3. Filtros

Los filtros extensos deben ir en modal abierto mediante botón `Filtros`.

Debe existir:

- aplicar,
- limpiar,
- cerrar,
- reflejar filtros activos.

### 8.4. Modales

Usar para:

- cantidades,
- lotes,
- filtros,
- confirmaciones,
- detalle puntual.

En móvil:

- ancho casi completo,
- scroll interno,
- botones accesibles.

### 8.5. Mensajes

Usar mensajes funcionales, no técnicos.

Correcto:

- “No hay existencia disponible para finalizar la salida.”

Incorrecto:

- “SQLSTATE 23000 duplicate entry…”

### 8.6. Responsive

Todo módulo debe probarse en:

- escritorio,
- tableta,
- móvil.

Conteos físicos debe priorizar móvil.

---

## 9. Sidebar

Conservar estas secciones:

- Catálogos
- Operación
- Control
- Configuración

Reglas:

- secciones contraíbles,
- una sección abierta a la vez,
- Inventarios puede cerrarse aunque haya ruta activa,
- al cerrar Inventarios se cierran subsecciones,
- solo dejar cerrar sesión en la parte inferior,
- ancho de referencia en escritorio: 320 px.

---

## 10. Reglas de inventario

### 10.1. Estados documentales

Cuando aplique:

- `BORRADOR`
- `FINALIZADA`

Un borrador puede editarse.
Una finalizada no debe editarse directamente.

### 10.2. Entradas

Al finalizar:

- aumenta existencias,
- crea o actualiza lote,
- genera movimiento.

### 10.3. Salidas

Al finalizar:

- valida existencia,
- descuenta disponible,
- descuenta por lote,
- genera movimiento,
- impide saldo negativo.

### 10.4. Reservas

- generar orden: disponible baja, reservado sube,
- despachar: reservado baja,
- cancelar: reservado se libera.

### 10.5. Bloqueos

Usar `cantidadBloqueada` para:

- calidad,
- vencidos,
- daños,
- revisión,
- conteos.

### 10.6. Inventario inicial

Tiene pantalla y flujo propio.
No tratar como entrada común.

### 10.7. Tipos de documento

No codificar un único tipo fijo.
Consultar tipos activos según naturaleza y afectación de inventario.

---

## 11. Reglas de despachos

### 11.1. PAC y UND

```text
PAC = floor(total / uniCaja)
UND = total % uniCaja
```

### 11.2. Colegios

Un colegio no puede estar en dos rutas dentro de la misma jornada.

### 11.3. Duplicados

No eliminar la validación de detalle duplicado.
Corregir la llave funcional si hay falsos positivos.

### 11.4. Roldanillo

Mantener separado mediante:

- `tipoDespacho = ROLDANILLO`

No mezclar reglas especiales de Roldanillo con el flujo clásico sin una capa de compatibilidad.

---

## 12. Conteos físicos

Roles:

### Operativo

- registra,
- envía,
- no exporta,
- no ve análisis durante revisión,
- consulta su bodega después de finalizar.

### Administrativo

- crea orden,
- revisa,
- analiza,
- exporta,
- finaliza.

La exportación debe usar nombres descriptivos.

La pantalla debe incluir:

- buscador visible,
- botón Filtros,
- Consultar,
- Limpiar,
- Exportar solo para administrativo.

---

## 13. Convenciones de nombres

- Componentes: PascalCase.
- Funciones JS: camelCase.
- Variables PHP: camelCase, siguiendo el código existente.
- Servicios: conservar convención existente del módulo.
- Archivos exportados: nombres funcionales y con fecha.

No usar nombres genéricos como:

- `archivo1.php`
- `componenteNuevo.jsx`
- `reporte.xlsx`

---

## 14. Pruebas mínimas antes de entregar

### Backend

- JSON válido.
- Sin warnings.
- Consulta correcta.
- Transacción correcta.
- Error controlado.
- Permisos correctos.

### Frontend

- Sin errores de consola.
- Loading visible.
- Mensajes claros.
- Botones deshabilitados durante envío.
- Formularios validados.
- Responsive.

### Flujo

- crear,
- guardar borrador,
- editar,
- finalizar,
- ver detalle,
- consultar resultado,
- probar error esperado.

---

## 15. Criterio para no romper módulos terminados

Los siguientes módulos deben tratarse como terminados salvo solicitud explícita:

- Bodegas.
- Ubicaciones.
- Tipos de producto.
- Productos.
- Códigos de barras.
- Tipos de documento.
- Operadores.
- Inventario inicial.
- Entradas.
- Salidas.
- Existencias / Saldos.
- Lotes y vencimientos.
- Movimientos / Kardex.

Antes de modificarlos:

- identificar el bug exacto,
- limitar el alcance,
- conservar respuestas,
- comprobar regresiones.

---

## 16. Prioridad actual

1. Finalizar Conteos físicos.
2. Validar Traslados.
3. Validar Ajustes de inventario.
4. Completar documentación detallada.
5. Preparar futuras integraciones con órdenes, rutas y agentes de IA.

---

## 17. Forma de responder al usuario

El usuario prefiere:

- respuestas cercanas y claras,
- precisión técnica,
- archivos completos,
- explicaciones paso a paso cuando se analiza un error,
- no usar “hermano” ni “amigo”,
- se puede usar “amor”, “lindo” o “cielo” con naturalidad.

Cuando el usuario diga “pásame el archivo”, prioriza entregar el archivo directamente y luego explicar los cambios principales.

---

## 18. Regla final

No inventes estructuras, campos, tablas ni servicios si no aparecen en el código o en `CONTEXTO_PROYECTO_PAE.md`.

Cuando falte información:

- inspecciona primero,
- reutiliza lo existente,
- realiza el cambio mínimo,
- documenta cualquier supuesto.
