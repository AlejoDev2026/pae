<?php
// --- Configuración general ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// --- Cabeceras anti-caché (debe ir ANTES de cualquier salida o JSON) ---
header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// --- CORS + JSON ---
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Zona horaria ---
date_default_timezone_set('America/Bogota');

// Define el caso a ejecutar desde la url de la petición
$case = isset($_GET['case']) ? (int) $_GET['case'] : 0;

if (!$case) {
    echo json_encode([
        "rpta" => "no",
        "mensaje" => "No se definió un caso a ejecutar",
        "error" => "Missing case"
    ]);
    exit;
}

// Establece la conexión con la base de datos
$hostname = "localhost";
$database = "accionpo_pae";
$username = "accionpo_pae";
$password = "o#Ao0?ZEEec0s).i";

$conexion = new mysqli($hostname, $username, $password, $database);
$conexion->set_charset("utf8mb4");

if ($conexion->connect_error) {
    echo json_encode([
        "rpta" => "no",
        "mensaje" => "Ocurrió un error al conectarse con la base de datos",
        "error" => $conexion->connect_error
    ]);
    exit;
}

require_once __DIR__ . '/../auth/permisos.php';
exigirPermiso($conexion, 'usuarios.administrar');

// 1. Obtener todos los datos de todos los usuarios, según un rol especificado desde la petición
// 2. Obtener todos los datos de un usuario, según un ID especificado desde la petición
// 3. Cambiar el estado de un usuario a activo o suspendido
// 4. Editar nombre, correo o teléfono de un usuario

