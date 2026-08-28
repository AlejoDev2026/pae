# Ordenes de alistamiento

Modulo que convierte el informe consolidado **Total jornada / contrato** de un
despacho clasico en una orden operativa de inventario. El origen se conserva por
`idDespachoInforme`; no se generan ordenes para despachos Roldanillo.

## Flujo funcional

1. El responsable genera una sola orden consolidada desde el informe del
   despacho. La generacion copia el producto, presentacion, embalaje, PAC, UND y
   cantidad solicitada, y reserva existencias reales por bodega, ubicacion y lote
   usando FEFO.
2. El responsable asigna la orden a un operador activo de inventario.
3. El operador inicia el alistamiento y registra el total acumulado encontrado en
   cada posicion. Puede registrar menos, igual o mas que lo solicitado.
4. Si registra una cantidad superior, el servicio intenta reservar primero en la
   posicion seleccionada y despues completa el excedente con otras existencias
   reales disponibles del producto. Nunca permite saldo negativo y la respuesta
   devuelve las posiciones creadas para que la pantalla las muestre de inmediato.
5. El operador finaliza la orden completa o con pendientes. Una orden parcial
   conserva la trazabilidad de lo encontrado y de lo que continua pendiente.
6. El responsable envia a Logistica las cantidades realmente alistadas. Se crea
   una salida `SALIDA_LOGISTICA` finalizada por cada bodega de origen y se
   actualizan reserva, existencias, lotes y movimientos en la misma transaccion.
7. Si hubo faltantes, primero se envia a Logistica lo ya alistado y luego se
   pueden reasignar las cantidades pendientes a otro operador.

Las cantidades de la orden son acumuladas:

- `cantidadSolicitada`: total proveniente del informe.
- `cantidadReservada`: inventario que fue reservado para la orden.
- `cantidadAlistada`: total fisicamente confirmado por operadores.
- `cantidadEnviada`: total que ya salio de inventario hacia Logistica.

## Servicios

Todos usan la conexion comun del proyecto, responden JSON y validan el token
Bearer contra `usuarios.tokenSesion`.

- `InventarioOrdenesAlistamientoGenerar.php`: genera la orden consolidada y sus
  reservas iniciales. Solo administrador.
- `InventarioOrdenesAlistamientoListar.php`: listado y resumen administrativo.
- `InventarioOrdenesAlistamientoFormData.php`: estados y operadores disponibles.
- `InventarioOrdenesAlistamientoDetalle.php`: cabecera, productos, posiciones,
  capacidades e historial de envios.
- `InventarioOrdenesAlistamientoAsignar.php`: asignacion inicial.
- `InventarioOrdenesAlistamientoReasignarPendientes.php`: nueva asignacion de los
  saldos pendientes cuando lo ya alistado fue enviado a Logistica.
- `InventarioOrdenesAlistamientoMisOrdenes.php`: ordenes del operador autenticado.
- `InventarioOrdenesAlistamientoIniciar.php`: inicia la asignacion vigente.
- `InventarioOrdenesAlistamientoGuardarAvance.php`: guarda cantidades acumuladas
  por reserva y gestiona excedentes respaldados por inventario.
- `InventarioOrdenesAlistamientoFinalizar.php`: finaliza completa o con
  pendientes y libera reservas que ya no correspondan.
- `InventarioOrdenesAlistamientoEnviarLogistica.php`: genera las salidas y
  movimientos por bodega para la cantidad alistada no enviada.
- `InventarioOrdenesAlistamientoAnular.php`: anula antes de cualquier envio y
  libera las reservas.
- `InventarioOrdenesAlistamientoHistorial.php`: consulta la auditoria funcional.
- `InventarioOrdenesAlistamientoHelper.php`: seguridad, consultas y reglas
  compartidas.

El rol administrativo predeterminado es `1`. Puede ampliarse en el servidor con
la constante PHP `INVENTARIO_ROLES_ADMIN_ALISTAMIENTO` sin reducir las
validaciones de backend.

## Estados principales

Alistamiento:

`PENDIENTE_ASIGNACION -> ASIGNADA -> EN_ALISTAMIENTO -> ALISTADA_COMPLETA`

Cuando quedan faltantes:

`EN_ALISTAMIENTO -> ALISTADA_CON_PENDIENTES -> ASIGNADA -> EN_ALISTAMIENTO`

No se permite una reasignacion administrativa forzada mientras la orden esta
`EN_ALISTAMIENTO`: el operador vigente debe finalizarla, incluso con pendientes,
para cerrar su responsabilidad fisica antes de asignar el saldo a otra persona.

Logistica:

`PENDIENTE -> EN_LOGISTICA_PARCIAL -> EN_LOGISTICA`

## Instalacion

1. Respaldar la base de datos y probar primero en una copia de homologacion.
2. Verificar con `SHOW TABLE STATUS` que `InventarioExistencias`,
   `InventarioDocumentos`, `InventarioDocumentoDetalle`,
   `InventarioDocumentoDetalleLotes`, `InventarioMovimientos` y las tablas
   catalogo relacionadas usan InnoDB. Las reservas, bloqueos y reversiones
   transaccionales no son seguras sobre MyISAM.
3. Ejecutar
   `backend-reference/database/migrations/2026-08-04_inventario_ordenes_alistamiento.sql`.
4. Publicar esta carpeta de servicios. El codigo evita sintaxis posterior a
   PHP 7.3 para conservar compatibilidad con el cPanel documentado.
5. Publicar el frontend compilado.
6. Probar generacion, asignacion, 10 solicitado/11 alistado, faltante parcial,
   reasignacion y envio desde mas de una bodega.

La migracion se entrega preparada, pero no se ejecuta automaticamente desde el
codigo. MySQL/MariaDB confirma las sentencias DDL de forma individual; por eso el
respaldo previo es obligatorio.

## Reversion

El tag Git `punto-0` permite volver al codigo anterior al modulo. Esa reversion
no elimina datos de base de datos.

Antes de usar el modulo con movimientos reales, las tablas nuevas se pueden
retirar manualmente en orden inverso de dependencias. Despues de generar salidas
o movimientos, no debe hacerse un borrado automatico: se requiere conciliacion
de inventario y una reversion documental auditada para conservar el Kardex.
