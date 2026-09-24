# Carga de órdenes de compra por CSV

## Alcance

La importación permite cargar, previsualizar, guardar y consultar una orden con todos sus renglones. No crea entradas, lotes, movimientos, productos ni existencias. La recepción opcional desde Entradas está implementada por separado; ver `../Entradas/RECEPCION_COMPRAS.md` para publicar su migración y servicios. La distribución de tareas entre dos roles queda pendiente.

Órdenes de compra es un módulo independiente con acceso en el menú principal, fuera de Inventarios. El frontend vive en `src/pages/OrdenesCompra/`: `OrdenesCompraInventario.jsx` mantiene el identificador público compatible y coordina las vistas; `ListadoOrdenesCompra.jsx` presenta el listado con el patrón de Despachos (buscador, botón Cargar orden, encabezado gris, filas separadas, Ver detalle y tarjetas en móvil/tableta). Al entrar se muestran las órdenes cargadas; el formulario CSV solo se abre mediante Cargar orden. Al guardar se vuelve al listado actualizado. El servicio PHP conserva su ruta publicada.

Se revisaron `CONTEXTO_PROYECTO_PAE.md`, el esquema `database/accionpo_pae.sql`, las migraciones existentes y el flujo de Entradas. No existe una estructura de compras en esos archivos. `InventarioDocumentos` representa documentos operativos con productos internos y estados propios; no permite conservar directamente la información del CSV. Por eso esta entrega incorpora explícitamente dos tablas nuevas, definidas en la migración, sin asumir que ya existen en producción:

- `InventarioOrdenesCompra`: encabezado, proveedor, importes, observación, usuario autenticado, fecha de carga y archivo original.
- `InventarioOrdenesCompraDetalle`: renglones ordenados, código externo, UBI de origen, descripción y cantidades/importes.

## Publicación

1. Verificar que la migración `2026-09-01_roles_permisos.sql` ya esté aplicada.
2. Ejecutar `backend-reference/database/migrations/2026-09-07_ordenes_compra.sql` en la base de datos del entorno destino. Las dos PK se crean con `AUTO_INCREMENT`; las tablas son InnoDB. MySQL confirma DDL de forma implícita: no envolver la publicación de tablas en una supuesta transacción reversible.
3. Publicar `InventarioOrdenesCompra.php` y `OrdenCompraCsv.php` en `servicesPae/Inventario/OrdenesCompra/`, preservando las rutas relativas a la conexión y a `auth/permisos.php`. La carpeta `tests` no necesita publicarse.
4. Compilar y publicar el frontend mediante el procedimiento habitual del proyecto.
5. Acceder como administrador a **Órdenes de compra** en el menú principal. Desde el listado, pulsar **Cargar orden**, revisar el CSV y guardar.
6. Consultar la orden, comprobar su detalle y volver a cargar el mismo archivo: debe informar que ya existe. Comprobar también con otro nombre de archivo y con solicitudes simultáneas.

El permiso nuevo es `compras.cargar`. Se valida en servidor para todas las acciones y se usa para filtrar el menú. No se asigna automáticamente a los roles operativos. El administrador accede mediante el mecanismo existente; los dos roles se asignarán posteriormente.

Requiere PHP con mysqli e iconv y el modelo de sesión vigente. No utiliza `mysqli_stmt::get_result()`. El servidor debe admitir el tamaño multipart elegido (`upload_max_filesize`, `post_max_size` y `max_allowed_packet`); el servicio limita cada CSV a 5 MB.

## Contrato del servicio

Todas las acciones usan POST multipart con `correoSesion`, `tokenSesion` y `accion`:

- `previsualizar`: agrega `archivo`; devuelve `data` con encabezado, `productos` y `advertencias`.
- `importar`: agrega el mismo archivo; vuelve a leerlo y validarlo en backend y devuelve `data.id` y `data.productos` (conteo). No acepta un encabezado/detalle generado por el cliente.
- `listar`: recibe `busqueda` y `pagina`; devuelve `data.ordenes`, `data.total`, `data.pagina`, con 20 órdenes por página.
- `detalle`: recibe `id`; devuelve el encabezado y todos sus productos, excluyendo el CSV binario.

Respuestas: `rpta: si/no`, `mensaje`, `data`. Un duplicado devuelve 409; archivo inválido, 422; sesión ausente o sin permiso, 401/403. OPTIONS devuelve 204. Los fallos internos se registran sin enviar SQL al cliente.

