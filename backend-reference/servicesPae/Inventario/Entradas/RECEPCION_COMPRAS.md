# Recepción opcional desde una orden de compra

## Publicación

1. Aplicar primero la migración de compras `2026-09-07_ordenes_compra.sql` si no está instalada.
2. Aplicar `backend-reference/database/migrations/2026-09-07_entradas_ordenes_compra.sql`.
3. Publicar estos archivos en `servicesPae/Inventario/Entradas/`:
   - `EntradaCompraHelper.php` (nuevo).
   - `InventarioEntradasCompras.php` (nuevo).
   - `InventarioEntradasGuardar.php`.
   - `InventarioEntradasDetalle.php`.
   - `InventarioEntradasFinalizar.php`.
   - `InventarioEntradasHelper.php`.
4. Compilar y publicar frontend por el procedimiento habitual.

Las tablas nuevas `InventarioEntradaCompra` y `InventarioEntradaCompraDetalle` vinculan documentos y renglones de entrada con compras. Sus claves primarias son los identificadores existentes del documento/detalle: no generan PK nuevas. No se modifica el esquema de las tablas de entradas. La importación de compras sigue usando `compras.cargar`; la consulta para recibir y las modificaciones de recepciones usan sesión autenticada y `inventario.operacion.gestionar`. No se asignan nuevos roles.

## Uso

En Nueva entrada, **Orden de compra** sustituye el botón textual Volver; la flecha junto al título sigue disponible. Seleccionar una compra es opcional. El modal busca por número, proveedor o NIT y muestra los renglones con cantidad pedida, recibida en PAE y pendiente.

**Cargar productos** requiere que cada renglón pendiente tenga una coincidencia única, exacta y activa de `codigo` en `ProductosCatalogo` y configuración activa en `ProductosInventarioConfig`. No se usa semejanza de nombres ni se crean productos. Si faltan coincidencias, se indican en el modal y se bloquea la carga para corregir el catálogo primero.

El detalle inicializa cantidad recibida en cero. Se eligen bodega y ubicación manualmente, y se asignan o crean lotes con el flujo existente. **Otro lote** duplica el renglón manteniendo el vínculo de compra y dejando cantidad cero y lote vacío. La suma de todos los lotes de un mismo renglón no puede superar su pendiente. UBI de origen no se interpreta como bodega o ubicación interna.

Al guardar, las líneas en cero se omiten: permanecen pendientes en la compra. Se exige una cantidad recibida positiva y lote/vencimiento cuando la configuración del producto lo requiere. La unidad mostrada procede de la configuración de inventario: el CSV no trae una unidad estructurada y no se aplica conversión automática.

Se permite una compra por entrada. Para seleccionar otra, retirar primero los productos actuales. Si el detalle queda vacío, se ofrece continuar como entrada manual. No se agregan productos manuales a una recepción vinculada; deben registrarse en otra entrada.

## Persistencia y concurrencia

- `tipoOrigen = ORDEN_COMPRA` identifica una entrada vinculada.
- Guardado y edición actualizan los vínculos dentro de la transacción existente.
- El detalle devuelve `documento.ordenCompra` y, por línea, `idOrdenCompraDetalle`, `cantidadPedida` y `cantidadPendiente`, para conservar el vínculo al reabrir un borrador.
- Los pendientes descuentan solamente entradas FINALIZADAS. Los borradores no reservan compra; al finalizar se vuelve a comprobar el pendiente bajo bloqueo de la orden. Si otra recepción consumió el saldo, la finalización se rechaza y revierte la transacción.
- Las cantidades del pedido no sustituyen `cantidadSolicitada` de la entrada: ese campo mantiene su significado operativo existente (cantidad que ingresará al finalizar).
- El estado PARCIAL/CERRADO del CSV se conserva como dato externo; no permite deducir recepciones históricas fuera de PAE. Este flujo controla exclusivamente lo recibido mediante entradas finalizadas vinculadas en PAE.

## Verificación

Pruebas locales ejecutadas: sintaxis PHP 7.3, compilación Vite, modal en navegador con servicios simulados, pantalla a 1440/768/390 px, cantidades iniciales cero, división de lotes y payload de recepción parcial vinculado.

Reglas del backend probadas con doble de conexión:

```text
php backend-reference/servicesPae/Inventario/Entradas/tests/EntradaCompraValidacionTest.php
```

Verifica saldo pendiente, suma entre lotes, renglón ajeno, producto ajeno, cantidades cero/negativas/no numéricas y precisión. No sustituye MySQL: falta validar en un entorno configurado la aplicación de la migración, guardado/reapertura, lotes, rollback, permisos y dos finalizaciones concurrentes. No se ejecutaron escrituras en producción.
