<?php
declare(strict_types=1);
require_once __DIR__ . '/_conexion.php';
embalajesCors();
try {
    $input = json_decode((string)file_get_contents('php://input'), true);
    $id = (int)($input['id'] ?? 0);
    $estado = isset($input['estado']) ? (int)$input['estado'] : -1;
    if ($id <= 0 || !in_array($estado, [0, 1], true)) embalajesJson(422, ['rpta' => 'no', 'mensaje' => 'El embalaje o el estado no son válidos.']);
    $conexion = embalajesConexion();
    if ($estado === 0) {
        $stmt = $conexion->prepare('SELECT COUNT(*) FROM ProductosCatalogo WHERE idEmbalaje = ? AND estado = 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $stmt->bind_result($vinculados); $stmt->fetch(); $stmt->close();
        if ($vinculados > 0) embalajesJson(409, ['rpta' => 'no', 'mensaje' => 'No puedes inactivar un embalaje vinculado a productos activos.']);
    }
    $stmt = $conexion->prepare('UPDATE EmbalajeCatalogo SET estado = ?, updated_at = NOW() WHERE id = ?');
    $stmt->bind_param('ii', $estado, $id); $stmt->execute();
    if (!$stmt->affected_rows) embalajesJson(404, ['rpta' => 'no', 'mensaje' => 'El embalaje no existe o ya tiene ese estado.']);
    embalajesJson(200, ['rpta' => 'si', 'mensaje' => $estado ? 'Embalaje activado correctamente.' : 'Embalaje inactivado correctamente.']);
} catch (Throwable $e) {
    error_log('InventarioEmbalajesCambiarEstado: ' . $e->getMessage());
    embalajesJson(500, ['rpta' => 'no', 'mensaje' => 'No fue posible cambiar el estado del embalaje.']);
}
