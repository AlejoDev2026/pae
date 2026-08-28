# CONTEXTO CONSOLIDADO DEL PROYECTO PAE

## 1. Propósito de este archivo

Este documento concentra el contexto funcional, técnico y operativo del ecosistema PAE desarrollado hasta la fecha. Su objetivo es permitir que cualquier agente de desarrollo, especialmente Codex, continúe el trabajo sin perder decisiones previas, reglas de negocio, módulos terminados, convenciones, flujos, estilos ni criterios de experiencia de usuario.

Este archivo debe tomarse como fuente de continuidad del proyecto. Antes de modificar un módulo existente, debe revisarse la sección correspondiente y conservarse el comportamiento ya validado.

---

## 2. Ecosistema general PAE

El ecosistema está compuesto por varios proyectos relacionados:

### 2.1. Gestión de despachos PAE

Sistema para cargar, organizar, validar y consultar despachos de alimentación escolar por jornadas, rutas, colegios, productos, categorías y tipos de informe.

Funciones principales:

- Creación y consulta de despachos.
- Carga de detalles desde archivos Excel.
- Organización por jornada, ruta, colegio y producto.
- Validación de duplicados.
- Consolidación de cantidades.
- Generación de informes por ruta, jornada, contrato, categoría, colegio y cadena de frío.
- Flujo especial de Roldanillo.
- Normalización de productos, presentaciones y embalajes.

### 2.2. Sistema de inventarios y logística PAE

Sistema independiente pero relacionado con despachos, orientado al control de existencias, entradas, salidas, inventario inicial, lotes, movimientos, conteos físicos y configuración logística.

### 2.3. Gestión de personal

Proyecto para registro de personal, supervisores, sedes, documentos, asistencia, jornadas, novedades, cálculo de horas y reportes.

---

## 3. Arquitectura y tecnologías

### 3.1. Frontend

- React.
- Vite.
- Tailwind CSS.
- Componentes organizados por módulos y carpetas.
- Consumo de servicios PHP mediante `fetch`.
- Manejo de estados, carga, errores y respuestas JSON.

### 3.2. Backend

- PHP.
- MySQL.
- Despliegue en cPanel.
- Servicios independientes por módulo.
- Respuestas JSON UTF-8.
- Validaciones de negocio en backend.
- Manejo de errores con códigos HTTP coherentes cuando aplica.

### 3.3. Dominio principal

- `https://app.accionporcolombia.com`

### 3.4. Convenciones comunes de servicios PHP

Los servicios suelen incluir:

```php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
```

Para evitar respuestas dañadas en producción:

- No mostrar errores PHP directamente al frontend.
- Registrar errores en archivo cuando sea necesario.
- Mantener respuestas JSON limpias.
- Responder correctamente a solicitudes `OPTIONS`.
- Usar la zona horaria `America/Bogota` salvo que un módulo existente tenga una necesidad distinta.

---

# PARTE I. GESTIÓN DE DESPACHOS PAE

## 4. Servicios principales ya trabajados

Servicios confirmados dentro del flujo general:

- `DespachosGetAll.php`
- `DespachosCreate.php`
- `DespachosGuardarDetalle.php`
- `DespachosGuardarDetalleMultiple.php`
- `DespachosGetDetalle.php`
- `DespachosGetInformeRutaFormato.php`
- `DespachosGetInformeJornadaContrato.php`
- `DespachosGetInformeRutaCategoriaColegio.php`
- `DespachosGetInformeRutaEspecialConsolidado.php`
- `ProductosCatalogoImportarDesdeExcel.php`
- `DashboardGetResumen.php`

No cambiar nombres, estructuras de respuesta ni reglas de estos servicios sin revisar primero las pantallas que los consumen.

---

## 5. Reglas principales de despachos

### 5.1. Conversión PAC / UND

La cantidad debe convertirse de la siguiente forma:

- `PAC = floor(total / uniCaja)`
- `UND = total % uniCaja`

Se almacena PAC según el flujo definido y se usa UND en los reportes o detalles cuando corresponde.

### 5.2. Restricción de colegios por jornada

Un colegio no puede estar asignado a dos rutas diferentes dentro de la misma jornada.

Error funcional esperado:

- `colegio_en_otra_ruta`

