<?php

function exigirPermiso(mysqli $conexion, string $codigoPermiso): array
{
    $correo = trim((string)($_POST['correoSesion'] ?? $_GET['correoSesion'] ?? ''));
    $token = trim((string)($_POST['tokenSesion'] ?? $_GET['tokenSesion'] ?? ''));

    if ($correo === '' || $token === '') {
        http_response_code(401);
        echo json_encode(['rpta' => 'no', 'mensaje' => 'La sesión no está disponible', 'error' => 'Missing session']);
        exit;
    }

    $sql = "SELECT u.id, u.rol, r.esAdministrador
            FROM usuarios u
            INNER JOIN Roles r ON r.id = u.rol AND r.estado = 1
            WHERE u.correo = ? AND u.tokenSesion = ? AND u.estado = 1
              AND (r.esAdministrador = 1 OR EXISTS (
                  SELECT 1 FROM RolesPermisos rp
                  INNER JOIN Permisos p ON p.id = rp.idPermiso AND p.estado = 1
                  WHERE rp.idRol = u.rol AND p.codigo = ?
              ))
            LIMIT 1";
    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['rpta' => 'no', 'mensaje' => 'No fue posible validar los permisos', 'error' => 'Permission query failed']);
        exit;
    }

    $stmt->bind_param('sss', $correo, $token, $codigoPermiso);
    $stmt->execute();
    $stmt->bind_result($idUsuario, $idRol, $esAdministrador);
    if (!$stmt->fetch()) {
        $stmt->close();
        http_response_code(403);
        echo json_encode(['rpta' => 'no', 'mensaje' => 'No tienes permisos para realizar esta acción', 'error' => 'Forbidden']);
        exit;
    }
    $stmt->close();

    return ['id' => (int)$idUsuario, 'rol' => (int)$idRol, 'esAdministrador' => (int)$esAdministrador === 1];
}

