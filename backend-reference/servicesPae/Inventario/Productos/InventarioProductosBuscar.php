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
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

function responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
{
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

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder(
        "no",
        "No se encontró la conexión a la base de datos",
        [],
        ["error" => "La variable \$conexion no está disponible"],
        500
    );
}

$conexion->set_charset("utf8mb4");

function limpiarTexto($valor)
{
    return trim((string)($valor ?? ""));
}

function parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return limpiarTexto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return limpiarTexto($_POST[$nombre]);
    }

    return $default;
}

function entradaJson()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (!is_array($json)) {
        return [];
    }

    return $json;
}

function esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function fechaONull($valor)
{
    $valor = limpiarTexto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . esc($valor) . "'";
}

function textoONull($valor)
{
    $valor = limpiarTexto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . esc($valor) . "'";
}

function intONull($valor)
{
    if ($valor === null || $valor === "") {
        return "NULL";
    }

    $valor = intval($valor);

    if ($valor <= 0) {
        return "NULL";
    }

    return (string)$valor;
}

function decimalSeguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function obtenerFila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function obtenerFilas($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $data = [];

    while ($fila = $res->fetch_assoc()) {
        $data[] = $fila;
    }

    return $data;
}

try {
    $q = parametro("q", parametro("busqueda", parametro("term", "")));
    $limite = intval(parametro("limite", 20));

    if ($limite <= 0 || $limite > 100) {
        $limite = 20;
    }

    if ($q === "") {
        responder("si", "Digite un código, nombre o código de barras para buscar", []);
    }

    $qEsc = esc($q);
    $like = "%" . $qEsc . "%";

    /*
     * Busca productos configurados para inventario.
     * Compatible con código interno, nombre/descripción y código de barras.
     */
    $sql = "
        SELECT
            pc.id AS idProducto,
            pc.codigo,
            pc.descripcion,
            pc.idGrupo,
            pc.idEmbalaje,
            pc.estado AS estadoProducto,
            pc.idEstado,

            pic.id AS idConfigInventario,
            pic.idTipoProductoInventario,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario,
            pic.estado AS estadoInventario,

            tpi.codigo AS codigoTipoInventario,
            tpi.nombre AS tipoProductoInventario,
            tpi.requiereFechaVencimiento,
            tpi.requiereBodegaFria,

            eb.producto_base,
            eb.presentacion,
            eb.embalaje,
            eb.`uni/caja` AS uniCaja,

            MAX(CASE WHEN pcb.principal = 1 AND pcb.estado = 1 THEN pcb.codigoBarras ELSE NULL END) AS codigoBarrasPrincipal,
            GROUP_CONCAT(DISTINCT CASE WHEN pcb.estado = 1 THEN pcb.codigoBarras ELSE NULL END ORDER BY pcb.principal DESC, pcb.codigoBarras ASC SEPARATOR '||') AS codigosBarras

        FROM ProductosCatalogo pc

        INNER JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
            AND pic.estado = 1

        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario

        LEFT JOIN EmbalajeCatalogo eb
            ON eb.id = pc.idEmbalaje

        LEFT JOIN ProductosCodigosBarras pcb
            ON pcb.idProducto = pc.id
            AND pcb.estado = 1

        WHERE
            pc.estado = 1
            AND COALESCE(pc.idEstado, 1) = 1
            AND (
                pc.codigo = '$qEsc'
                OR pc.codigo LIKE '$like'
                OR pc.descripcion LIKE '$like'
                OR pcb.codigoBarras = '$qEsc'
                OR pcb.codigoBarras LIKE '$like'
            )

        GROUP BY
            pc.id,
            pc.codigo,
            pc.descripcion,
            pc.idGrupo,
            pc.idEmbalaje,
            pc.estado,
            pc.idEstado,
            pic.id,
            pic.idTipoProductoInventario,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario,
            pic.estado,
            tpi.codigo,
            tpi.nombre,
            tpi.requiereFechaVencimiento,
            tpi.requiereBodegaFria,
            eb.producto_base,
            eb.presentacion,
            eb.embalaje,
            eb.`uni/caja`

        ORDER BY
            CASE
                WHEN MAX(CASE WHEN pcb.codigoBarras = '$qEsc' THEN 1 ELSE 0 END) = 1 THEN 1
                WHEN pc.codigo = '$qEsc' THEN 2
                WHEN pc.codigo LIKE '$qEsc%' THEN 3
                WHEN pc.descripcion LIKE '$qEsc%' THEN 4
                ELSE 5
            END,
            pc.descripcion ASC

        LIMIT $limite
    ";

    $filas = obtenerFilas($sql);
    $data = [];

    foreach ($filas as $fila) {
        $codigos = [];

        if (!empty($fila["codigosBarras"])) {
            $codigos = array_values(array_filter(explode("||", $fila["codigosBarras"])));
        }

        $coincidenciaExacta = false;
        $tipoCoincidencia = "nombre";

        if (in_array($q, $codigos, true)) {
            $coincidenciaExacta = true;
            $tipoCoincidencia = "codigo_barras";
        } elseif ((string)$fila["codigo"] === $q) {
            $coincidenciaExacta = true;
            $tipoCoincidencia = "codigo_producto";
        }

        $data[] = [
            "idProducto" => intval($fila["idProducto"]),
            "id" => intval($fila["idProducto"]),
            "codigo" => (string)$fila["codigo"],
            "descripcion" => (string)$fila["descripcion"],
            "nombre" => (string)$fila["descripcion"],

            "idConfigInventario" => intval($fila["idConfigInventario"]),
            "idTipoProductoInventario" => $fila["idTipoProductoInventario"] !== null
                ? intval($fila["idTipoProductoInventario"])
                : null,
            "codigoTipoInventario" => $fila["codigoTipoInventario"],
            "tipoProductoInventario" => $fila["tipoProductoInventario"],

            "manejaLote" => intval($fila["manejaLote"]),
            "manejaVencimiento" => intval($fila["manejaVencimiento"]),
            "requiereFechaVencimiento" => intval($fila["requiereFechaVencimiento"] ?? $fila["manejaVencimiento"]),
            "requiereBodegaFria" => intval($fila["requiereBodegaFria"] ?? 0),

            "stockMinimo" => floatval($fila["stockMinimo"]),
            "stockMaximo" => $fila["stockMaximo"] !== null ? floatval($fila["stockMaximo"]) : null,
            "unidadBaseInventario" => (string)$fila["unidadBaseInventario"],

            "idEmbalaje" => $fila["idEmbalaje"] !== null ? intval($fila["idEmbalaje"]) : null,
            "producto_base" => $fila["producto_base"],
            "presentacion" => $fila["presentacion"],
            "embalaje" => $fila["embalaje"],
            "uniCaja" => $fila["uniCaja"],

            "codigoBarrasPrincipal" => $fila["codigoBarrasPrincipal"],
            "codigosBarras" => $codigos,

            "coincidenciaExacta" => $coincidenciaExacta ? 1 : 0,
            "tipoCoincidencia" => $tipoCoincidencia,
            "estadoInventario" => intval($fila["estadoInventario"]),
            "estadoTexto" => "Activo"
        ];
    }

    responder(
        "si",
        count($data) > 0 ? "Productos encontrados" : "No se encontraron productos",
        $data,
        [
            "busqueda" => $q,
            "total" => count($data)
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando productos de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