### 5.3. Control de detalles duplicados

El sistema valida que no se inserte un detalle repetido para combinaciones equivalentes de:

- despacho,
- ruta,
- colegio,
- producto,
- jornada,
- tipo de archivo,
- y demás campos funcionales involucrados.

Cuando se detecta un duplicado, el servicio debe responder información suficiente para identificarlo:

- archivo,
- tipo de archivo,
- despacho,
- ruta,
- colegio,
- producto,
- cantidad,
- identificador del detalle existente.

No eliminar esta validación. Si aparece un falso positivo, debe corregirse la llave funcional, no desactivarse el control.

---

## 6. Informes clásicos

Tipos de informe ya definidos:

- `POR_RUTA`
- `TOTAL_JORNADA_CONTRATO`
- `POR_CADENA_FRIO`
- `POR_CATEGORIA_COLEGIO`

Categorías clave utilizadas:

- 24
- 21

La categoría 21 suele estar relacionada con cadena de frío o congelados según el flujo correspondiente.

---

## 7. Flujo especial Roldanillo

Roldanillo se maneja como flujo separado.

### 7.1. Identificación

- `tipoDespacho = ROLDANILLO`

### 7.2. Pantallas principales

- `DespachosRoldanillo`
- `Nuevo/Detalle`
- `InformesHomeRoldanillo`
- `InformeRutaTranzabilidadRoldanillo`

### 7.3. Informes Roldanillo

- `POR_RUTA`
- `POR_JORNADA`
- `POR_CATEGORIA_COLEGIO`
- `POR_CADENA_FRIO`

### 7.4. Colegios Roldanillo

Se manejó una codificación técnica basada en:

- prefijo `RLD`,
- hash MD5 de `ruta|nombre`,
- 12 caracteres.

El flujo de resolución debe buscar primero por:

1. código y nombre,
2. nombre exacto,
3. creación controlada cuando no exista.

Casos identificados previamente:

- `ISIDORO PAOLI` → `CG-941A64F81CE2`
- `PABLO SEXTO` → `CG-B633B8FEA95C`

Corrección previa de nombre:

- `OBANDO RURALIDAD DISPERSA 1`

---

## 8. Codificación de colegios

La codificación de colegios es un mecanismo crítico para relacionar archivos Excel, rutas, listas y registros de base de datos.

Ejemplo confirmado:

- `CONCENTRACION DE DESARROLLO RURAL SANTA MARTA`
- código: `CG-55F26D3A1677`

Posteriormente el nombre cambió a:

- `SANTA MARTA AG`

Lista asociada:

- `Gobernacion 2026 - AGUILA ACOPIO`

Cuando un colegio cambia de nombre, no debe crearse automáticamente como uno totalmente diferente sin validar su código, ruta, lista y equivalencia histórica.

---

## 9. Productos, presentaciones y embalajes

### 9.1. Normalización de presentaciones

Reglas definidas:

- `FRASCO` → `F`
- `BOLSA` → `B`
- `PAQUETE` → `PAQ`
- `UNIDAD` → `UND`
- `GRAMO` → `GR`
- `ML` → `CC`

### 9.2. Limpieza del producto base

La función de limpieza debe remover sufijos de presentación sin destruir el nombre real del producto.

Ejemplos trabajados:

- `AVENA INSTANTANEA SABORIZADA / B X 200`
- `MARGARINA / B X 220`

El producto base y la presentación deben resolverse por separado.

### 9.3. Resolución por embalaje

La resolución debe retornar como mínimo:

- `idProducto`
- `idEmbalaje`
- `producto_base`
- `presentacion`

La búsqueda debe evitar que una presentación incompleta se relacione con un embalaje incorrecto.

### 9.4. Catálogo de embalajes

Ejemplo trabajado:

```sql
INSERT INTO EmbalajeCatalogo
(
    producto_base,
    presentacion,
    embalaje,
    `uni/caja`,
    estado,
    created_at,
    updated_at
)
VALUES
(
    'AVENA INSTANTANEA SABORIZADA',
    'B X 200 G',
    'PACA X 48 BOLSA X 200 G',
    '48',
    1,
    NOW(),
    NOW()
);
```

Si aparece el error de clave primaria duplicada con valor `0`, revisar que el campo PK tenga `AUTO_INCREMENT` o que el insert no esté enviando un identificador inválido.

