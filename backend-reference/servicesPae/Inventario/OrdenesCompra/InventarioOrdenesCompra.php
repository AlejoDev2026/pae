<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
date_default_timezone_set('America/Bogota');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function ocResponder($codigo, $rpta, $mensaje, $data = [])
{
    http_response_code($codigo);
    echo json_encode(['rpta' => $rpta, 'mensaje' => $mensaje, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function ocEjecutar($conexion, $sql, $valores = [])
{
    $stmt = $conexion->prepare($sql);
    if ($valores) {
        $refs = [];
        foreach ($valores as &$valor) $refs[] = &$valor;
        unset($valor);
        $stmt->bind_param(str_repeat('s', count($valores)), ...$refs);
    }
    $stmt->execute();
    return $stmt;
}

function ocFilas($stmt)
{
    $meta = $stmt->result_metadata();
    $fila = []; $refs = []; $salida = [];
    foreach ($meta->fetch_fields() as $campo) {
        $fila[$campo->name] = null;
        $refs[] = &$fila[$campo->name];
    }
    $stmt->bind_result(...$refs);
    while ($stmt->fetch()) {
        $copia = [];
        foreach ($fila as $campo => $valor) $copia[$campo] = $valor;
        $salida[] = $copia;
    }
    $meta->free();
    $stmt->close();
    return $salida;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') ocResponder(405, 'no', 'Utiliza POST para esta operación.');
$transaccion = false;
try {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    require_once __DIR__ . '/../conexion.php';
    require_once __DIR__ . '/../../auth/permisos.php';
    require_once __DIR__ . '/OrdenCompraCsv.php';
    $usuario = exigirPermiso($conexion, 'compras.cargar');
    $accion = $_POST['accion'] ?? '';
    if ($accion === 'listar') {
        $busqueda = trim((string)($_POST['busqueda'] ?? ''));
        if (strlen($busqueda) > 200) throw new InvalidArgumentException('La búsqueda es demasiado larga.');
        $pagina = max(1, min(100000, (int)($_POST['pagina'] ?? 1)));
        $offset = ($pagina - 1) * 20;
        $like = '%' . $busqueda . '%';
        require_once __DIR__ . '/../OrdenesCompra/RecepcionCompraSql.php';
        $where = ' WHERE (numero LIKE ? OR proveedor LIKE ? OR nitProveedor LIKE ?) AND ' . ocPendienteSql('InventarioOrdenesCompra.id');
        $total = ocFilas(ocEjecutar($conexion, 'SELECT COUNT(*) AS total FROM InventarioOrdenesCompra' . $where, [$like, $like, $like]));
        $filas = ocFilas(ocEjecutar($conexion,
            'SELECT id, tipoDocumento, numero, proveedor, nitProveedor, fecha, estadoOrigen, total, created_at
             FROM InventarioOrdenesCompra' . $where . " ORDER BY id DESC LIMIT 20 OFFSET $offset", [$like, $like, $like]));
        ocResponder(200, 'si', 'Órdenes consultadas.', ['ordenes' => $filas, 'total' => (int)$total[0]['total'], 'pagina' => $pagina]);
    }
    if ($accion === 'detalle') {
        $id = filter_var($_POST['id'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$id) throw new InvalidArgumentException('Selecciona una orden válida.');
        // Excluir el archivo binario de la respuesta JSON.
        $campos = 'id, empresa, nitEmpresa, direccionEmpresa, tipoDocumento, numero, estadoOrigen, fecha, vencimiento,
            impresion, proveedor, nitProveedor, telefono, ciudad, observacion, subtotal, descuento, subtotalDescuento,
            iva, retefuente, reteica, reteiva, retecree, total, archivoNombre, idUsuarioRegistro, created_at';
        $filas = ocFilas(ocEjecutar($conexion, "SELECT $campos FROM InventarioOrdenesCompra WHERE id = ?", [$id]));
        if (!$filas) ocResponder(404, 'no', 'No se encontró la orden.');
        $orden = $filas[0];
        $orden['productos'] = ocFilas(ocEjecutar($conexion,
            'SELECT renglon, filaArchivo, codigo, ubicacionOrigen, descripcion, costo, peso, cantidad, valorUnitario, valorTotal
             FROM InventarioOrdenesCompraDetalle WHERE idOrdenCompra = ? ORDER BY renglon', [$id]));
        ocResponder(200, 'si', 'Orden consultada.', $orden);
    }
    if (!in_array($accion, ['previsualizar', 'importar'], true)) throw new InvalidArgumentException('La operación no es válida.');
    $archivo = $_FILES['archivo'] ?? null;
    if (!$archivo || $archivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])) {
        throw new InvalidArgumentException('No se pudo recibir el CSV. Selecciónalo nuevamente y verifica el límite de carga.');
    }
    if (strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION)) !== 'csv' || $archivo['size'] > 5 * 1024 * 1024) {
        throw new InvalidArgumentException('Selecciona un archivo .csv de hasta 5 MB.');
    }
    $contenido = file_get_contents($archivo['tmp_name']);
    $orden = ocLeerCsv($contenido);
    $hash = hash('sha256', $contenido);
    $duplicados = ocFilas(ocEjecutar($conexion,
        'SELECT id FROM InventarioOrdenesCompra WHERE (nitEmpresa = ? AND tipoDocumento = ? AND numero = ?) OR archivoHash = ? LIMIT 1',
        [$orden['nitEmpresa'], $orden['tipoDocumento'], $orden['numero'], $hash]));
    if ($duplicados) ocResponder(409, 'no', 'Esta orden de compra ya está cargada. Puedes consultarla en el listado.', ['id' => $duplicados[0]['id']]);
    if ($accion === 'previsualizar') ocResponder(200, 'si', 'Archivo validado. Revisa los datos antes de guardar.', $orden);
    // Releer y validar el archivo también al guardar: no confiar en el JSON de la vista previa.
    $conexion->begin_transaction();
    $transaccion = true;
    $cabecera = $orden;
    unset($cabecera['productos'], $cabecera['advertencias']);
    $cabecera['archivoNombre'] = ocTexto(basename($archivo['name']), 255, 'nombre del archivo');
    $cabecera['archivoHash'] = $hash;
    $cabecera['archivoContenido'] = $contenido;
    $cabecera['idUsuarioRegistro'] = $usuario['id'];
    // Las claves proceden exclusivamente del lector del servidor.
    $columnas = implode(', ', array_keys($cabecera));
    $marcas = implode(', ', array_fill(0, count($cabecera), '?'));
    ocEjecutar($conexion, "INSERT INTO InventarioOrdenesCompra ($columnas) VALUES ($marcas)", array_values($cabecera))->close();
    $id = $conexion->insert_id;
    foreach ($orden['productos'] as $producto) {
        $producto = ['idOrdenCompra' => $id] + $producto;
        $columnas = implode(', ', array_keys($producto));
        $marcas = implode(', ', array_fill(0, count($producto), '?'));
        ocEjecutar($conexion, "INSERT INTO InventarioOrdenesCompraDetalle ($columnas) VALUES ($marcas)", array_values($producto))->close();
    }
    $conexion->commit();
    $transaccion = false;
    ocResponder(201, 'si', 'Orden de compra cargada correctamente.', ['id' => $id, 'productos' => count($orden['productos'])]);
} catch (InvalidArgumentException $e) {
    if ($transaccion) $conexion->rollback();
    ocResponder(422, 'no', $e->getMessage());
} catch (Throwable $e) {
    if ($transaccion) $conexion->rollback();
    if ((int)$e->getCode() === 1062) ocResponder(409, 'no', 'Esta orden de compra ya está cargada.');
    error_log('OrdenesCompra: ' . $e->getMessage());
    ocResponder(500, 'no', 'No fue posible procesar la orden. Intenta nuevamente o consulta al administrador.');
}
