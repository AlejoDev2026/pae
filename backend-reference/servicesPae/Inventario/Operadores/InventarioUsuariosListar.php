<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

/* ============================================================
   RESPUESTA JSON
============================================================ */

function responder($rpta, $mensaje, $data = [], $extra = [], $code = 200)
{
    http_response_code($code);

    echo json_encode(
        array_merge([
            "rpta" => $rpta,
            "mensaje" => $mensaje,
            "data" => $data
        ], $extra),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    exit;
}

/* ============================================================
   VALIDAR CONEXIÓN
============================================================ */

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder(
        "no",
        "No se encontró la conexión a la base de datos",
        [],
        [
            "error" => "Variable \$conexion no disponible"
        ],
        500
    );
}

$conexion->set_charset("utf8mb4");

/* ============================================================
   HELPERS
============================================================ */

function buscarTabla($conexion, $posibles)
{
    foreach ($posibles as $tabla) {
        $tablaSegura = $conexion->real_escape_string($tabla);
        $res = $conexion->query("SHOW TABLES LIKE '$tablaSegura'");

        if ($res && $res->num_rows > 0) {
            return $tabla;
        }
    }

    return "";
}

function columnasTabla($conexion, $tabla)
{
    $columnas = [];

    $res = $conexion->query("SHOW COLUMNS FROM `$tabla`");

    if (!$res) {
        responder(
            "no",
            "No se pudo consultar la estructura de la tabla $tabla",
            [],
            [
                "error" => $conexion->error
            ],
            500
        );
    }

    while ($row = $res->fetch_assoc()) {
        $columnas[$row["Field"]] = $row;
    }

    return $columnas;
}

function tieneColumna($columnas, $campo)
{
    return array_key_exists($campo, $columnas);
}

function primeraColumna($columnas, $posibles)
{
    foreach ($posibles as $campo) {
        if (tieneColumna($columnas, $campo)) {
            return $campo;
        }
    }

    return "";
}

function tipoColumna($columnas, $campo)
{
    return isset($columnas[$campo]["Type"])
        ? strtolower((string)$columnas[$campo]["Type"])
        : "";
}

function columnaEsNumerica($columnas, $campo)
{
    $tipo = tipoColumna($columnas, $campo);

    return strpos($tipo, "int") !== false
        || strpos($tipo, "decimal") !== false
        || strpos($tipo, "double") !== false
        || strpos($tipo, "float") !== false;
}

function selectCampo($columnas, $posibles, $alias, $default = "''", $prefijo = "u")
{
    $campo = primeraColumna($columnas, $posibles);

    if ($campo !== "") {
        return "$prefijo.`$campo` AS `$alias`";
    }

    return "$default AS `$alias`";
}

function valorEnteroGet($campo, $default = 0)
{
    return isset($_GET[$campo]) ? intval($_GET[$campo]) : $default;
}

function valorTextoGet($campo, $default = "")
{
    return isset($_GET[$campo])
        ? trim((string)$_GET[$campo])
        : $default;
}

function estadoEsActivo($valor)
{
    $estado = strtolower(trim((string)$valor));

    return $estado === "1"
        || $estado === "activo"
        || $estado === "activa"
        || $estado === "true"
        || $estado === "si"
        || $estado === "sí";
}

/* ============================================================
   LOCALIZAR TABLA DE USUARIOS
============================================================ */

$tablaUsuarios = buscarTabla($conexion, [
    "Usuarios",
    "usuarios"
]);

if ($tablaUsuarios === "") {
    responder(
        "no",
        "No se encontró la tabla de usuarios del sistema",
        [],
        [
            "tablasBuscadas" => [
                "Usuarios",
                "usuarios"
            ]
        ],
        500
    );
}

$columnasUsuarios = columnasTabla($conexion, $tablaUsuarios);

/* ============================================================
   IDENTIFICAR COLUMNAS DE USUARIOS
============================================================ */

$campoIdUsuario = primeraColumna($columnasUsuarios, [
    "idUsuario",
    "id_usuario",
    "id"
]);

if ($campoIdUsuario === "") {
    responder(
        "no",
        "La tabla $tablaUsuarios no tiene una columna de identificación válida",
        [],
        [
            "columnasEsperadas" => [
                "idUsuario",
                "id_usuario",
                "id"
            ]
        ],
        500
    );
}

$campoUsuario = primeraColumna($columnasUsuarios, [
    "usuario",
    "username",
    "user"
]);

$campoNombre = primeraColumna($columnasUsuarios, [
    "nombre",
    "nombres",
    "primerNombre"
]);

$campoApellido = primeraColumna($columnasUsuarios, [
    "apellido",
    "apellidos",
    "primerApellido"
]);

$campoNombreCompleto = primeraColumna($columnasUsuarios, [
    "nombreCompleto",
    "nombre_completo",
    "fullName"
]);

$campoDocumento = primeraColumna($columnasUsuarios, [
    "documento",
    "numeroDocumento",
    "numero_documento",
    "identificacion",
    "cedula"
]);