---

# PARTE II. SISTEMA DE INVENTARIOS PAE

## 10. Tablas principales creadas

- `BodegasInventario`
- `UbicacionesInventario`
- `TiposProductoInventario`
- `ProductosInventarioConfig`
- `ProductosCodigosBarras`
- `InventarioLotes`
- `InventarioExistencias`
- `TiposDocumentoInventario`
- `InventarioDocumentos`
- `InventarioDocumentoDetalle`
- `InventarioMovimientos`
- `InventarioMovimientosDetalle`
- `InventarioSolicitudes`
- `InventarioSolicitudesDetalle`
- `InventarioOperadores`
- `InventarioOperaciones`
- `InventarioOperacionesDetalle`
- `InventarioConteos`
- `InventarioConteosDetalle`

Antes de crear una tabla nueva, verificar si la funcionalidad ya corresponde a una de estas estructuras.

---

## 11. Estructura del menú de inventarios

El sidebar está organizado en secciones contraíbles.

### 11.1. Catálogos

- Bodegas
- Ubicaciones
- Tipos de producto
- Productos
- Códigos de barras

### 11.2. Operación

- Inventario inicial
- Entradas
- Salidas
- Traslados
- Ajustes de inventario

### 11.3. Control

- Existencias / Saldos
- Lotes y vencimientos
- Movimientos / Kardex
- Conteos físicos

### 11.4. Configuración

- Tipos de documento
- Operadores

### 11.5. Comportamiento del sidebar

- Inventarios y sus submenús pueden contraerse incluso cuando una página está activa.
- Al cerrar Inventarios, se cierran sus subsecciones.
- Al abrir una sección, se cierran las demás.
- Se eliminó el bloque inferior de usuario.
- Se dejó únicamente la opción de cerrar sesión.
- Ancho recomendado en escritorio: aproximadamente 320 px.
- Debe conservar buen comportamiento móvil.

---

## 12. Estado funcional de módulos

### 12.1. Catálogos

Finalizados y validados:

- Bodegas.
- Ubicaciones.
- Tipos de producto.
- Productos.
- Códigos de barras.

### 12.2. Operación

Finalizados o funcionales:

- Inventario inicial.
- Entradas.
- Salidas.

Pendientes de completar o documentar según avance real:

- Traslados.
- Ajustes de inventario.

### 12.3. Control

Finalizados y funcionando:

- Existencias / Saldos.
- Lotes y vencimientos.
- Movimientos / Kardex.

En desarrollo o último pendiente conocido:

- Conteos físicos.

### 12.4. Configuración

Finalizados:

- Tipos de documento.
- Operadores.

---

## 13. Entradas de inventario

### 13.1. Flujo

- Selección de bodega.
- Selección de ubicación.
- Selección de tipo de documento de naturaleza entrada.
- Fecha.
- Operador.
- Búsqueda de productos.
- Registro de cantidades.
- Manejo de lotes.
- Guardado como borrador.
- Edición de borrador.
- Finalización.

### 13.2. Estados

- `BORRADOR`
- `FINALIZADA`

### 13.3. Búsqueda de productos

La búsqueda debe funcionar por:

- código interno,
- nombre,
- código de barras asociado.

### 13.4. Lector de código de barras

- El flujo acepta lectura y confirmación mediante Enter.
- Después de encontrar el producto, la cantidad puede registrarse en modal.
- Los lotes son independientes por producto.

### 13.5. Regla de finalización

Finalizar una entrada debe:

- validar los datos,
- actualizar existencias,
- crear o actualizar lotes,
- generar movimiento de inventario,
- bloquear edición posterior salvo flujo autorizado.

---

## 14. Salidas de inventario

### 14.1. Estado

Módulo confirmado como terminado.

### 14.2. Tipos de documento

No debe depender de un código fijo. Debe cargar todos los tipos de documento activos que:

- tengan naturaleza `SALIDA`,
- afecten inventario.

### 14.3. Flujo

- Crear salida como borrador.
- Editar borrador.
- Buscar productos.
- Seleccionar lotes.
- Registrar cantidades.
- Finalizar.

### 14.4. Validación de existencia

Al finalizar:

