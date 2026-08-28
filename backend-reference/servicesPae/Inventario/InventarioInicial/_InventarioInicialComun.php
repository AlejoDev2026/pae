<?php

/*
 * Funciones compartidas del módulo Inventario inicial.
 *
 * Este archivo NO crea una conexión nueva. Reutiliza exactamente la conexión
 * general que ya existe en servicesPae/Inventario/conexion.php.
 */

ini_set("display_errors", 1);
ini_set("display_startup_errors", 1);
error_reporting(E_ALL);

header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

const II_CODIGO_TIPO_DOCUMENTO = "INV_INICIAL";
const II_ESTADO_BORRADOR = "BORRADOR";
const II_ESTADO_FINALIZADA = "FINALIZADA";
const II_ESTADO_ANULADA = "ANULADA";

function ii_responder($ok, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
{
    http_response_code($codigoHttp);

    echo json_encode(
        array_merge([
            "rpta" => $ok ? "si" : "no",
            "mensaje" => $mensaje,
            "data" => $data
        ], $extra),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    ii_responder(
        false,
        "No se encontró la conexión a la base de datos",
        [],
        ["error" => "La variable \$conexion no está disponible"],
        500
    );
}

$conexion->set_charset("utf8mb4");

function ii_buscar_conexion()
{
    global $conexion;
    return $conexion;
}

function ii_entrada_json()
{
    static $entrada = null;

    if ($entrada !== null) {
        return $entrada;
    }

    $contenido = file_get_contents("php://input");
    $json = json_decode($contenido, true);
    $entrada = is_array($json) ? $json : $_POST;

    return $entrada;
}

function ii_entero($valor, $campo)
{
    $numero = filter_var($valor, FILTER_VALIDATE_INT);

    if ($numero === false || intval($numero) <= 0) {
        ii_responder(false, "El campo $campo no es válido.", [], [], 422);
    }

    return intval($numero);
}

function ii_decimal_positivo($valor, $campo)
{
    $normalizado = str_replace(",", ".", trim((string)$valor));

    if (!is_numeric($normalizado) || floatval($normalizado) <= 0) {
        ii_responder(false, "El campo $campo debe ser mayor que cero.", [], [], 422);
    }

    return round(floatval($normalizado), 3);
}

function ii_fecha($valor, $campo)
{
    $fecha = trim((string)$valor);
    $objeto = DateTime::createFromFormat("Y-m-d", $fecha);

    if (!$objeto || $objeto->format("Y-m-d") !== $fecha) {
        ii_responder(
            false,
            "El campo $campo debe tener el formato AAAA-MM-DD.",
            [],
            [],
            422
        );
    }

    return $fecha;
}

function ii_texto($valor, $maximo = 1000)
{
    return mb_substr(trim((string)($valor ?? "")), 0, $maximo);
}

function ii_preparar($db, $sql)
{
    $stmt = $db->prepare($sql);

    if (!$stmt) {
        throw new Exception(
            "No fue posible preparar la consulta: " . $db->error
        );
    }

    return $stmt;
}

/*
 * Obtiene todas las filas de una sentencia preparada mediante bind_result y
 * fetch. De esta forma no depende de mysqlnd y funciona en servidores
 * cPanel/PHP 7.3 que no incluyen esa extensión.
 */
function ii_stmt_filas($stmt)
{
    $metadata = $stmt->result_metadata();

    if ($metadata === false) {
        return [];
    }

    $nombres = [];

    while ($campo = $metadata->fetch_field()) {
        $nombres[] = $campo->name;
    }

    $metadata->free();

    if (count($nombres) === 0) {
        return [];
    }

    $valores = array_fill(0, count($nombres), null);
    $referencias = [];

    foreach ($valores as $indice => &$valor) {
        $referencias[$indice] = &$valor;
    }
    unset($valor);

    if (!call_user_func_array([$stmt, "bind_result"], $referencias)) {
        throw new Exception(
            "No fue posible enlazar el resultado de la consulta: "
            . $stmt->error
        );
    }

    $filas = [];

    while ($stmt->fetch()) {
        $fila = [];

        foreach ($nombres as $indice => $nombre) {
            $fila[$nombre] = $valores[$indice];
        }

        $filas[] = $fila;
    }

    if ($stmt->errno) {
        throw new Exception(
            "No fue posible leer el resultado de la consulta: "
            . $stmt->error
        );
    }

    return $filas;
}

function ii_stmt_fila($stmt)
{
    $filas = ii_stmt_filas($stmt);
    return count($filas) > 0 ? $filas[0] : null;
}

/*
 * Enlaza una cantidad dinámica de parámetros conservando las referencias
 * exigidas por mysqli_stmt::bind_param en PHP 7.3.
 */
function ii_bind_parametros($stmt, $tipos, &$valores)
{
    if ($tipos === "") {
        return;
    }

    $argumentos = [$tipos];

    foreach ($valores as $indice => &$valor) {
        $argumentos[] = &$valor;
    }
    unset($valor);

    if (!call_user_func_array([$stmt, "bind_param"], $argumentos)) {
        throw new Exception(
            "No fue posible enlazar los parámetros de la consulta: "
            . $stmt->error
        );
    }
}

function ii_obtener_fila($db, $sql)
{
    $resultado = $db->query($sql);

    if (!$resultado) {
        throw new Exception($db->error);
    }

    return $resultado->fetch_assoc() ?: null;
}

function ii_tipo_documento($db)
{
    $codigo = II_CODIGO_TIPO_DOCUMENTO;
    $naturaleza = "INVENTARIO_INICIAL";

    $stmt = ii_preparar(
        $db,
        "SELECT
            id,
            id AS idTipoDocumento,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            estado
         FROM TiposDocumentoInventario
         WHERE estado = 1
           AND afectaInventario = 1
           AND (
                naturaleza = ?
                OR codigo = ?
                OR codigo = 'INVENTARIO_INICIAL'
           )
         ORDER BY
            CASE WHEN naturaleza = ? THEN 0 ELSE 1 END,
            id ASC
         LIMIT 1"
    );
    $stmt->bind_param("sss", $naturaleza, $codigo, $naturaleza);
    $stmt->execute();
    $tipo = ii_stmt_fila($stmt);
    $stmt->close();

    if (!$tipo) {
        ii_responder(
            false,
            "No existe un tipo documental activo para Inventario inicial.",
            [],
            [
                "configuracionRequerida" => [
                    "codigo" => II_CODIGO_TIPO_DOCUMENTO,
                    "naturaleza" => "INVENTARIO_INICIAL",
                    "afectaInventario" => 1,
                    "estado" => 1
                ]
            ],
            409
        );
    }

    return $tipo;
}

function ii_operador_usuario($db, $idUsuario)
{
    $stmt = ii_preparar(
        $db,
        "SELECT
            id,
            id AS idOperador,
            idUsuario,
            codigo,
            nombre,
            apellido,
            nombreCompleto,
            cargo,
            estado
         FROM InventarioOperadores
         WHERE idUsuario = ?
           AND estado = 1
         LIMIT 1"
    );
    $stmt->bind_param("i", $idUsuario);
    $stmt->execute();
    $operador = ii_stmt_fila($stmt);
    $stmt->close();

    return $operador;
}

function ii_validar_usuario_administrativo($db, $idUsuario)
{
    if ($idUsuario <= 0) {
        ii_responder(
            false,
            "Debe indicar el usuario administrativo.",
            [],
            [],
            400
        );
    }

    $stmt = ii_preparar(
        $db,
        "SELECT id, nombre, correo, rol, estado
         FROM usuarios
         WHERE id = ?
         LIMIT 1"
    );
    $stmt->bind_param("i", $idUsuario);
    $stmt->execute();
    $usuario = ii_stmt_fila($stmt);
    $stmt->close();

    if (!$usuario || intval($usuario["estado"]) !== 1) {
        ii_responder(
            false,
            "El usuario administrativo no existe o está inactivo.",
            [],
            [],
            403
        );
    }

    /*
     * El control de roles se activa solo si el proyecto ya define la
     * constante. Así se conserva la misma estrategia usada en Conteos.
     */
    if (defined("INVENTARIO_ROLES_ADMIN")) {
        $config = constant("INVENTARIO_ROLES_ADMIN");
        $roles = is_array($config)
            ? $config
            : explode(",", (string)$config);
        $rolesValidos = [];

        foreach ($roles as $rol) {
            $idRol = intval($rol);

            if ($idRol > 0) {
                $rolesValidos[] = $idRol;
            }
        }

        if (
            count($rolesValidos) > 0
            && !in_array(intval($usuario["rol"]), $rolesValidos, true)
        ) {
            ii_responder(
                false,
                "El usuario no tiene permisos para administrar el inventario inicial.",
                [],
                [],
                403
            );
        }
    }

    return [
        "usuario" => $usuario,
        "operador" => ii_operador_usuario($db, $idUsuario)
    ];
}

function ii_es_tipo_inventario_inicial_sql($alias = "td")
{
    return "(
        $alias.naturaleza = 'INVENTARIO_INICIAL'
        OR $alias.codigo IN ('INV_INICIAL', 'INVENTARIO_INICIAL')
    )";
}

function ii_estado_bodega($db, $idBodega, $ignorarDocumento = null)
{
    $stmt = ii_preparar(
        $db,
        "SELECT COUNT(*) AS total
         FROM InventarioMovimientos
         WHERE idBodega = ?"
    );
    $stmt->bind_param("i", $idBodega);
    $stmt->execute();
    $filaMovimientos = ii_stmt_fila($stmt);
    $totalMovimientos = intval($filaMovimientos["total"] ?? 0);
    $stmt->close();

    $stmt = ii_preparar(
        $db,
        "SELECT COUNT(*) AS total
         FROM InventarioExistencias
         WHERE idBodega = ?
           AND (
                cantidadDisponible <> 0
                OR cantidadReservada <> 0
                OR cantidadBloqueada <> 0
           )"
    );
    $stmt->bind_param("i", $idBodega);
    $stmt->execute();
    $filaExistencias = ii_stmt_fila($stmt);
    $totalExistencias = intval($filaExistencias["total"] ?? 0);
    $stmt->close();

    $sql = "SELECT
                d.id,
                d.id AS idDocumento,
                d.consecutivo,
                d.estadoProceso,
                d.fechaDocumento
            FROM InventarioDocumentos d
            INNER JOIN TiposDocumentoInventario td
                ON td.id = d.idTipoDocumento
            INNER JOIN InventarioDocumentoDetalle dd
                ON dd.idDocumento = d.id
            INNER JOIN InventarioDocumentoDetalleLotes ddl
                ON ddl.idDocumentoDetalle = dd.id
            WHERE " . ii_es_tipo_inventario_inicial_sql("td") . "
              AND ddl.idBodega = ?
              AND d.estadoProceso <> 'ANULADA'";

    if ($ignorarDocumento !== null && intval($ignorarDocumento) > 0) {
        $sql .= " AND d.id <> ?";
    }

    $sql .= " GROUP BY
                d.id,
                d.consecutivo,
                d.estadoProceso,
                d.fechaDocumento
              ORDER BY d.id DESC
              LIMIT 1";

    $stmt = ii_preparar($db, $sql);

    if ($ignorarDocumento !== null && intval($ignorarDocumento) > 0) {
        $idIgnorar = intval($ignorarDocumento);
        $stmt->bind_param("ii", $idBodega, $idIgnorar);
    } else {
        $stmt->bind_param("i", $idBodega);
    }

    $stmt->execute();
    $documento = ii_stmt_fila($stmt);
    $stmt->close();

    $estado = "SIN_INVENTARIO_INICIAL";

    if ($documento) {
        $estado = strtoupper((string)$documento["estadoProceso"]);
    } elseif ($totalMovimientos > 0) {
        $estado = "CON_MOVIMIENTOS_PREVIOS";
    } elseif ($totalExistencias > 0) {
        $estado = "CON_EXISTENCIAS_PREVIAS";
    }

    return [
        "estado" => $estado,
        "totalMovimientos" => $totalMovimientos,
        "totalExistencias" => $totalExistencias,
        "documento" => $documento,
        /*
         * Los movimientos y existencias previas se informan al usuario, pero
         * no bloquean la carga. Solo otro inventario inicial activo o
         * finalizado impide crear uno nuevo para la misma bodega.
         */
        "puedeCrear" => !$documento
    ];
}

function ii_documento($db, $idDocumento, $bloquear = false)
{
    $sql = "SELECT
                d.*,
                d.id AS idDocumento,
                td.codigo AS codigoTipoDocumento,
                td.nombre AS nombreTipoDocumento,
                td.naturaleza,
                td.tipoMovimiento,
                u.nombre AS usuarioRegistro,
                op.nombreCompleto AS operador
            FROM InventarioDocumentos d
            INNER JOIN TiposDocumentoInventario td
                ON td.id = d.idTipoDocumento
            LEFT JOIN usuarios u
                ON u.id = d.idUsuarioRegistro
            LEFT JOIN InventarioOperadores op
                ON op.id = d.idOperador
            WHERE d.id = ?
              AND " . ii_es_tipo_inventario_inicial_sql("td") . "
            LIMIT 1";

    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }

    $stmt = ii_preparar($db, $sql);
    $stmt->bind_param("i", $idDocumento);
    $stmt->execute();
    $documento = ii_stmt_fila($stmt);
    $stmt->close();

    return $documento;
}

