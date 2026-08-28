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

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function jexit($code, $arr) {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

function obtenerProductoMostrar($detalle) {
    if (!empty($detalle["productoExcel"])) {
        return trim((string)$detalle["productoExcel"]);
    }
    if (!empty($detalle["descripcionMostrada"])) {
        return trim((string)$detalle["descripcionMostrada"]);
    }
    if (!empty($detalle["producto"]["descripcion"])) {
        return trim((string)$detalle["producto"]["descripcion"]);
    }
    return "Sin producto";
}

function obtenerIdProductoDetalle($detalle) {
    if (isset($detalle["producto"]["idProducto"])) {
        return (int)$detalle["producto"]["idProducto"];
    }
    if (isset($detalle["producto"]["id"])) {
        return (int)$detalle["producto"]["id"];
    }
    if (isset($detalle["idProducto"])) {
        return (int)$detalle["idProducto"];
    }
    return 0;
}

function obtenerIdRutaDetalle($ruta) {
    if (isset($ruta["idRuta"])) {
        return (int)$ruta["idRuta"];
    }
    if (isset($ruta["id"])) {
        return (int)$ruta["id"];
    }
    return 0;
}

$idDespacho = isset($_GET["idDespacho"]) ? (int)$_GET["idDespacho"] : 0;
$idProducto = isset($_GET["idProducto"]) ? (int)$_GET["idProducto"] : 0;
$idRuta     = isset($_GET["idRuta"]) ? (int)$_GET["idRuta"] : 0;

if ($idDespacho <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El parámetro idDespacho es obligatorio"
    ]);
}

if ($idProducto <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El parámetro idProducto es obligatorio"
    ]);
}

if ($idRuta <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El parámetro idRuta es obligatorio"
    ]);
}

$detalleUrl = "https://app.accionporcolombia.com/servicesPae/Despachos/DespachosGetDetalle.php?idDespacho=" . $idDespacho;

$context = stream_context_create([
    "http" => [
        "method" => "GET",
        "timeout" => 60,
        "header" => "Accept: application/json\r\nCache-Control: no-cache\r\n"
    ]
]);

$respuestaRaw = @file_get_contents($detalleUrl, false, $context);

if ($respuestaRaw === false) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo consultar el servicio de detalle del despacho",
        "url" => $detalleUrl
    ]);
}

$respuesta = json_decode($respuestaRaw, true);

if (!is_array($respuesta) || ($respuesta["rpta"] ?? "no") !== "si") {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => $respuesta["mensaje"] ?? "El servicio de detalle no devolvió una respuesta válida",
        "raw" => $respuestaRaw
    ]);
}

$data = $respuesta["data"] ?? [];
$archivos = $data["archivos"] ?? [];
$despacho = $data["despacho"] ?? [];

$ORDEN_JORNADAS = ["AM", "PM", "JORNADA_UNICA"];
$registros = [];

// Debug útil para validar estructura real
$debug = [
    "idDespacho" => $idDespacho,
    "idProductoBuscado" => $idProducto,
    "idRutaBuscada" => $idRuta,
    "rutasDetectadas" => [],
    "productosDetectados" => [],
    "totalRutasRecorridas" => 0,
    "totalDetallesRecorridos" => 0,
    "coincidenciasRuta" => 0,
    "coincidenciasProducto" => 0
];