- validar cantidad disponible,
- descontar stock,
- generar movimiento,
- evitar saldos negativos.

### 14.5. Lotes vencidos

Quedó planteada una mejora para que el tipo de documento defina si permite o no utilizar lotes vencidos, por ejemplo mediante un campo como:

- `permiteLoteVencido`

No implementar esta regla de forma rígida en frontend. Debe depender de configuración.

---

## 15. Inventario inicial

### 15.1. Regla funcional

Inventario inicial tiene pantalla propia. No debe reutilizarse como una entrada normal.

### 15.2. Flujo

- Seleccionar bodega habilitada para carga inicial.
- Seleccionar ubicación.
- Seleccionar tipo de documento correspondiente.
- Agregar productos.
- Registrar lote y fecha de vencimiento cuando aplique.
- Guardar.
- Finalizar.

### 15.3. Validaciones previas trabajadas

Se corrigieron problemas relacionados con:

- selección de tipo de documento,
- respuesta 409 al finalizar,
- uso de `mysqli_stmt::get_result()`,
- bodegas no disponibles para carga inicial,
- conexión a base de datos usando la ruta existente y no creando otra conexión.

### 15.4. Regla de disponibilidad

Una bodega puede quedar no disponible para inventario inicial si ya tiene existencias, movimientos o una carga inicial finalizada, según las validaciones implementadas.

---

## 16. Existencias / Saldos

Módulo terminado.

Debe permitir consultar la existencia actual por combinaciones de:

- producto,
- bodega,
- ubicación,
- lote,
- estado.

Cuando se consulte dónde ver existencias, esta es la pantalla principal.

Debe diferenciar, cuando aplique:

- cantidad total,
- cantidad disponible,
- cantidad reservada,
- cantidad bloqueada.

---

## 17. Reservas y bloqueos de inventario

### 17.1. Cantidad reservada

`cantidadReservada` se utiliza para mercancía comprometida por órdenes de salida o despacho generadas desde el consolidado de rutas.

Reglas:

- al generar la orden: baja `cantidadDisponible` y sube `cantidadReservada`,
- al finalizar o despachar: se descuenta de reservado,
- al cancelar: se libera la reserva.

### 17.2. Cantidad bloqueada

`cantidadBloqueada` se utiliza para:

- calidad,
- vencidos,
- daños,
- revisión,
- conteos físicos,
- otras restricciones operativas.

No confundir cantidad reservada con bloqueada.

---

## 18. Lotes y vencimientos

Módulo terminado.

Debe permitir:

- consultar lotes por producto,
- consultar fechas de vencimiento,
- identificar lotes vencidos o próximos a vencer,
- conocer bodega y ubicación,
- revisar saldo disponible del lote.

El sistema debe respetar trazabilidad por lote en entradas, salidas y movimientos.

---

## 19. Movimientos / Kardex

Módulo terminado.

Debe mostrar la trazabilidad histórica de cada producto:

- inventario inicial,
- entradas,
- salidas,
- traslados,
- ajustes,
- conteos,
- reservas,
- liberaciones,
- movimientos derivados.

El detalle debe permitir identificar:

- documento,
- fecha,
- tipo de movimiento,
- producto,
- bodega origen,
- bodega destino,
- lote,
- cantidad de entrada,
- cantidad de salida,
- saldo.

---

## 20. Conteos físicos

### 20.1. Ubicación

- Control → Conteos físicos.

### 20.2. Diseño funcional acordado

El flujo se divide en:

1. orden general de conteo creada por un administrativo,
2. conteos por bodega ejecutados por responsables operativos,
3. consolidado administrativo,
4. análisis de diferencias,
5. finalización.

### 20.3. Roles y permisos

#### Operativo de bodega

- Registra conteos.
- Envía el conteo.
- No exporta.
- No ve análisis consolidado durante revisión.
- Después de la finalización administrativa, puede consultar solo el resultado de su propia bodega.

#### Administrativo

- Crea la orden general.
- Define alcance.
- Consulta conteos por bodega.
- Ejecuta análisis.
- Revisa diferencias.
- Exporta.
- Finaliza.

### 20.4. Análisis

Debe mostrar por bodega:

- producto,
- código,
- existencia del sistema,
- cantidad contada,
- diferencia,
- observaciones.

