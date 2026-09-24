<?php
// Reutiliza la conexión y validaciones del módulo de entradas.
function ecConsulta($sql, $valores = []) {
    global $conexion;
    $stmt = $conexion->prepare($sql);
    if (!$stmt) throw new RuntimeException('No fue posible consultar la recepción de compra.');
    if ($valores) $stmt->bind_param(str_repeat('s', count($valores)), ...$valores);
    if (!$stmt->execute()) throw new RuntimeException('No fue posible procesar la recepción de compra.');
    $meta = $stmt->result_metadata();
    $salida = [];
    if ($meta) {
        $fila = []; $refs = [];
        foreach ($meta->fetch_fields() as $campo) { $fila[$campo->name] = null; $refs[] = &$fila[$campo->name]; }
        $stmt->bind_result(...$refs);
        while ($stmt->fetch()) { $copia = []; foreach ($fila as $k => $v) $copia[$k] = $v; $salida[] = $copia; }
        $meta->free();
    }
    $stmt->close(); return $salida;
}
function ecPermiso($input) {
    global $conexion;
    require_once __DIR__ . '/../../auth/permisos.php';
    $_POST['correoSesion'] = $input['correoSesion'] ?? '';
    $_POST['tokenSesion'] = $input['tokenSesion'] ?? '';
    return exigirPermiso($conexion, 'inventario.operacion.gestionar');
}
function ecOrden($id, $bloquear = false) {
    $filas = ecConsulta('SELECT id, numero, tipoDocumento, proveedor FROM InventarioOrdenesCompra WHERE id = ?' . ($bloquear ? ' FOR UPDATE' : ''), [$id]);
    if (!$filas) throw new InvalidArgumentException('La orden de compra no existe.');
    return $filas[0];
}
function ecProductos($id) {
    $filas = ecConsulta('SELECT d.* FROM InventarioOrdenesCompraDetalle d WHERE d.idOrdenCompra = ? ORDER BY d.renglon', [$id]);
    foreach ($filas as &$fila) {
        $productos = ecConsulta('SELECT pc.id AS idProducto, pc.codigo, pc.descripcion, pic.unidadBaseInventario AS unidad,
          pic.manejaLote, pic.manejaVencimiento FROM ProductosCatalogo pc
          INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id AND pic.estado = 1
          WHERE BINARY pc.codigo = BINARY ? AND pc.estado = 1 AND COALESCE(pc.idEstado, 1) = 1', [$fila['codigo']]);
        $fila['producto'] = count($productos) === 1 ? $productos[0] : null;
        $recibido = ecConsulta("SELECT COALESCE(SUM(dd.cantidadSolicitada),0) AS cantidad FROM InventarioEntradaCompraDetalle r
          INNER JOIN InventarioDocumentoDetalle dd ON dd.id = r.idDocumentoDetalle
          INNER JOIN InventarioDocumentos doc ON doc.id = r.idDocumento WHERE r.idOrdenCompraDetalle = ? AND doc.estadoProceso = 'FINALIZADA'", [$fila['id']]);
        $fila['cantidadRecibida'] = (float)$recibido[0]['cantidad'];
        $fila['cantidadPendiente'] = max(0, (float)$fila['cantidad'] - $fila['cantidadRecibida']);
    }
    unset($fila); return $filas;
}
function ecValidar($idOrden, $detalles) {
    // Serializa todas las recepciones de la misma compra dentro de la transacción existente.
    ecOrden($idOrden, true);
    $sumas = [];
    foreach ($detalles as $d) {
        $id = (int)($d['idOrdenCompraDetalle'] ?? 0);
        $lineas = ecConsulta('SELECT codigo, cantidad FROM InventarioOrdenesCompraDetalle WHERE id = ? AND idOrdenCompra = ?', [$id, $idOrden]);
        $p = inv_obtener_producto_inventario((int)($d['idProducto'] ?? 0));
        if (!$lineas || !$p || $p['codigo'] !== $lineas[0]['codigo']) throw new InvalidArgumentException('Un producto no corresponde a la orden de compra seleccionada.');
        $cantidad = $d['cantidad'] ?? 0;
        if (!is_numeric($cantidad) || !is_finite((float)$cantidad) || (float)$cantidad <= 0 || abs((float)$cantidad - round((float)$cantidad, 3)) > 0.0000001) throw new InvalidArgumentException('La cantidad recibida debe ser positiva y tener máximo tres decimales.');
        $sumas[$id] = ($sumas[$id] ?? 0) + (float)$cantidad;
        // Lectura actual, incluso si esta transacción esperó el bloqueo de otra recepción.
        $anteriores = ecConsulta("SELECT dd.cantidadSolicitada FROM InventarioEntradaCompraDetalle r
          INNER JOIN InventarioDocumentoDetalle dd ON dd.id = r.idDocumentoDetalle
          INNER JOIN InventarioDocumentos doc ON doc.id = r.idDocumento
          WHERE r.idOrdenCompraDetalle = ? AND doc.estadoProceso = 'FINALIZADA' FOR UPDATE", [$id]);
        $recibido = array_sum(array_column($anteriores, 'cantidadSolicitada'));
        if (round($recibido + $sumas[$id], 3) > (float)$lineas[0]['cantidad']) throw new InvalidArgumentException('La cantidad recibida supera el pendiente de la orden de compra. Actualiza la consulta.');
    }
}