foreach ($ORDEN_JORNADAS as $tipoJornada) {
    $listaArchivos = isset($archivos[$tipoJornada]) && is_array($archivos[$tipoJornada])
        ? $archivos[$tipoJornada]
        : [];

    foreach ($listaArchivos as $archivo) {
        $rutas = isset($archivo["rutas"]) && is_array($archivo["rutas"])
            ? $archivo["rutas"]
            : [];

        foreach ($rutas as $ruta) {
            $debug["totalRutasRecorridas"]++;

            $idRutaDetalle = obtenerIdRutaDetalle($ruta);

            if (count($debug["rutasDetectadas"]) < 20) {
                $debug["rutasDetectadas"][] = [
                    "idRuta" => $idRutaDetalle,
                    "nombreRuta" => $ruta["nombreRuta"] ?? null
                ];
            }

            if ($idRutaDetalle !== $idRuta) {
                continue;
            }

            $debug["coincidenciasRuta"]++;

            $detalles = isset($ruta["detalles"]) && is_array($ruta["detalles"])
                ? $ruta["detalles"]
                : [];

            foreach ($detalles as $detalle) {
                $debug["totalDetallesRecorridos"]++;

                $idProductoDetalle = obtenerIdProductoDetalle($detalle);

                if (count($debug["productosDetectados"]) < 30) {
                    $debug["productosDetectados"][] = [
                        "idProducto" => $idProductoDetalle,
                        "productoExcel" => $detalle["productoExcel"] ?? null,
                        "descripcionMostrada" => $detalle["descripcionMostrada"] ?? null,
                        "descripcionProducto" => $detalle["producto"]["descripcion"] ?? null
                    ];
                }

                if ($idProductoDetalle !== $idProducto) {
                    continue;
                }

                $debug["coincidenciasProducto"]++;

                $registros[] = [
                    "jornada" => $tipoJornada,
                    "idRuta" => $idRutaDetalle,
                    "ruta" => $ruta["nombreRuta"] ?? "Sin ruta",
                    "idDetalle" => $detalle["idDetalle"] ?? null,
                    "consecutivo" => $detalle["consecutivo"] ?? null,
                    "productoExcel" => $detalle["productoExcel"] ?? null,
                    "descripcionMostrada" => $detalle["descripcionMostrada"] ?? null,
                    "productoMostrar" => obtenerProductoMostrar($detalle),
                    "unidadCoberturaExcel" => $detalle["unidadCoberturaExcel"] ?? null,
                    "unidadCobertura" => $detalle["unidadCobertura"] ?? null,
                    "cantidad" => isset($detalle["cantidad"]) ? (float)$detalle["cantidad"] : 0,
                    "totalCoberturaRuta" => isset($detalle["totalCoberturaRuta"]) ? (float)$detalle["totalCoberturaRuta"] : 0,
                    "cajasPacas" => isset($detalle["cajasPacas"]) ? (float)$detalle["cajasPacas"] : 0,
                    "unidades" => isset($detalle["unidades"]) ? (float)$detalle["unidades"] : 0,
                    "observacion" => $detalle["observacion"] ?? null,
                    "colegio" => [
                        "idColegio" => $detalle["colegio"]["idColegio"] ?? null,
                        "codigo" => $detalle["colegio"]["codigo"] ?? null,
                        "nombre" => $detalle["colegio"]["nombre"] ?? null,
                    ],
                    "producto" => [
                        "idProducto" => $detalle["producto"]["idProducto"] ?? ($detalle["producto"]["id"] ?? null),
                        "descripcion" => $detalle["producto"]["descripcion"] ?? null,
                        "grupo" => [
                            "idGrupo" => $detalle["producto"]["grupo"]["idGrupo"] ?? null,
                            "codigo" => $detalle["producto"]["grupo"]["codigo"] ?? null,
                            "idCategoria" => $detalle["producto"]["grupo"]["idCategoria"] ?? null,
                        ],
                        "categoria" => [
                            "idCategoria" => $detalle["producto"]["categoria"]["idCategoria"] ?? null,
                            "nombre" => $detalle["producto"]["categoria"]["nombre"] ?? null,
                        ]
                    ]
                ];
            }
        }
    }
}

jexit(200, [
    "rpta" => "si",
    "mensaje" => count($registros) > 0
        ? "Consulta realizada correctamente"
        : "Consulta realizada sin coincidencias",
    "data" => [
        "despacho" => [
            "id" => $despacho["id"] ?? null,
            "codigo" => $despacho["codigo"] ?? "Sin código",
            "fechaDespacho" => $despacho["fechaDespacho"] ?? "-",
            "tipoPeriodo" => $despacho["tipoPeriodo"] ?? "-",
            "descripcion" => $despacho["descripcion"] ?? "Sin descripción",
            "estado" => $despacho["estado"]["nombre"] ?? "-"
        ],
        "filtros" => [
            "idProducto" => $idProducto,
            "idRuta" => $idRuta
        ],
        "totalRegistros" => count($registros),
        "registros" => $registros,
        "debug" => $debug
    ]
]);