Debe existir análisis:

- por bodega,
- general consolidado.

### 20.5. Exportación

La exportación administrativa debe incluir relación completa de inventario:

- producto,
- código,
- bodega,
- ubicación,
- lote,
- existencia sistema,
- conteo físico,
- diferencia,
- estado del análisis.

### 20.6. Experiencia de usuario en conteos

- Búsqueda visible por producto, código o lote.
- Filtros dentro de un botón independiente que abre modal.
- Botones principales: Consultar, Limpiar, Filtros.
- Título de pantalla compacto.
- Exportar Excel solo para administrativo.
- Uso desde dispositivo móvil como prioridad.
- Los nombres de archivos exportados deben ser descriptivos, no genéricos.

### 20.7. Errores conocidos trabajados

Se detectaron errores PHP `T_DOUBLE_ARROW` en:

- `InventarioOrdenesConteoCrear.php`
- `InventarioOrdenesConteoDetalle.php`
- `InventarioOrdenesConteoAnalisis.php`

También se detectó un problema de exportación/importación del componente:

- `ConteosFisicosInventario`

No asumir que estos errores continúan activos, pero revisar esas áreas si reaparecen.

---

# PARTE III. ESTILOS Y EXPERIENCIA DE USUARIO

## 21. Principios visuales

El proyecto utiliza una interfaz administrativa moderna, limpia y funcional.

Principios:

- Priorizar claridad sobre decoración.
- Evitar pantallas saturadas.
- Mantener jerarquía visual consistente.
- Usar espacios adecuados entre bloques.
- Títulos compactos, no excesivamente grandes.
- Formularios agrupados por intención.
- Acciones primarias claramente visibles.
- Acciones destructivas siempre diferenciadas.
- Mantener consistencia entre módulos.

---

## 22. Uso de Tailwind CSS

Los estilos se manejan principalmente con clases Tailwind.

Criterios:

- Cards con fondo blanco, bordes suaves, radios medianos y sombra ligera.
- Formularios con labels visibles y controles del mismo alto.
- Botones con estados `hover`, `focus` y `disabled`.
- Tablas responsivas con scroll horizontal cuando sea necesario.
- Modales centrados, con fondo superpuesto y cierre claro.
- Evitar estilos inline salvo casos muy puntuales.
- Reutilizar clases y componentes cuando un patrón se repita.

---

## 23. Estructura recomendada de pantallas

Una pantalla de listado normalmente debe tener:

1. encabezado,
2. título y descripción breve,
3. acción principal,
4. buscador visible,
5. filtros secundarios en modal o bloque contraíble,
6. tabla o tarjetas,
7. estados vacíos,
8. paginación si aplica,
9. mensajes de carga y error.

Una pantalla de formulario normalmente debe tener:

1. encabezado con acción de volver,
2. título,
3. datos generales,
4. detalle o productos,
5. resumen,
6. botones Guardar / Finalizar / Cancelar según estado.

---

## 24. Patrones de interacción

### 24.1. Búsqueda

- El buscador principal debe permanecer visible.
- Debe aceptar nombre, código interno y código de barras cuando el módulo lo soporte.
- No esconder la búsqueda principal dentro de un modal.

### 24.2. Filtros

- Los filtros extensos deben abrirse desde un botón `Filtros`.
- El modal de filtros debe permitir aplicar y limpiar.
- Los filtros activos deben reflejarse en la consulta.

### 24.3. Botones

Prioridad visual:

- Primario: Guardar, Crear, Finalizar, Consultar.
- Secundario: Editar, Ver detalle, Limpiar.
- Peligro: Eliminar, Anular, Cancelar definitivamente.

No colocar demasiados botones del mismo peso visual.

### 24.4. Modales

Usar modales para:

- agregar cantidades,
- seleccionar lotes,
- filtros avanzados,
- confirmaciones,
- mostrar detalles sin abandonar el flujo.

Evitar modales excesivamente largos. En móvil deben ocupar casi toda la pantalla y permitir scroll interno.

### 24.5. Estados de carga

Toda acción asíncrona debe mostrar estado:

- cargando,
- guardando,
- finalizando,
- exportando,
- procesando.

Deshabilitar el botón mientras se ejecuta para evitar dobles envíos.

### 24.6. Mensajes