$campoTipoDocumento = primeraColumna($columnasUsuarios, [
    "tipoDocumento",
    "tipo_documento"
]);

$campoCorreo = primeraColumna($columnasUsuarios, [
    "correo",
    "email",
    "correoElectronico"
]);

$campoTelefono = primeraColumna($columnasUsuarios, [
    "telefono",
    "celular",
    "movil"
]);

$campoEstadoUsuario = primeraColumna($columnasUsuarios, [
    "estado",
    "idEstado",
    "id_estado"
]);

/* ============================================================
   VALIDAR TABLA InventarioOperadores
============================================================ */

$tablaOperadores = buscarTabla($conexion, [
    "InventarioOperadores"
]);

$tieneRelacionOperador = false;
$columnasOperadores = [];
$campoIdOperador = "";
$campoIdUsuarioOperador = "";
$campoEstadoOperador = "";

if ($tablaOperadores !== "") {
    $columnasOperadores = columnasTabla($conexion, $tablaOperadores);

    $campoIdOperador = primeraColumna($columnasOperadores, [
        "idOperador",
        "idInventarioOperador",
        "id"
    ]);

    $campoIdUsuarioOperador = primeraColumna($columnasOperadores, [
        "idUsuario",
        "id_usuario"
    ]);

    $campoEstadoOperador = primeraColumna($columnasOperadores, [
        "estado",
        "idEstado",
        "id_estado"
    ]);

    $tieneRelacionOperador =
        $campoIdOperador !== ""
        && $campoIdUsuarioOperador !== "";
}

/* ============================================================
   PARÁMETROS
============================================================ */

/*
    Ejemplos:

    Todos los usuarios activos:
    ?soloActivos=1

    Solo usuarios activos aún no vinculados:
    ?soloActivos=1&disponibles=1

    Buscar:
    ?q=alejandro

    Consultar un usuario:
    ?idUsuario=15

    En editar, permitir que aparezca el usuario ya vinculado:
    ?disponibles=1&incluirIdUsuario=15
*/

$idUsuario = valorEnteroGet(
    "idUsuario",
    valorEnteroGet("id", 0)
);

$q = valorTextoGet("q", "");

$soloActivos = valorEnteroGet("soloActivos", 1) === 1;
$disponibles = valorEnteroGet("disponibles", 0) === 1;
$incluirIdUsuario = valorEnteroGet("incluirIdUsuario", 0);

/* ============================================================
   SELECT
============================================================ */

$select = [];

$select[] = "u.`$campoIdUsuario` AS idUsuario";

$select[] = selectCampo(
    $columnasUsuarios,
    ["usuario", "username", "user"],
    "usuario"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["nombre", "nombres", "primerNombre"],
    "nombre"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["apellido", "apellidos", "primerApellido"],
    "apellido"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["nombreCompleto", "nombre_completo", "fullName"],
    "nombreCompleto"
);

$select[] = selectCampo(
    $columnasUsuarios,
    [
        "documento",
        "numeroDocumento",
        "numero_documento",
        "identificacion",
        "cedula"
    ],
    "documento"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["tipoDocumento", "tipo_documento"],
    "tipoDocumento",
    "'CC'"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["correo", "email", "correoElectronico"],
    "correo"
);

$select[] = selectCampo(
    $columnasUsuarios,
    ["telefono", "celular", "movil"],
    "telefono"
);

if ($campoEstadoUsuario !== "") {
    $select[] = "u.`$campoEstadoUsuario` AS estadoUsuarioOriginal";
} else {
    $select[] = "1 AS estadoUsuarioOriginal";
}

if ($tieneRelacionOperador) {
    $select[] = "io.`$campoIdOperador` AS idOperador";

    if ($campoEstadoOperador !== "") {
        $select[] = "io.`$campoEstadoOperador` AS estadoOperadorOriginal";
    } else {
        $select[] = "NULL AS estadoOperadorOriginal";
    }
} else {
    $select[] = "NULL AS idOperador";
    $select[] = "NULL AS estadoOperadorOriginal";
}

/* ============================================================
   FROM Y JOIN
============================================================ */

$sql = "
    SELECT
        " . implode(", ", $select) . "
    FROM `$tablaUsuarios` u
";

if ($tieneRelacionOperador) {
    $sql .= "
        LEFT JOIN `$tablaOperadores` io
            ON io.`$campoIdUsuarioOperador` = u.`$campoIdUsuario`
    ";
}

$sql .= " WHERE 1=1 ";

/* ============================================================
   FILTRO POR ID
============================================================ */

if ($idUsuario > 0) {
    $sql .= " AND u.`$campoIdUsuario` = " . intval($idUsuario);
}

/* ============================================================
   SOLO USUARIOS ACTIVOS
============================================================ */