function ii_detalles_documento($db, $idDocumento, $bloquear = false)
{
    $sql = "SELECT
                dd.id,
                dd.id AS idDocumentoDetalle,
                dd.idDocumento,
                dd.idProducto,
                dd.cantidadSolicitada,
                dd.cantidadProcesada,
                ddl.cantidad,
                dd.unidad,
                ddl.idBodega,
                ddl.idUbicacion,
                ddl.idLote,
                COALESCE(ddl.observacion, dd.observacion, '') AS observacion,
                pc.codigo AS codigoProducto,
                pc.descripcion,
                pic.manejaLote,
                pic.manejaVencimiento,
                b.codigo AS codigoBodega,
                b.nombre AS nombreBodega,
                u.codigo AS codigoUbicacion,
                u.nombre AS nombreUbicacion,
                l.lote,
                l.fechaFabricacion,
                l.fechaVencimiento
            FROM InventarioDocumentoDetalle dd
            INNER JOIN InventarioDocumentoDetalleLotes ddl
                ON ddl.idDocumentoDetalle = dd.id
            INNER JOIN ProductosCatalogo pc
                ON pc.id = dd.idProducto
            INNER JOIN ProductosInventarioConfig pic
                ON pic.idProducto = dd.idProducto
            INNER JOIN BodegasInventario b
                ON b.id = ddl.idBodega
            LEFT JOIN UbicacionesInventario u
                ON u.id = ddl.idUbicacion
            LEFT JOIN InventarioLotes l
                ON l.id = ddl.idLote
            WHERE dd.idDocumento = ?
            ORDER BY dd.id ASC, ddl.id ASC";

    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }

    $stmt = ii_preparar($db, $sql);
    $stmt->bind_param("i", $idDocumento);
    $stmt->execute();
    $filas = ii_stmt_filas($stmt);
    $detalles = [];

    foreach ($filas as $fila) {
        $fila["cantidad"] = round(floatval($fila["cantidad"]), 3);
        $fila["manejaLote"] = intval($fila["manejaLote"]);
        $fila["manejaVencimiento"] = intval($fila["manejaVencimiento"]);
        $detalles[] = $fila;
    }

    $stmt->close();
    return $detalles;
}

function ii_generar_consecutivo($db)
{
    $base = "INI-" . date("Ymd-His");

    for ($intento = 0; $intento < 30; $intento++) {
        $sufijo = str_pad((string)random_int(0, 999), 3, "0", STR_PAD_LEFT);
        $consecutivo = $base . "-" . $sufijo;

        $stmt = ii_preparar(
            $db,
            "SELECT id
             FROM InventarioDocumentos
             WHERE consecutivo = ?
             LIMIT 1"
        );
        $stmt->bind_param("s", $consecutivo);
        $stmt->execute();
        $existe = ii_stmt_fila($stmt);
        $stmt->close();

        if (!$existe) {
            return $consecutivo;
        }
    }

    throw new Exception(
        "No fue posible generar un consecutivo único para el inventario inicial."
    );
}

function ii_mensaje_excepcion($error)
{
    error_log("[InventarioInicial] " . $error->getMessage());
    return $error->getMessage();
}

?>
