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
    $valor = strtolower(trim((string)$valor));

    if (
        $valor === "1" ||
        $valor === "activo" ||
        $valor === "activa" ||
        $valor === "true" ||
        $valor === "si" ||
        $valor === "sí"
    ) {
        return 1;
    }

    return 0;
}

/* ============================================================
 * VALIDAR TABLAS
 * ============================================================ */

function tablaExiste($conexion, $tabla)
{
    $tablaSegura = $conexion->real_escape_string($tabla);

    $resultado = $conexion->query(
        "SHOW TABLES LIKE '$tablaSegura'"
    );

    return $resultado && $resultado->num_rows > 0;
}

if (!tablaExiste($conexion, "usuarios")) {
    responder(
        "no",
        "No se encontró la tabla usuarios",
        null,
        [],
        500
    );
}

if (!tablaExiste($conexion, "InventarioOperadores")) {
    responder(
        "no",
        "No se encontró la tabla InventarioOperadores",
        null,
        [],
        500
    );
}

/* ============================================================
 * DATOS RECIBIDOS
 * ============================================================ */

$idOperador = enteroEntrada(
    $entrada,
    "idOperador",
    enteroEntrada($entrada, "id", 0)
);

$idUsuario = enteroEntrada($entrada, "idUsuario", 0);

$codigo = strtoupper(
    valorEntrada($entrada, "codigo", "")
);

$tipoDocumento = strtoupper(
    valorEntrada($entrada, "tipoDocumento", "CC")
);

$documento = strtoupper(
    valorEntrada($entrada, "documento", "")
);

$cargo = strtoupper(
    valorEntrada($entrada, "cargo", "OPERADOR")
);

$observacion = valorEntrada(
    $entrada,
    "observacion",
    valorEntrada($entrada, "observaciones", "")
);

$estado = normalizarEstado(
    valorEntrada($entrada, "estado", "1")
);

/* ============================================================
 * VALIDACIONES
 * ============================================================ */

if ($idUsuario <= 0) {
    responder(
        "no",
        "Debe seleccionar un usuario del sistema",
        null,
        [
            "campo" => "idUsuario"
        ],
        400
    );
}

if ($documento === "") {
    responder(
        "no",
        "Debe ingresar el documento del operador",
        null,
        [
            "campo" => "documento"
        ],
        400
    );
}

if ($tipoDocumento === "") {
    responder(
        "no",
        "Debe seleccionar el tipo de documento",
        null,
        [
            "campo" => "tipoDocumento"
        ],
        400
    );
}

if ($cargo === "") {
    responder(
        "no",
        "Debe ingresar el cargo o función dentro del inventario",
        null,
        [
            "campo" => "cargo"
        ],
        400
    );
}

/* ============================================================
 * CONSULTAR USUARIO REAL
 * ============================================================ */

$sqlUsuario = "
    SELECT
        id,
        nombre,
        telefono,
        correo,
        rol,
        estado
    FROM usuarios
    WHERE id = ?
    LIMIT 1
";

$stmtUsuario = $conexion->prepare($sqlUsuario);

