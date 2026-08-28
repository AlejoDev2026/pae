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
header("Access-Control-Allow-Methods: POST, OPTIONS");
header(
    "Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires"
);

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "rpta" => "no",
        "mensaje" => "Método no permitido. Utilice POST."
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    exit;
}

require_once __DIR__ . "/../conexion.php";

/* ============================================================
 * RESPUESTA
 * ============================================================ */

function responder(
    $rpta,
    $mensaje,
    $data = null,
    $extra = [],
    $codigoHttp = 200
) {
    http_response_code($codigoHttp);

    $respuesta = [
        "rpta" => $rpta,
        "mensaje" => $mensaje
    ];

    if ($data !== null) {
        $respuesta["data"] = $data;
    }

    if (!empty($extra)) {
        $respuesta = array_merge($respuesta, $extra);
    }

    echo json_encode(
        $respuesta,
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
        null,
        [
            "error" => "La variable \$conexion no está disponible"
        ],
        500
    );
}

$conexion->set_charset("utf8mb4");

/* ============================================================
 * LEER JSON O FORM DATA
 * ============================================================ */

$entradaJson = json_decode(
    file_get_contents("php://input"),
    true
);

$entrada = is_array($entradaJson)
    ? array_merge($_POST, $entradaJson)
    : $_POST;

function valorEntrada($entrada, $campo, $default = "")
{
    return isset($entrada[$campo])
        ? trim((string)$entrada[$campo])
        : $default;
}

function enteroEntrada($entrada, $campo, $default = 0)
{
    return isset($entrada[$campo])
        ? intval($entrada[$campo])
        : $default;
}

function normalizarEstado($valor)
{
    $valorNormalizado = strtolower(trim((string)$valor));

    if (
        $valorNormalizado === "1" ||
        $valorNormalizado === "activo" ||
        $valorNormalizado === "activa" ||
        $valorNormalizado === "true" ||
        $valorNormalizado === "si" ||
        $valorNormalizado === "sí"
    ) {
        return 1;
    }

    if (
        $valorNormalizado === "0" ||
        $valorNormalizado === "inactivo" ||
        $valorNormalizado === "inactiva" ||
        $valorNormalizado === "false" ||
        $valorNormalizado === "no"
    ) {
        return 0;
    }

    return null;
}

/* ============================================================
 * DATOS RECIBIDOS
 * ============================================================ */

$idOperador = enteroEntrada(
    $entrada,
    "idOperador",
    enteroEntrada($entrada, "id", 0)
);

$estadoRecibido = valorEntrada(
    $entrada,
    "estado",
    valorEntrada($entrada, "nuevoEstado", "")
);

$nuevoEstado = normalizarEstado($estadoRecibido);

/* ============================================================
 * VALIDACIONES
 * ============================================================ */

if ($idOperador <= 0) {
    responder(
        "no",
        "No se recibió un operador válido",
        null,
        [
            "campo" => "idOperador"
        ],
        400
    );
}

if ($nuevoEstado === null) {
    responder(
        "no",
        "El estado recibido no es válido",
        null,
        [
            "campo" => "estado",
            "valoresPermitidos" => [
                1,
                0,
                "Activo",
                "Inactivo"
            ]
        ],
        400
    );
}

/* ============================================================
 * CONSULTAR OPERADOR ACTUAL
 * ============================================================ */

$sqlOperador = "
    SELECT
        io.id,
        io.idUsuario,
        io.codigo,
        io.documento,
        io.cargo,
        io.estado,
        u.nombre,
        u.telefono,
        u.correo,
        u.rol,
        u.estado
    FROM InventarioOperadores io
    LEFT JOIN usuarios u
        ON u.id = io.idUsuario
    WHERE io.id = ?
    LIMIT 1
";

$stmtOperador = $conexion->prepare($sqlOperador);

