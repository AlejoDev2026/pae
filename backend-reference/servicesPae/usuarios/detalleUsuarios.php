<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

date_default_timezone_set('America/Bogota');

$hostname = "localhost";
$database = "accionpo_pae";
$username = "accionpo_pae";
$password = "o#Ao0?ZEEec0s).i";

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

// 1. Obtener roles
// 2. Crear usuario

switch ($case) {
    case 1:
        try {
            $sql = "SELECT id, nombre, color, 1 AS tipoParametro
                    FROM Roles
                    WHERE estado = 1
                    ORDER BY nombre ASC";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando consulta de roles",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Ocurrió un error al consultar los roles",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->store_result();

            if ($stmt->num_rows <= 0) {
                echo json_encode([
                    "rpta" => "si",
                    "mensaje" => "No se encontró ningún rol",
                    "data" => []
                ]);
                $stmt->close();
                break;
            }

            $stmt->bind_result($id, $parametro, $color, $tipoParametro);

            $roles = [];
            while ($stmt->fetch()) {
                $roles[] = [
                    "id" => $id,
                    "parametro" => $parametro,
                    "color" => $color,
                    "tipoParametro" => $tipoParametro
                ];
            }

            $stmt->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Consulta realizada con éxito",
                "data" => $roles
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al obtener los roles",
                "error" => $e->getMessage()
            ]);
        }
        break;

    case 2:
        try {
            $nombre = trim($_POST["nombre"] ?? "");
            $telefono = trim($_POST["telefono"] ?? "");
            $correo = trim($_POST["correo"] ?? "");
            $rol = isset($_POST["rol"]) ? (int) $_POST["rol"] : 0;
            // El servidor protege la contraseña una sola vez. El alias "pass"
            // se conserva temporalmente por compatibilidad con clientes antiguos.
            $pass = (string) ($_POST["contrasena"] ?? $_POST["pass"] ?? "");
            // Estados de usuarios: 1 = activo, 2 = suspendido.
            // Todo usuario nuevo debe poder autenticarse inmediatamente.
            $estado = 1;

            if ($nombre === "" || $telefono === "" || $correo === "" || $rol <= 0 || $pass === "") {
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
                    "mensaje" => "El correo electrónico no es válido",
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

            if (strlen($pass) < 8 || strlen($pass) > 72) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "La contraseña debe tener entre 8 y 72 caracteres",
                    "error" => "Invalid password length"
                ]);
                break;
            }

            // Validar si ya existe un usuario con ese correo
            $sqlExiste = "SELECT id
                          FROM usuarios
                          WHERE correo = ?
                          LIMIT 1";

            $stmtExiste = $conexion->prepare($sqlExiste);

            if (!$stmtExiste) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando validación de correo",
                    "error" => $conexion->error,
                    "sql" => $sqlExiste
                ]);
                break;
            }

            $stmtExiste->bind_param("s", $correo);

            if (!$stmtExiste->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al validar el correo",
                    "error" => $stmtExiste->error
                ]);
                $stmtExiste->close();
                break;
            }

            $stmtExiste->store_result();

            if ($stmtExiste->num_rows > 0) {
                $stmtExiste->close();
                echo json_encode([
                    "rpta" => "existe",
                    "mensaje" => "El correo ya está registrado"
                ]);
                break;
            }

            $stmtExiste->close();

            // Hashear contraseña para que luego funcione password_verify() en autenticación
            $passHash = password_hash($pass, PASSWORD_DEFAULT);

            $sql = "INSERT INTO usuarios (
                        nombre,
                        telefono,
                        correo,
                        rol,
                        contrasena,
                        estado
                    ) VALUES (?, ?, ?, ?, ?, ?)";

            $stmt = $conexion->prepare($sql);

            if (!$stmt) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error preparando inserción de usuario",
                    "error" => $conexion->error,
                    "sql" => $sql
                ]);
                break;
            }

            $stmt->bind_param(
                "sssisi",
                $nombre,
                $telefono,
                $correo,
                $rol,
                $passHash,
                $estado
            );

            if (!$stmt->execute()) {
                echo json_encode([
                    "rpta" => "no",
                    "mensaje" => "Error al insertar usuario",
                    "error" => $stmt->error
                ]);
                $stmt->close();
                break;
            }

            $stmt->close();

            echo json_encode([
                "rpta" => "si",
                "mensaje" => "Usuario creado correctamente"
            ]);
        } catch (Throwable $e) {
            echo json_encode([
                "rpta" => "no",
                "mensaje" => "Ocurrió un error al crear el usuario",
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
