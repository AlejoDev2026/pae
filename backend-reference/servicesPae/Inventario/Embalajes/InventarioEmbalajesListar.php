<?php
declare(strict_types=1);
require_once __DIR__ . '/_conexion.php';
embalajesCors();

try {
    $conexion = embalajesConexion();
    $q = trim((string)($_GET['q'] ?? ''));
    $estado = $_GET['estado'] ?? '';
    $where = [];
    $params = [];
    $types = '';
    if ($q !== '') {
        $where[] = '(e.producto_base LIKE ? OR e.presentacion LIKE ? OR e.embalaje LIKE ? OR e.`uni/caja` LIKE ?)';
        $like = "%{$q}%";
        $params = [$like, $like, $like, $like];
        $types = 'ssss';
    }
    if ($estado !== '' && in_array((int)$estado, [0, 1], true)) {
        $where[] = 'e.estado = ?';
        $params[] = (int)$estado;
        $types .= 'i';
    }
    $sql = 'SELECT e.id, e.producto_base AS productoBase, e.presentacion, e.embalaje, e.`uni/caja` AS uniCaja, e.estado, e.created_at, e.updated_at, COUNT(p.id) AS productosVinculados FROM EmbalajeCatalogo e LEFT JOIN ProductosCatalogo p ON p.idEmbalaje = e.id';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' GROUP BY e.id, e.producto_base, e.presentacion, e.embalaje, e.`uni/caja`, e.estado, e.created_at, e.updated_at ORDER BY e.producto_base, e.presentacion, e.embalaje';
    $stmt = $conexion->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $stmt->store_result();
    $stmt->bind_result($id, $productoBase, $presentacion, $embalaje, $uniCaja, $estadoFila, $createdAt, $updatedAt, $productosVinculados);
    $data = [];
    while ($stmt->fetch()) {
        $data[] = [
            'id' => (int)$id,
            'productoBase' => $productoBase,
            'presentacion' => $presentacion,
            'embalaje' => $embalaje,
            'uniCaja' => $uniCaja,
            'estado' => (int)$estadoFila,
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
            'productosVinculados' => (int)$productosVinculados
        ];
    }
    embalajesJson(200, ['rpta' => 'si', 'mensaje' => 'Embalajes consultados correctamente.', 'data' => $data]);
} catch (Throwable $e) {
    error_log('InventarioEmbalajesListar: ' . $e->getMessage());
    embalajesJson(500, ['rpta' => 'no', 'mensaje' => 'No fue posible consultar los embalajes.']);
}
