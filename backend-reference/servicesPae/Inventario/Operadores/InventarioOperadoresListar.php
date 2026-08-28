<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/* ============================================================
 * HEADERS
 * ============================================================ */

header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header(
    "Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires"
);

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

/* ============================================================
 * RESPUESTA
 * ============================================================ */

function responder(
    $rpta,
    $mensaje,
    $data = [],
    $extra = [],
    $codigoHttp = 200
) {
    http_response_code($codigoHttp);

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
 * VALIDAR CONEXIÓN
 * ============================================================ */

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder(
        "no",
        "No se encontró la conexión a la base de datos",
        [],
        [
            "error" => "La variable \$conexion no está disponible"
        ],
        500
    );
}

$conexion->set_charset("utf8mb4");

/* ============================================================
 * PARÁMETROS
 * ============================================================ */

function parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return trim((string)$_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return trim((string)$_POST[$nombre]);
    }

    return $default;
}

$idOperador = intval(
    parametro(
        "idOperador",
        parametro("id", 0)
    )
);

$idUsuario = intval(parametro("idUsuario", 0));
$q = parametro("q", "");
$estadoOperador = parametro("estadoOperador", "");
$estadoUsuario = parametro("estadoUsuario", "");

/* ============================================================
 * CONSULTA
 *
 * IMPORTANTE:
 * - io.estado es el estado del operador: 1 activo / 0 inactivo.
 * - u.estado es el estado del usuario: 1 activo / 2 inactivo.
 * ============================================================ */

$sql = "
    SELECT
        io.id AS idOperador,
        io.idUsuario,
        io.codigo,
        io.tipoDocumento,
        io.documento,
        io.cargo,
        io.observacion,
        io.estado AS estadoOperador,
        io.created_at,
        io.updated_at,

        u.nombre AS nombreUsuario,
        u.telefono AS telefonoUsuario,
        u.correo AS correoUsuario,
        u.rol AS rolUsuario,
        u.estado AS estadoUsuario

    FROM InventarioOperadores io

    LEFT JOIN usuarios u
        ON u.id = io.idUsuario

    WHERE 1 = 1
";

$tipos = "";
$valores = [];

if ($idOperador > 0) {
    $sql .= " AND io.id = ? ";
    $tipos .= "i";
    $valores[] = $idOperador;
}

if ($idUsuario > 0) {
    $sql .= " AND io.idUsuario = ? ";
    $tipos .= "i";
    $valores[] = $idUsuario;
}

if ($estadoOperador !== "") {
    $sql .= " AND io.estado = ? ";
    $tipos .= "i";
    $valores[] = intval($estadoOperador);
}

if ($estadoUsuario !== "") {
    $sql .= " AND u.estado = ? ";
    $tipos .= "i";
    $valores[] = intval($estadoUsuario);
}

if ($q !== "") {
    $busqueda = "%" . $q . "%";

    $sql .= "
        AND (
            io.codigo LIKE ?
            OR io.tipoDocumento LIKE ?
            OR io.documento LIKE ?
            OR io.cargo LIKE ?
            OR io.observacion LIKE ?
            OR u.nombre LIKE ?
            OR u.telefono LIKE ?
            OR u.correo LIKE ?
        )
    ";

    $tipos .= "ssssssss";

    for ($i = 0; $i < 8; $i++) {
        $valores[] = $busqueda;
    }
}

$sql .= "
    ORDER BY
        u.nombre ASC,
        io.id DESC
";

/* ============================================================
 * PREPARAR Y EJECUTAR
 * ============================================================ */

$stmt = $conexion->prepare($sql);

if (!$stmt) {
    responder(
        "no",
        "No se pudo preparar la consulta de operadores",
        [],
        [
            "error" => $conexion->error
        ],
        500
    );
}

if ($tipos !== "") {
    $referencias = [];
    $referencias[] = &$tipos;

    foreach ($valores as $indice => $valor) {
        $referencias[] = &$valores[$indice];
    }

    call_user_func_array(
        [$stmt, "bind_param"],
        $referencias
    );
}

if (!$stmt->execute()) {
    responder(
        "no",
        "No se pudieron consultar los operadores",
        [],
        [
            "error" => $stmt->error
        ],
        500
    );
}

$stmt->store_result();