switch ($case) {
    case 1:
        try {
            $rol = isset($_GET["rol"]) && $_GET["rol"] !== "" ? (int) $_GET["rol"] : null;

            $sql = $rol
                ? "SELECT
                        u.id,
                        u.nombre,
                        u.telefono,
                        u.correo,
                        u.rol AS idRol,
                        COALESCE(pa.nombre, CONCAT('Rol #', u.rol)) AS rol,
                        COALESCE(pa.color, '#64748B') AS colorRol,
                        u.estado AS idEstado,
                        COALESCE(p.parametro, CASE WHEN u.estado = 1 THEN 'Activo' ELSE 'Suspendido' END) AS estado,
                        COALESCE(p.color, CASE WHEN u.estado = 1 THEN '#22C55E' ELSE '#EF4444' END) AS colorEstado
                    FROM usuarios u
                    LEFT JOIN parametros p
                        ON u.estado = p.id AND p.tipoParametro = 2
                    LEFT JOIN Roles pa
                        ON u.rol = pa.id
                    WHERE u.rol = ?
                    ORDER BY u.id DESC"
                : "SELECT
                        u.id,
                        u.nombre,
                        u.telefono,
                        u.correo,
                        u.rol AS idRol,
                        COALESCE(pa.nombre, CONCAT('Rol #', u.rol)) AS rol,
                        COALESCE(pa.color, '#64748B') AS colorRol,
                        u.estado AS idEstado,
                        COALESCE(p.parametro, CASE WHEN u.estado = 1 THEN 'Activo' ELSE 'Suspendido' END) AS estado,
                        COALESCE(p.color, CASE WHEN u.estado = 1 THEN '#22C55E' ELSE '#EF4444' END) AS colorEstado
                    FROM usuarios u
                    LEFT JOIN parametros p
                        ON u.estado = p.id AND p.tipoParametro = 2
                    LEFT JOIN Roles pa
                        ON u.rol = pa.id
                    ORDER BY u.id DESC";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando consulta",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            if ($rol !== null) {
                $stmt->bind_param("i", $rol);
            }

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al consultar los usuarios",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->store_result();

            if ($stmt->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "si",
                    "mensaje" => "No se encontró ningún usuario",
                    "data" => []
                ]);
                $stmt->close();
                break;
            }

            $stmt->bind_result(
                $id,
                $nombre,
                $telefono,
                $correo,
                $idRol,
                $rolNombre,
                $colorRol,
                $idEstado,
                $estadoNombre,
                $colorEstado
            );

            $usuarios = [];

            while ($stmt->fetch()) {
                $usuarios[] = [
                    "id" => $id,
                    "nombre" => $nombre,
                    "telefono" => $telefono,
                    "correo" => $correo,
                    "idRol" => $idRol,
                    "rol" => $rolNombre,
                    "colorRol" => $colorRol,
                    "idEstado" => $idEstado,
                    "estado" => $estadoNombre,
                    "colorEstado" => $colorEstado
                ];
            }

            $stmt->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Consulta realizada con éxito",
                "data" => $usuarios
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al obtener todos los usuarios",
                "error" => $e->getMessage()
            ]);
        }
        break;

    case 2:
        try {
            $id = isset($_GET["id"]) ? (int) $_GET["id"] : 0;

            if ($id <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No se estableció un id de usuario válido",
                    "error" => "Invalid id"
                ]);
                break;
            }

            $sql = "SELECT
                    u.id,
                    u.nombre,
                    u.telefono,
                    u.correo,
                    u.rol AS idRol,
                    COALESCE(pa.nombre, CONCAT('Rol #', u.rol)) AS rol,
                    COALESCE(pa.color, '#64748B') AS colorRol,
                    u.estado AS idEstado,
                    COALESCE(p.parametro, CASE WHEN u.estado = 1 THEN 'Activo' ELSE 'Suspendido' END) AS estado,
                    COALESCE(p.color, CASE WHEN u.estado = 1 THEN '#22C55E' ELSE '#EF4444' END) AS colorEstado
                FROM usuarios u
                LEFT JOIN parametros p
                    ON u.estado = p.id AND p.tipoParametro = 2
                    LEFT JOIN Roles pa
                    ON u.rol = pa.id
                WHERE u.id = ?
                LIMIT 1";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando consulta del usuario",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            $stmt->bind_param("i", $id);

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al consultar el usuario",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->store_result();

            if ($stmt->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "si",
                    "mensaje" => "No se encontró ningún usuario",
                    "data" => null
                ]);
                $stmt->close();
                break;
            }

            $stmt->bind_result(
                $usuarioId,
                $nombre,
                $telefono,
                $correo,
                $idRol,
                $rolNombre,
                $colorRol,
                $idEstado,
                $estadoNombre,
                $colorEstado
            );

            $stmt->fetch();
            $stmt->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Consulta realizada con éxito",
                "data" => [
                    "id" => $usuarioId,
                    "nombre" => $nombre,
                    "telefono" => $telefono,
                    "correo" => $correo,
                    "idRol" => $idRol,
                    "rol" => $rolNombre,
                    "colorRol" => $colorRol,
                    "idEstado" => $idEstado,
                    "estado" => $estadoNombre,
                    "colorEstado" => $colorEstado
                ]
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al obtener el usuario",
                "error" => $e->getMessage()
            ]);
        }
        break;

    case 3:
        try {
            $idUsuario = isset($_GET["id"]) ? (int) $_GET["id"] : 0;

            if ($idUsuario <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No se estableció un usuario a cambiar de estado",
                    "error" => "Missing fields"
                ]);
                break;
            }

            $sql = "SELECT estado
                FROM usuarios
                WHERE id = ?
                LIMIT 1";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando consulta del usuario",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            $stmt->bind_param("i", $idUsuario);

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al buscar el usuario",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->store_result();

            if ($stmt->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No se encontró el usuario",
                    "error" => "Empty rows"
                ]);
                $stmt->close();
                break;
            }

            $stmt->bind_result($estadoActual);
            $stmt->fetch();
            $stmt->close();

            // Estados de usuarios: 1 = activo, 2 = suspendido.
            $nuevoEstado = ((int)$estadoActual === 1) ? 2 : 1;

            $sqlUpdate = "UPDATE usuarios
                SET estado = ?
                WHERE id = ?";

            $stmtUpdate = $conexion->prepare($sqlUpdate);

            if (!$stmtUpdate) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando actualización de estado",
                    "error" => $conexion->error,
                    "sql" => $sqlUpdate
                ]);
                break;
            }

            $stmtUpdate->bind_param("ii", $nuevoEstado, $idUsuario);

            if (!$stmtUpdate->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al cambiar el estado del usuario",
                    "error" => $stmtUpdate->error
                ]);
                $stmtUpdate->close();
                break;
            }

            $stmtUpdate->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Consulta realizada con éxito"
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al cambiar el estado del usuario",
                "error" => $e->getMessage()
            ]);
        }
        break;

    case 4:
        try {
            $id = isset($_POST["id"]) ? (int) $_POST["id"] : 0;
            $nombre = trim($_POST["nombre"] ?? "");
            $correo = trim($_POST["correo"] ?? "");
            $telefono = trim($_POST["telefono"] ?? "");
            $rol = isset($_POST["rol"]) ? (int) $_POST["rol"] : 0;

            if ($id <= 0 || $nombre === "" || $correo === "" || $telefono === "" || $rol <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Faltan datos requeridos",
                    "error" => "Empty fields"
                ]);
                break;
            }

            if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "El correo electrÃ³nico no es vÃ¡lido",
                    "error" => "Invalid email"
                ]);
                break;
            }

            $stmtRol = $conexion->prepare("SELECT id FROM Roles WHERE id = ? AND estado = 1 LIMIT 1");
            if (!$stmtRol) throw new RuntimeException("No fue posible validar el rol seleccionado");
            $stmtRol->bind_param("i", $rol);
            $stmtRol->execute();
            $stmtRol->store_result();
            if ($stmtRol->num_rows <= 0) {
                $stmtRol->close();
                echo json_encode(["rpta" => "no", "mensaje" => "El rol seleccionado no está disponible", "error" => "Invalid role"]);
                break;
            }
            $stmtRol->close();

            $stmtCorreo = $conexion->prepare("SELECT id FROM usuarios WHERE correo = ? AND id <> ? LIMIT 1");
            if (!$stmtCorreo) {
                throw new RuntimeException("No fue posible preparar la validaciÃ³n del correo");
            }
            $stmtCorreo->bind_param("si", $correo, $id);
            $stmtCorreo->execute();
            $stmtCorreo->store_result();
            if ($stmtCorreo->num_rows > 0) {
                $stmtCorreo->close();
                echo json_encode([
                    "rpta" => "existe",
                    "mensaje" => "El correo ya estÃ¡ registrado por otro usuario"
                ]);
                break;
            }
            $stmtCorreo->close();

            $sqlSelect = "SELECT id
                FROM usuarios
                WHERE id = ?
                LIMIT 1";

            $stmtSelect = $conexion->prepare($sqlSelect);

            if (!$stmtSelect) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando búsqueda del usuario",
                    "error" => $conexion->error,
                    "sql" => $sqlSelect
                ]);
                break;
            }

            $stmtSelect->bind_param("i", $id);

            if (!$stmtSelect->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al buscar el usuario",
                    "error" => $stmtSelect->error
                ]);
                $stmtSelect->close();
                break;
            }

            $stmtSelect->store_result();

            if ($stmtSelect->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No se encontró el usuario a editar",
                    "error" => "Empty rows"
                ]);
                $stmtSelect->close();
                break;
            }

            $stmtSelect->close();

            $sqlUpdate = "UPDATE usuarios
                SET nombre = ?,
                    correo = ?,
                    telefono = ?,
                    rol = ?
                WHERE id = ?";

            $stmtUpdate = $conexion->prepare($sqlUpdate);

            if (!$stmtUpdate) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando actualización del usuario",
                    "error" => $conexion->error,
                    "sql" => $sqlUpdate
                ]);
                break;
            }

            $stmtUpdate->bind_param("sssii", $nombre, $correo, $telefono, $rol, $id);

            if (!$stmtUpdate->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al editar el usuario",
                    "error" => $stmtUpdate->error
                ]);
                $stmtUpdate->close();
                break;
            }

            $stmtUpdate->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Usuario editado correctamente"
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al editar el usuario",
                "error" => $e->getMessage()
            ]);
        }
        break;

    case 5:
        try {
            $id = isset($_POST["id"]) ? (int) $_POST["id"] : 0;
            $contrasena = (string) ($_POST["contrasena"] ?? "");

            if ($id <= 0) {
                echo json_encode(["rpta" => "no", "mensaje" => "El usuario es obligatorio", "error" => "Invalid id"]);
                break;
            }
            if (strlen($contrasena) < 8 || strlen($contrasena) > 72) {
                echo json_encode(["rpta" => "no", "mensaje" => "La contraseÃ±a debe tener entre 8 y 72 caracteres", "error" => "Invalid password length"]);
                break;
            }

            $hash = password_hash($contrasena, PASSWORD_DEFAULT);
            if ($hash === false) {
                throw new RuntimeException("No fue posible proteger la contraseÃ±a");
            }

            $stmt = $conexion->prepare("UPDATE usuarios SET contrasena = ?, tokenSesion = NULL WHERE id = ?");
            if (!$stmt) {
                throw new RuntimeException("No fue posible preparar el restablecimiento de contraseÃ±a");
            }
            $stmt->bind_param("si", $hash, $id);
            $stmt->execute();
            if ($stmt->affected_rows < 1) {
                $stmt->close();
                echo json_encode(["rpta" => "no", "mensaje" => "No se encontrÃ³ el usuario o la contraseÃ±a no cambiÃ³", "error" => "User not updated"]);
                break;
            }
            $stmt->close();
            echo json_encode(["rpta" => "si", "mensaje" => "ContraseÃ±a restablecida correctamente"]);
        } catch (Throwable $e) {
            echo json_encode(["rpta" => "no", "mensaje" => "No fue posible restablecer la contraseÃ±a", "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode([
            "rpta" => "no",
            "mensaje" => "El case enviado no existe",
            "error" => "Invalid case"
        ]);
        break;
}

$conexion->close();
exit;
