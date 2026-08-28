<?php
// --- Configuración general ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// --- Cabeceras anti-caché ---
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

switch ($case) {
    // 1. Valida correo y contraseña para iniciar sesión
    case 1:
        try {
            $correo = trim($_POST["correo"] ?? "");
            $contrasena = $_POST["contrasena"] ?? "";

            if ($correo === "") {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ingrese el correo electrónico",
                    "error" => "Empty email"
                ]);
                break;
            }

            if ($contrasena === "") {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ingrese la contraseña",
                    "error" => "Empty password"
                ]);
                break;
            }

            $sqlUsuario = "SELECT
                    u.id,
                    u.nombre,
                    u.telefono,
                    u.correo,
                    u.rol,
                    u.contrasena,
                    u.estado,
                    u.tokenSesion,
                    r.parametro AS rolNombre
                FROM usuarios u
                INNER JOIN parametros r
                    ON u.rol = r.id
                WHERE u.correo = ?
                LIMIT 1";

            $stmtUsuario = $conexion->prepare($sqlUsuario);

            if (!$stmtUsuario) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando consulta de usuario",
                    "error" => $conexion->error,
                    "sql" => $sqlUsuario
                ]);
                break;
            }

            $stmtUsuario->bind_param("s", $correo);

            if (!$stmtUsuario->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al buscar correo electrónico",
                    "error" => $stmtUsuario->error
                ]);
                $stmtUsuario->close();
                break;
            }

            $stmtUsuario->store_result();

            if ($stmtUsuario->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Correo electrónico no registrado",
                    "error" => "Not found: Email"
                ]);
                $stmtUsuario->close();
                break;
            }

            $stmtUsuario->bind_result(
                $id,
                $nombre,
                $telefono,
                $correoDB,
                $rol,
                $contrasenaDB,
                $estado,
                $tokenSesionDB,
                $rolNombre
            );

            if (!$stmtUsuario->fetch()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No fue posible leer el usuario",
                    "error" => "Fetch failed"
                ]);
                $stmtUsuario->close();
                break;
            }

            $stmtUsuario->close();

            if ((int)$estado !== 1) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Usuario suspendido",
                    "error" => "Inactive user"
                ]);
                break;
            }

            if (!password_verify($contrasena, $contrasenaDB)) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Contraseña incorrecta",
                    "error" => "Incorrect password"
                ]);
                break;
            }

            $token = bin2hex(random_bytes(32));

            $sqlUpdate = "UPDATE usuarios
                SET tokenSesion = ?
                WHERE correo = ?";

            $stmtUpdate = $conexion->prepare($sqlUpdate);

            if (!$stmtUpdate) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando actualización de sesión",
                    "error" => $conexion->error,
                    "sql" => $sqlUpdate
                ]);
                break;
            }

            $stmtUpdate->bind_param("ss", $token, $correoDB);

            if (!$stmtUpdate->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al crear sesión",
                    "error" => $stmtUpdate->error
                ]);
                $stmtUpdate->close();
                break;
            }

            $stmtUpdate->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Inicio de sesión exitoso",
                "usuario" => [
                    "id" => $id,
                    "nombre" => $nombre,
                    "telefono" => $telefono,
                    "correo" => $correoDB,
                    "rol" => $rol,
                    "rolNombre" => $rolNombre
                ],
                "token" => $token
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al autenticar",
                "error" => $e->getMessage()
            ]);
        }
        break;

    // 2. Valida sesión existente
    case 2:
        try {
            $correo = trim($_POST["correo"] ?? "");
            $token = trim($_POST["token"] ?? "");

            if ($correo === "" || $token === "") {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "No se estableció la sesión",
                    "error" => "Missing session token"
                ]);
                break;
            }

            $sqlUsuario = "SELECT id
                FROM usuarios
                WHERE correo = ?
                  AND tokenSesion = ?
                LIMIT 1";

            $stmtUsuario = $conexion->prepare($sqlUsuario);

            if (!$stmtUsuario) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando validación de sesión",
                    "error" => $conexion->error,
                    "sql" => $sqlUsuario
                ]);
                break;
            }

            $stmtUsuario->bind_param("ss", $correo, $token);

            if (!$stmtUsuario->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al buscar sesión del usuario",
                    "error" => $stmtUsuario->error
                ]);
                $stmtUsuario->close();
                break;
            }

            $stmtUsuario->store_result();

            if ($stmtUsuario->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Token de sesión inválido",
                    "error" => "Invalid session token"
                ]);
                $stmtUsuario->close();
                break;
            }

            $stmtUsuario->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Sesión válida"
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al validar sesión",
                "error" => $e->getMessage()
            ]);
        }
        break;

    // 3. Cierra sesión borrando token
    case 3:
        try {
            $id = isset($_GET["id"]) ? (int)$_GET["id"] : 0;

            if ($id <= 0) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Id de usuario inválido",
                    "error" => "Invalid id"
                ]);
                break;
            }

            $sql = "UPDATE usuarios
                SET tokenSesion = NULL
                WHERE id = ?";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando cierre de sesión",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            $stmt->bind_param("i", $id);

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al borrar token de sesión",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Se cerró la sesión"
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al cerrar sesión",
                "error" => $e->getMessage()
            ]);
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