if ($soloActivos && $campoEstadoUsuario !== "") {
    if (
        $campoEstadoUsuario === "idEstado"
        || $campoEstadoUsuario === "id_estado"
        || columnaEsNumerica($columnasUsuarios, $campoEstadoUsuario)
    ) {
        $sql .= " AND u.`$campoEstadoUsuario` = 1 ";
    } else {
        $sql .= "
            AND LOWER(TRIM(u.`$campoEstadoUsuario`))
                IN ('activo', 'activa', '1', 'true', 'si', 'sí')
        ";
    }
}

/* ============================================================
   SOLO USUARIOS DISPONIBLES
============================================================ */

if ($disponibles && $tieneRelacionOperador) {
    if ($incluirIdUsuario > 0) {
        $sql .= "
            AND (
                io.`$campoIdOperador` IS NULL
                OR u.`$campoIdUsuario` = " . intval($incluirIdUsuario) . "
            )
        ";
    } else {
        $sql .= " AND io.`$campoIdOperador` IS NULL ";
    }
}

/* ============================================================
   BÚSQUEDA
============================================================ */

if ($q !== "") {
    $qSeguro = $conexion->real_escape_string($q);
    $condiciones = [];

    foreach ([
        $campoUsuario,
        $campoNombre,
        $campoApellido,
        $campoNombreCompleto,
        $campoDocumento,
        $campoTipoDocumento,
        $campoCorreo,
        $campoTelefono
    ] as $campo) {
        if ($campo !== "") {
            $condiciones[] = "u.`$campo` LIKE '%$qSeguro%'";
        }
    }

    if (count($condiciones) > 0) {
        $sql .= " AND (" . implode(" OR ", $condiciones) . ") ";
    }
}

/* ============================================================
   ORDEN
============================================================ */

if ($campoNombreCompleto !== "") {
    $sql .= " ORDER BY u.`$campoNombreCompleto` ASC ";
} elseif ($campoNombre !== "" && $campoApellido !== "") {
    $sql .= "
        ORDER BY
            u.`$campoNombre` ASC,
            u.`$campoApellido` ASC
    ";
} elseif ($campoNombre !== "") {
    $sql .= " ORDER BY u.`$campoNombre` ASC ";
} elseif ($campoUsuario !== "") {
    $sql .= " ORDER BY u.`$campoUsuario` ASC ";
} else {
    $sql .= " ORDER BY u.`$campoIdUsuario` ASC ";
}

/* ============================================================
   EJECUTAR
============================================================ */

$res = $conexion->query($sql);

if (!$res) {
    responder(
        "no",
        "Error consultando los usuarios del sistema",
        [],
        [
            "error" => $conexion->error,
            "sql" => $sql
        ],
        500
    );
}

/* ============================================================
   NORMALIZAR RESPUESTA
============================================================ */

$data = [];

while ($row = $res->fetch_assoc()) {
    $nombre = trim((string)($row["nombre"] ?? ""));
    $apellido = trim((string)($row["apellido"] ?? ""));
    $nombreCompleto = trim((string)($row["nombreCompleto"] ?? ""));

    if ($nombreCompleto === "") {
        $nombreCompleto = trim($nombre . " " . $apellido);
    }

    if ($nombreCompleto === "") {
        $nombreCompleto = trim((string)($row["usuario"] ?? ""));
    }

    if ($nombreCompleto === "") {
        $nombreCompleto = "Usuario #" . intval($row["idUsuario"]);
    }

    $usuarioActivo = estadoEsActivo(
        $row["estadoUsuarioOriginal"] ?? 1
    );

    $idOperador = isset($row["idOperador"])
        && $row["idOperador"] !== null
        ? intval($row["idOperador"])
        : null;

    $vinculado = $idOperador !== null && $idOperador > 0;

    $operadorActivo = false;

    if ($vinculado) {
        $operadorActivo = estadoEsActivo(
            $row["estadoOperadorOriginal"] ?? 1
        );
    }

    unset(
        $row["estadoUsuarioOriginal"],
        $row["estadoOperadorOriginal"]
    );

    $row["idUsuario"] = intval($row["idUsuario"]);
    $row["idOperador"] = $idOperador;

    $row["nombre"] = $nombre;
    $row["apellido"] = $apellido;
    $row["nombreCompleto"] = $nombreCompleto;

    $row["estado"] = $usuarioActivo ? 1 : 0;
    $row["estadoTexto"] = $usuarioActivo
        ? "Activo"
        : "Inactivo";

    $row["vinculadoOperador"] = $vinculado ? 1 : 0;
    $row["operadorActivo"] = $operadorActivo ? 1 : 0;

    $data[] = $row;
}

responder(
    "si",
    "Usuarios consultados correctamente",
    $data,
    [
        "total" => count($data),
        "tablaUsuarios" => $tablaUsuarios,
        "filtros" => [
            "soloActivos" => $soloActivos ? 1 : 0,
            "disponibles" => $disponibles ? 1 : 0,
            "incluirIdUsuario" => $incluirIdUsuario
        ]
    ]
);
?>