$stmt->bind_result(
    $resultadoIdOperador,
    $resultadoIdUsuario,
    $resultadoCodigo,
    $resultadoTipoDocumento,
    $resultadoDocumento,
    $resultadoCargo,
    $resultadoObservacion,
    $resultadoEstadoOperador,
    $resultadoCreatedAt,
    $resultadoUpdatedAt,
    $resultadoNombreUsuario,
    $resultadoTelefonoUsuario,
    $resultadoCorreoUsuario,
    $resultadoRolUsuario,
    $resultadoEstadoUsuario
);

/* ============================================================
 * NORMALIZAR RESPUESTA
 * ============================================================ */

$data = [];

$resumen = [
    "total" => 0,
    "operadoresActivos" => 0,
    "operadoresInactivos" => 0,
    "usuariosActivos" => 0,
    "usuariosInactivos" => 0,
    "usuariosNoEncontrados" => 0
];

while ($stmt->fetch()) {
    $idOperadorNormalizado = intval($resultadoIdOperador);
    $idUsuarioNormalizado = intval($resultadoIdUsuario);

    /*
     * Estado del operador:
     * 1 = Activo
     * 0 = Inactivo
     */
    $estadoOperadorNormalizado =
        intval($resultadoEstadoOperador) === 1
            ? 1
            : 0;

    /*
     * Estado del usuario:
     * 1 = Activo
     * 2 = Inactivo
     * NULL = Usuario no encontrado
     */
    $usuarioEncontrado =
        $resultadoEstadoUsuario !== null;

    $estadoUsuarioNormalizado =
        $usuarioEncontrado
            ? intval($resultadoEstadoUsuario)
            : null;

    $estadoUsuarioTexto = "Usuario no encontrado";

    if ($estadoUsuarioNormalizado === 1) {
        $estadoUsuarioTexto = "Activo";
    } elseif ($estadoUsuarioNormalizado === 2) {
        $estadoUsuarioTexto = "Inactivo";
    }

    $resumen["total"]++;

    if ($estadoOperadorNormalizado === 1) {
        $resumen["operadoresActivos"]++;
    } else {
        $resumen["operadoresInactivos"]++;
    }

    if (!$usuarioEncontrado) {
        $resumen["usuariosNoEncontrados"]++;
    } elseif ($estadoUsuarioNormalizado === 1) {
        $resumen["usuariosActivos"]++;
    } else {
        $resumen["usuariosInactivos"]++;
    }

    $nombre = trim((string)$resultadoNombreUsuario);

    if ($nombre === "") {
        $nombre = "Usuario #" . $idUsuarioNormalizado;
    }

    $data[] = [
        "idOperador" => $idOperadorNormalizado,
        "id" => $idOperadorNormalizado,
        "idUsuario" => $idUsuarioNormalizado,

        "codigo" => (string)$resultadoCodigo,
        "tipoDocumento" => (string)$resultadoTipoDocumento,
        "documento" => (string)$resultadoDocumento,

        "nombre" => $nombre,
        "apellido" => "",
        "nombreCompleto" => $nombre,

        "telefono" => (string)$resultadoTelefonoUsuario,
        "correo" => (string)$resultadoCorreoUsuario,
        "rolUsuario" => $resultadoRolUsuario !== null
            ? intval($resultadoRolUsuario)
            : null,

        "cargo" => (string)$resultadoCargo,
        "observacion" => (string)$resultadoObservacion,

        /*
         * Estado independiente del operador.
         */
        "estado" => $estadoOperadorNormalizado,
        "estadoOperador" => $estadoOperadorNormalizado,
        "estadoTexto" => $estadoOperadorNormalizado === 1
            ? "Activo"
            : "Inactivo",
        "estadoOperadorTexto" => $estadoOperadorNormalizado === 1
            ? "Activo"
            : "Inactivo",

        /*
         * Estado independiente del usuario.
         * Conserva 1 activo / 2 inactivo.
         */
        "estadoUsuario" => $estadoUsuarioNormalizado,
        "estadoUsuarioTexto" => $estadoUsuarioTexto,
        "usuarioEncontrado" => $usuarioEncontrado ? 1 : 0,

        "created_at" => $resultadoCreatedAt,
        "updated_at" => $resultadoUpdatedAt
    ];
}

$stmt->close();

responder(
    "si",
    "Operadores consultados correctamente",
    $data,
    [
        "resumen" => $resumen
    ]
);
?>