## Interpretación del formato

- Separador `;`, campos entre comillas, líneas vacías, UTF-8 con/sin BOM y Windows-1252.
- Se reconocen etiquetas del encabezado y de totales. El lector no usa números fijos de fila.
- El encabezado de productos debe contener, en orden: ITEM, UBI, DESCRIPCION, COSTO, PESO, CANTIDAD, VR.UNITARIO, VR.TOTAL.
- Las filas de productos contienen esos ocho valores no vacíos en ese orden, aunque sus posiciones físicas no coincidan con las del encabezado impreso. Los ceros son valores válidos para peso/importes; la cantidad debe ser positiva.
- El lector recorre todos los renglones hasta los totales. Admite encabezados repetidos de la misma orden entre páginas. No deduplica renglones por código: el mismo código puede aparecer varias veces en el documento y cada línea conserva su identidad.
- Los números usan coma de miles y punto decimal, como el archivo proporcionado. Se rechazan formatos ambiguos, campos faltantes y contenido desconocido en lugar de omitirlo.
- Se requiere coincidencia de suma de importes de productos con subtotal, con tolerancia de 0,02. La diferencia entre cantidad × precio y el importe de una línea se muestra como advertencia, conservando el dato de origen.
- Una importación corresponde a una orden completa. Variantes con columnas adicionales, subtotales parciales por página o descripciones repartidas en varias filas requieren otro archivo de ejemplo y ajuste explícito del lector.

## Decisiones para la siguiente etapa

- La clave documental asumida es NIT de la empresa + tipo + número. Si el sistema origen reinicia numeración cada año, revisar esta regla con documentos reales antes de habilitar ese caso.
- La restricción única documental y la de SHA-256 evitan recargas incluso concurrentes. Una recarga no actualiza ni reemplaza una orden existente.
- La cabecera y todos sus productos se insertan en una sola transacción; cualquier fallo revierte ambos.
- ITEM queda como código externo. No se vincula por similitud de nombre ni se crean productos automáticamente.
- UBI queda como dato de origen; no se interpreta como ID de bodega.
- COSTO y VR.UNITARIO se conservan por separado. La base del costo de recepción aún requiere definición.
- PARCIAL es el estado del sistema origen, no evidencia de cantidades recibidas en PAE.
- VENCIMIENTO es del documento, no del producto. INGRESO JAMUNDI permanece en la observación.
- No se asume moneda ni unidad física más allá del texto original.

## Verificación local

Corrección de compatibilidad: `fgetcsv` solo acepta escape vacío desde PHP 7.4. En PHP 7.3 el lector original devolvía `false` antes de leer la primera fila y terminaba mostrando que faltaba la empresa. El lector usa ahora NUL como escape para PHP anterior a 7.4 (la entrada ya rechaza bytes NUL), conservando barras literales y comillas CSV. También distingue errores de lectura del fin normal del archivo. Para publicar esta corrección solo se reemplaza `OrdenCompraCsv.php`; no requiere cambios de SQL ni frontend. Regresión ejecutada en PHP 7.3.33 y 8.3.33 con el CSV real y 300 productos sintéticos.

Ejecutar con PHP CLI:

```text
php backend-reference/servicesPae/Inventario/OrdenesCompra/tests/OrdenCompraCsvTest.php
php backend-reference/servicesPae/Inventario/OrdenesCompra/tests/OrdenCompraCsvTest.php "C:/Users/User/Downloads/orden de compra.csv"
```

Las pruebas convierten warnings en errores y verifican el archivo real, 300 productos, encabezados repetidos, ceros, fechas, BOM, Windows-1252, CRLF, campos entre comillas, campos ausentes, subtotal incompleto y dos órdenes distintas.

Verificado localmente: PHP 8.3 (sintaxis y pruebas del lector), compilación Vite y ESLint del componente nuevo y mapa de permisos. Prueba de navegador con servicios simulados: montaje en StrictMode, vista previa de 300 productos, paginación, búsqueda, guardado, consulta del detalle y respuesta JSON inválida, sin errores de ejecución; revisión responsive a 1440, 768 y 390 px sin desbordamiento horizontal de la página.

La publicación y las pruebas de transacción, persistencia, concurrencia y permisos con MySQL real deben realizarse en un entorno configurado; no se han ejecutado escrituras en producción desde esta entrega.