Los mensajes deben ser concretos y accionables.

Ejemplos:

- “Entrada guardada como borrador.”
- “No hay existencia disponible para finalizar la salida.”
- “El código de barras no está asociado a ningún producto.”
- “Conteo enviado correctamente.”

No mostrar al usuario errores técnicos crudos de PHP o SQL.

---

## 25. Diseño responsive y móvil

El sistema debe ser usable desde computador, tableta y teléfono.

Criterios:

- En móvil, convertir tablas complejas en scroll horizontal o tarjetas cuando resulte más claro.
- Mantener botones principales accesibles.
- Evitar formularios con demasiadas columnas.
- Usar una sola columna en pantallas pequeñas.
- Los modales deben adaptarse al alto disponible.
- El flujo de conteos físicos debe estar especialmente optimizado para móvil.
- Los inputs de código de barras y cantidad deben ser rápidos de usar.

---

## 26. Nombres y lenguaje de interfaz

- Usar nombres funcionales y descriptivos.
- Evitar nombres genéricos en archivos exportados.
- Evitar textos demasiado técnicos.
- Mantener terminología uniforme.

Ejemplos correctos:

- `Conteo_Fisico_Bodega_Central_2026-07-26.xlsx`
- `Orden_Conteo_OCF-20260726-143628.xlsx`

Ejemplos a evitar:

- `archivo.xlsx`
- `exportacion.xlsx`
- `reporte1.xlsx`

---

# PARTE IV. MANUAL Y DOCUMENTACIÓN

## 27. Estructura acordada del manual de usuario

Manual general:

1. Introducción y alcance.
2. Acceso, navegación y reglas generales.
3. Catálogos: Bodegas, Ubicaciones, Tipos de producto, Productos y Códigos de barras.
4. Configuración: Tipos de documento y Operadores.
5. Operación: Entradas de inventario.
6. Operación: Inventario inicial.
7. Operación: Salidas.
8. Operación: Traslados.
9. Operación: Ajustes de inventario.
10. Control: Existencias / Saldos.
11. Control: Lotes y vencimientos.
12. Control: Movimientos / Kardex.
13. Control: Conteos físicos.
14. Buenas prácticas.
15. Glosario y listas de verificación.

También se solicitó una versión detallada, separada por carpetas, con un documento individual por cada ítem del sistema.

---

# PARTE V. FORMA DE CONTINUAR EL PROYECTO

## 28. Reglas de continuidad

Antes de modificar código:

1. Identificar el módulo exacto.
2. Revisar servicios y componentes relacionados.
3. Confirmar estructura de respuesta actual.
4. Mantener nombres de campos usados por frontend y backend.
5. Evitar crear tablas o servicios duplicados.
6. Conservar los flujos ya validados.
7. No simplificar reglas de negocio críticas.
8. Mantener experiencia visual consistente.
9. Probar borrador, edición, finalización, detalle y errores.
10. Verificar funcionamiento móvil.

---

## 29. Criterio de terminado

Un módulo solo se considera terminado cuando:

- el backend responde correctamente,
- el frontend consume correctamente,
- los estados están cubiertos,
- las validaciones funcionan,
- el flujo de borrador y finalización funciona cuando aplica,
- se actualizan existencias o movimientos correctamente,
- no hay errores de consola,
- no hay respuestas PHP rotas,
- los mensajes son claros,
- la interfaz es consistente,
- funciona en móvil,
- se documenta el módulo.

---

## 30. Prioridades actuales conocidas

1. Finalizar Conteos físicos.
2. Completar o validar Traslados.
3. Completar o validar Ajustes de inventario.
4. Mantener y ampliar documentación.
5. Integrar en el futuro inventarios con órdenes y consolidado de rutas.
6. Preparar la arquitectura para automatizaciones y agentes de IA sin romper el sistema actual.

---

## 31. Principio general del proyecto

La línea de trabajo del proyecto PAE ha sido construir módulos administrativos robustos, trazables, claros y progresivos. Se prioriza terminar cada flujo completo antes de abrir otro: base de datos, servicio, interfaz, validaciones, experiencia de usuario, exportación y documentación.

La continuidad debe respetar lo ya acordado y evitar reescribir módulos terminados sin una razón técnica concreta.