if (!$stmtOperador) {
    responder(
        "no",
        "No se pudo preparar la consulta del operador",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

$stmtOperador->bind_param("i", $idOperador);

if (!$stmtOperador->execute()) {
    responder(
        "no",
        "No se pudo consultar el operador",
        null,
        [
            "error" => $stmtOperador->error
        ],
        500
    );
}

$stmtOperador->store_result();

if ($stmtOperador->num_rows === 0) {
    $stmtOperador->close();

    responder(
        "no",
        "El operador seleccionado no existe",
        null,
        [
            "idOperador" => $idOperador
        ],
        404
    );
}

$stmtOperador->bind_result(
    $resultadoIdOperador,
    $resultadoIdUsuario,
    $resultadoCodigo,
    $resultadoDocumento,
    $resultadoCargo,
    $estadoActualOperador,
    $resultadoNombre,
    $resultadoTelefono,
    $resultadoCorreo,
    $resultadoRol,
    $resultadoEstadoUsuario
);

$stmtOperador->fetch();
$stmtOperador->close();

/* ============================================================
 * VALIDAR SI YA TIENE EL ESTADO
 * ============================================================ */

if (intval($estadoActualOperador) === intval($nuevoEstado)) {
    $usuarioActivo = intval($resultadoEstadoUsuario) === 1;

    responder(
        "si",
        $nuevoEstado === 1
            ? "El operador ya se encuentra activo"
            : "El operador ya se encuentra inactivo",
        [
            "idOperador" => intval($resultadoIdOperador),
            "id" => intval($resultadoIdOperador),
            "idUsuario" => intval($resultadoIdUsuario),
            "codigo" => $resultadoCodigo,
            "documento" => $resultadoDocumento,
            "nombre" => $resultadoNombre,
            "telefono" => $resultadoTelefono,
            "correo" => $resultadoCorreo,
            "rol" => intval($resultadoRol),
            "cargo" => $resultadoCargo,
            "estado" => intval($estadoActualOperador),
            "estadoTexto" => intval($estadoActualOperador) === 1
                ? "Activo"
                : "Inactivo",
            "estadoUsuario" => intval($resultadoEstadoUsuario),
            "estadoUsuarioTexto" => $usuarioActivo
                ? "Activo"
                : "Inactivo",
            "puedeOperar" => (
                intval($estadoActualOperador) === 1 &&
                $usuarioActivo
            ) ? 1 : 0
        ]
    );
}

/* ============================================================
 * ACTUALIZAR ESTADO DEL OPERADOR
 * ============================================================ */

$sqlActualizar = "
    UPDATE InventarioOperadores
    SET
        estado = ?,
        updated_at = NOW()
    WHERE id = ?
";

$stmtActualizar = $conexion->prepare($sqlActualizar);

if (!$stmtActualizar) {
    responder(
        "no",
        "No se pudo preparar la actualización del operador",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

$stmtActualizar->bind_param(
    "ii",
    $nuevoEstado,
    $idOperador
);

if (!$stmtActualizar->execute()) {
    $error = $stmtActualizar->error;
    $stmtActualizar->close();

    responder(
        "no",
        "No se pudo cambiar el estado del operador",
        null,
        [
            "error" => $error
        ],
        500
    );
}

$stmtActualizar->close();

/* ============================================================
 * CONSULTAR RESULTADO ACTUALIZADO
 * ============================================================ */

$sqlResultado = "
    SELECT
        io.id,
        io.idUsuario,
        io.codigo,
        io.tipoDocumento,
        io.documento,
        io.cargo,
        io.observacion,
        io.estado,
        u.nombre,
        u.telefono,
        u.correo,
        u.rol,
        u.estado
    FROM InventarioOperadores io
    LEFT JOIN usuarios u
        ON u.id = io.idUsuario
    WHERE io.id = ?
    LIMIT 1
";

$stmtResultado = $conexion->prepare($sqlResultado);

if (!$stmtResultado) {
    responder(
        "si",
        $nuevoEstado === 1
            ? "Operador activado correctamente"
            : "Operador inactivado correctamente",
        [
            "idOperador" => $idOperador,
            "estado" => $nuevoEstado,
            "estadoTexto" => $nuevoEstado === 1
                ? "Activo"
                : "Inactivo"
        ]
    );
}

$stmtResultado->bind_param("i", $idOperador);

if (!$stmtResultado->execute()) {
    $stmtResultado->close();

    responder(
        "si",
        $nuevoEstado === 1
            ? "Operador activado correctamente"
            : "Operador inactivado correctamente",
        [
            "idOperador" => $idOperador,
            "estado" => $nuevoEstado,
            "estadoTexto" => $nuevoEstado === 1
                ? "Activo"
                : "Inactivo"
        ]
    );
}

$stmtResultado->store_result();

$stmtResultado->bind_result(
    $idResultado,
    $idUsuarioResultado,
    $codigoResultado,
    $tipoDocumentoResultado,
    $documentoResultado,
    $cargoResultado,
    $observacionResultado,
    $estadoOperadorResultado,
    $nombreResultado,
    $telefonoResultado,
    $correoResultado,
    $rolResultado,
    $estadoUsuarioResultado
);

$data = [
    "idOperador" => $idOperador,
    "estado" => $nuevoEstado,
    "estadoTexto" => $nuevoEstado === 1
        ? "Activo"
        : "Inactivo"
];

if ($stmtResultado->fetch()) {
    $operadorActivo = intval($estadoOperadorResultado) === 1;
    $usuarioActivo = intval($estadoUsuarioResultado) === 1;

    $data = [
        "idOperador" => intval($idResultado),
        "id" => intval($idResultado),
        "idUsuario" => intval($idUsuarioResultado),
        "codigo" => $codigoResultado,
        "tipoDocumento" => $tipoDocumentoResultado,
        "documento" => $documentoResultado,
        "nombre" => $nombreResultado,
        "nombreCompleto" => $nombreResultado,
        "telefono" => $telefonoResultado,
        "correo" => $correoResultado,
        "rol" => intval($rolResultado),
        "cargo" => $cargoResultado,
        "observacion" => $observacionResultado,
        "estado" => $operadorActivo ? 1 : 0,
        "estadoTexto" => $operadorActivo
            ? "Activo"
            : "Inactivo",
        "estadoUsuario" => $usuarioActivo ? 1 : 0,
        "estadoUsuarioTexto" => $usuarioActivo
            ? "Activo"
            : "Inactivo",
        "puedeOperar" => (
            $operadorActivo &&
            $usuarioActivo
        ) ? 1 : 0,
        "puedeOperarTexto" => (
            $operadorActivo &&
            $usuarioActivo
        )
            ? "Habilitado"
            : "No habilitado"
    ];
}

$stmtResultado->close();

/* ============================================================
 * RESPUESTA FINAL
 * ============================================================ */

responder(
    "si",
    $nuevoEstado === 1
        ? "Operador activado correctamente"
        : "Operador inactivado correctamente",
    $data
);
?>