if (!$stmtUsuario) {
    responder(
        "no",
        "No se pudo preparar la consulta del usuario",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

$stmtUsuario->bind_param("i", $idUsuario);

if (!$stmtUsuario->execute()) {
    responder(
        "no",
        "No se pudo consultar el usuario seleccionado",
        null,
        [
            "error" => $stmtUsuario->error
        ],
        500
    );
}

$stmtUsuario->store_result();

if ($stmtUsuario->num_rows === 0) {
    $stmtUsuario->close();

    responder(
        "no",
        "El usuario seleccionado no existe",
        null,
        [
            "idUsuario" => $idUsuario
        ],
        404
    );
}

$stmtUsuario->bind_result(
    $usuarioId,
    $usuarioNombre,
    $usuarioTelefono,
    $usuarioCorreo,
    $usuarioRol,
    $usuarioEstado
);

$stmtUsuario->fetch();
$stmtUsuario->close();

$usuarioNombre = trim((string)$usuarioNombre);
$usuarioTelefono = trim((string)$usuarioTelefono);
$usuarioCorreo = trim((string)$usuarioCorreo);

if ($usuarioNombre === "") {
    $usuarioNombre = "USUARIO #" . $idUsuario;
}

/* ============================================================
 * GENERAR CÓDIGO AUTOMÁTICO
 * ============================================================ */

if ($codigo === "") {
    $codigo = "OP-" . str_pad(
        (string)$idUsuario,
        5,
        "0",
        STR_PAD_LEFT
    );
}

/* ============================================================
 * VALIDAR OPERADOR EXISTENTE EN EDICIÓN
 * ============================================================ */

if ($idOperador > 0) {
    $sqlExiste = "
        SELECT id
        FROM InventarioOperadores
        WHERE id = ?
        LIMIT 1
    ";

    $stmtExiste = $conexion->prepare($sqlExiste);

    if (!$stmtExiste) {
        responder(
            "no",
            "No se pudo validar el operador",
            null,
            [
                "error" => $conexion->error
            ],
            500
        );
    }

    $stmtExiste->bind_param("i", $idOperador);
    $stmtExiste->execute();
    $stmtExiste->store_result();

    if ($stmtExiste->num_rows === 0) {
        $stmtExiste->close();

        responder(
            "no",
            "El operador que intenta editar no existe",
            null,
            [
                "idOperador" => $idOperador
            ],
            404
        );
    }

    $stmtExiste->close();
}

/* ============================================================
 * VALIDAR USUARIO DUPLICADO
 * ============================================================ */

$sqlDuplicadoUsuario = "
    SELECT id
    FROM InventarioOperadores
    WHERE idUsuario = ?
";

if ($idOperador > 0) {
    $sqlDuplicadoUsuario .= " AND id <> ? ";
}

$sqlDuplicadoUsuario .= " LIMIT 1 ";

$stmtDuplicadoUsuario = $conexion->prepare(
    $sqlDuplicadoUsuario
);

if (!$stmtDuplicadoUsuario) {
    responder(
        "no",
        "No se pudo validar la relación del usuario",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

if ($idOperador > 0) {
    $stmtDuplicadoUsuario->bind_param(
        "ii",
        $idUsuario,
        $idOperador
    );
} else {
    $stmtDuplicadoUsuario->bind_param(
        "i",
        $idUsuario
    );
}

$stmtDuplicadoUsuario->execute();
$stmtDuplicadoUsuario->store_result();

if ($stmtDuplicadoUsuario->num_rows > 0) {
    $stmtDuplicadoUsuario->close();

    responder(
        "no",
        "El usuario seleccionado ya está vinculado como operador de inventario",
        null,
        [
            "tipoError" => "usuario_duplicado",
            "idUsuario" => $idUsuario
        ],
        409
    );
}

$stmtDuplicadoUsuario->close();

/* ============================================================
 * VALIDAR DOCUMENTO DUPLICADO
 * ============================================================ */

$sqlDuplicadoDocumento = "
    SELECT id
    FROM InventarioOperadores
    WHERE documento = ?
";

if ($idOperador > 0) {
    $sqlDuplicadoDocumento .= " AND id <> ? ";
}

$sqlDuplicadoDocumento .= " LIMIT 1 ";

$stmtDuplicadoDocumento = $conexion->prepare(
    $sqlDuplicadoDocumento
);

if (!$stmtDuplicadoDocumento) {
    responder(
        "no",
        "No se pudo validar el documento",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

if ($idOperador > 0) {
    $stmtDuplicadoDocumento->bind_param(
        "si",
        $documento,
        $idOperador
    );
} else {
    $stmtDuplicadoDocumento->bind_param(
        "s",
        $documento
    );
}

$stmtDuplicadoDocumento->execute();
$stmtDuplicadoDocumento->store_result();

if ($stmtDuplicadoDocumento->num_rows > 0) {
    $stmtDuplicadoDocumento->close();

    responder(
        "no",
        "Ya existe un operador con el documento ingresado",
        null,
        [
            "tipoError" => "documento_duplicado",
            "documento" => $documento
        ],
        409
    );
}

$stmtDuplicadoDocumento->close();

/* ============================================================
 * VALIDAR CÓDIGO DUPLICADO
 * ============================================================ */

$sqlDuplicadoCodigo = "
    SELECT id
    FROM InventarioOperadores
    WHERE codigo = ?
";

if ($idOperador > 0) {
    $sqlDuplicadoCodigo .= " AND id <> ? ";
}

$sqlDuplicadoCodigo .= " LIMIT 1 ";

$stmtDuplicadoCodigo = $conexion->prepare(
    $sqlDuplicadoCodigo
);

if (!$stmtDuplicadoCodigo) {
    responder(
        "no",
        "No se pudo validar el código",
        null,
        [
            "error" => $conexion->error
        ],
        500
    );
}

if ($idOperador > 0) {
    $stmtDuplicadoCodigo->bind_param(
        "si",
        $codigo,
        $idOperador
    );
} else {
    $stmtDuplicadoCodigo->bind_param(
        "s",
        $codigo
    );
}

$stmtDuplicadoCodigo->execute();
$stmtDuplicadoCodigo->store_result();

if ($stmtDuplicadoCodigo->num_rows > 0) {
    $stmtDuplicadoCodigo->close();

    responder(
        "no",
        "Ya existe un operador con el código ingresado",
        null,
        [
            "tipoError" => "codigo_duplicado",
            "codigo" => $codigo
        ],
        409
    );
}

$stmtDuplicadoCodigo->close();

/* ============================================================
 * DATOS DERIVADOS DEL USUARIO
 * ============================================================ */

$nombre = $usuarioNombre;
$apellido = "";
$nombreCompleto = $usuarioNombre;
$telefono = $usuarioTelefono;
$correo = $usuarioCorreo;

/* ============================================================
 * GUARDAR
 * ============================================================ */

$conexion->begin_transaction();

try {
    if ($idOperador > 0) {
        $sqlGuardar = "
            UPDATE InventarioOperadores
            SET
                idUsuario = ?,
                codigo = ?,
                tipoDocumento = ?,
                documento = ?,
                nombre = ?,
                apellido = ?,
                nombreCompleto = ?,
                telefono = ?,
                correo = ?,
                cargo = ?,
                observacion = ?,
                estado = ?,
                updated_at = NOW()
            WHERE id = ?
        ";

        $stmtGuardar = $conexion->prepare($sqlGuardar);

        if (!$stmtGuardar) {
            throw new Exception($conexion->error);
        }

        $stmtGuardar->bind_param(
            "issssssssssii",
            $idUsuario,
            $codigo,
            $tipoDocumento,
            $documento,
            $nombre,
            $apellido,
            $nombreCompleto,
            $telefono,
            $correo,
            $cargo,
            $observacion,
            $estado,
            $idOperador
        );

        if (!$stmtGuardar->execute()) {
            throw new Exception($stmtGuardar->error);
        }

        $stmtGuardar->close();

        $mensaje = "Operador actualizado correctamente";
    } else {
        $sqlGuardar = "
            INSERT INTO InventarioOperadores
            (
                idUsuario,
                codigo,
                tipoDocumento,
                documento,
                nombre,
                apellido,
                nombreCompleto,
                telefono,
                correo,
                cargo,
                observacion,
                estado,
                created_at,
                updated_at
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                NOW(),
                NOW()
            )
        ";

        $stmtGuardar = $conexion->prepare($sqlGuardar);

        if (!$stmtGuardar) {
            throw new Exception($conexion->error);
        }

        $stmtGuardar->bind_param(
            "issssssssssi",
            $idUsuario,
            $codigo,
            $tipoDocumento,
            $documento,
            $nombre,
            $apellido,
            $nombreCompleto,
            $telefono,
            $correo,
            $cargo,
            $observacion,
            $estado
        );

        if (!$stmtGuardar->execute()) {
            throw new Exception($stmtGuardar->error);
        }

        $idOperador = $conexion->insert_id;

        $stmtGuardar->close();

        $mensaje = "Operador creado correctamente";
    }

    $conexion->commit();
} catch (Throwable $error) {
    $conexion->rollback();

    responder(
        "no",
        "No se pudo guardar el operador",
        null,
        [
            "error" => $error->getMessage()
        ],
        500
    );
}

/* ============================================================
 * CONSULTAR REGISTRO GUARDADO
 * ============================================================ */

$sqlResultado = "
    SELECT
        io.id AS idOperador,
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
        u.estado AS estadoUsuario
    FROM InventarioOperadores io
    INNER JOIN usuarios u
        ON u.id = io.idUsuario
    WHERE io.id = ?
    LIMIT 1
";

$stmtResultado = $conexion->prepare($sqlResultado);

if (!$stmtResultado) {
    responder(
        "si",
        $mensaje,
        [
            "idOperador" => $idOperador
        ]
    );
}

$stmtResultado->bind_param("i", $idOperador);
$stmtResultado->execute();
$stmtResultado->store_result();

$stmtResultado->bind_result(
    $resultadoIdOperador,
    $resultadoIdUsuario,
    $resultadoCodigo,
    $resultadoTipoDocumento,
    $resultadoDocumento,
    $resultadoCargo,
    $resultadoObservacion,
    $resultadoEstado,
    $resultadoNombre,
    $resultadoTelefono,
    $resultadoCorreo,
    $resultadoRol,
    $resultadoEstadoUsuario
);

$data = [
    "idOperador" => $idOperador,
    "idUsuario" => $idUsuario
];

if ($stmtResultado->fetch()) {
    $data = [
        "idOperador" => intval($resultadoIdOperador),
        "id" => intval($resultadoIdOperador),
        "idUsuario" => intval($resultadoIdUsuario),
        "codigo" => $resultadoCodigo,
        "tipoDocumento" => $resultadoTipoDocumento,
        "documento" => $resultadoDocumento,
        "nombre" => $resultadoNombre,
        "nombreCompleto" => $resultadoNombre,
        "telefono" => $resultadoTelefono,
        "correo" => $resultadoCorreo,
        "rol" => intval($resultadoRol),
        "cargo" => $resultadoCargo,
        "observacion" => $resultadoObservacion,
        "estado" => intval($resultadoEstado),
        "estadoTexto" => intval($resultadoEstado) === 1
            ? "Activo"
            : "Inactivo",
        "estadoUsuario" => intval($resultadoEstadoUsuario)
    ];
}

$stmtResultado->close();

responder(
    "si",
    $mensaje,
    $data
);
?>