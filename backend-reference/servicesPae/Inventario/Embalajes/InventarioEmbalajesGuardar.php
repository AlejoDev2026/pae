<?php
declare(strict_types=1);
require_once __DIR__ . '/_conexion.php';
embalajesCors();

try {
    $input = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($input)) embalajesJson(400, ['rpta' => 'no', 'mensaje' => 'No se recibieron datos válidos.']);
    $id = (int)($input['id'] ?? 0);
    $productoBase = trim((string)($input['productoBase'] ?? ''));
    $presentacion = trim((string)($input['presentacion'] ?? ''));
    $embalaje = trim((string)($input['embalaje'] ?? ''));
    $uniCaja = trim((string)($input['uniCaja'] ?? ''));
    $estado = isset($input['estado']) ? (int)$input['estado'] : 1;
    if ($productoBase === '' || $uniCaja === '') embalajesJson(422, ['rpta' => 'no', 'mensaje' => 'El producto base y las unidades por caja son obligatorios.']);
    if (mb_strlen($productoBase) > 180 || mb_strlen($presentacion) > 120 || mb_strlen($embalaje) > 180 || mb_strlen($uniCaja) > 50 || !preg_match('/^\d+(?:[.,]\d{1,3})?$/', $uniCaja) || !in_array($estado, [0, 1], true)) {
        embalajesJson(422, ['rpta' => 'no', 'mensaje' => 'Verifica los datos del embalaje y las unidades por caja.']);
    }
    $conexion = embalajesConexion();
    $sqlDuplicado = 'SELECT id FROM EmbalajeCatalogo WHERE producto_base = ? AND COALESCE(presentacion, \'\') = ? AND COALESCE(embalaje, \'\') = ? AND id <> ? LIMIT 1';
    $stmt = $conexion->prepare($sqlDuplicado);
    $stmt->bind_param('sssi', $productoBase, $presentacion, $embalaje, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows) embalajesJson(409, ['rpta' => 'no', 'mensaje' => 'Ya existe un embalaje con esa combinación de producto, presentación y empaque.']);
    $stmt->close();
    if ($id > 0) {
        $stmt = $conexion->prepare('UPDATE EmbalajeCatalogo SET producto_base = ?, presentacion = NULLIF(?, \'\'), embalaje = NULLIF(?, \'\'), `uni/caja` = ?, estado = ?, updated_at = NOW() WHERE id = ?');
        $stmt->bind_param('ssssii', $productoBase, $presentacion, $embalaje, $uniCaja, $estado, $id);
        $stmt->execute();
        if (!$stmt->affected_rows && !$conexion->query("SELECT 1 FROM EmbalajeCatalogo WHERE id = {$id}")->num_rows) embalajesJson(404, ['rpta' => 'no', 'mensaje' => 'El embalaje no existe.']);
        embalajesJson(200, ['rpta' => 'si', 'mensaje' => 'Embalaje actualizado correctamente.', 'data' => ['id' => $id]]);
    }
    $stmt = $conexion->prepare('INSERT INTO EmbalajeCatalogo (producto_base, presentacion, embalaje, `uni/caja`, estado, created_at, updated_at) VALUES (?, NULLIF(?, \'\'), NULLIF(?, \'\'), ?, ?, NOW(), NOW())');
    $stmt->bind_param('ssssi', $productoBase, $presentacion, $embalaje, $uniCaja, $estado);
    $stmt->execute();
    embalajesJson(201, ['rpta' => 'si', 'mensaje' => 'Embalaje creado correctamente.', 'data' => ['id' => $stmt->insert_id]]);
} catch (Throwable $e) {
    error_log('InventarioEmbalajesGuardar: ' . $e->getMessage());
    embalajesJson(500, ['rpta' => 'no', 'mensaje' => 'No fue posible guardar el embalaje.']);
}
