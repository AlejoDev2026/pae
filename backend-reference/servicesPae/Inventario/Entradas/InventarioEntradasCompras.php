<?php
require_once __DIR__ . '/InventarioEntradasHelper.php';
require_once __DIR__ . '/EntradaCompraHelper.php';
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') inv_responder('no', 'Método no permitido', [], [], 405);
    ecPermiso($_POST);
    $id = (int)($_POST['idOrdenCompra'] ?? 0);
    if ($id > 0) {
        $orden = ecOrden($id);
        $orden['productos'] = ecProductos($id);
        inv_responder('si', 'Orden consultada.', $orden);
    }
    $q = '%' . trim((string)($_POST['busqueda'] ?? '')) . '%';
    $pagina = max(1, min(100000, (int)($_POST['pagina'] ?? 1)));
    $offset = ($pagina - 1) * 20;
    require_once __DIR__ . '/../OrdenesCompra/RecepcionCompraSql.php';
        $where = ' WHERE (numero LIKE ? OR proveedor LIKE ? OR nitProveedor LIKE ?) AND ' . ocPendienteSql('InventarioOrdenesCompra.id');
    $total = ecConsulta('SELECT COUNT(*) AS total FROM InventarioOrdenesCompra' . $where, [$q,$q,$q]);
    $ordenes = ecConsulta('SELECT id, numero, tipoDocumento, proveedor, fecha FROM InventarioOrdenesCompra' . $where . " ORDER BY id DESC LIMIT 20 OFFSET $offset", [$q,$q,$q]);
    inv_responder('si', 'Órdenes consultadas.', ['ordenes' => $ordenes, 'total' => (int)$total[0]['total'], 'pagina' => $pagina]);
} catch (Throwable $e) {
    error_log('RecepcionCompra: ' . $e->getMessage());
    inv_responder('no', $e instanceof InvalidArgumentException ? $e->getMessage() : 'No fue posible consultar las órdenes de compra.', [], [], 422);
}
