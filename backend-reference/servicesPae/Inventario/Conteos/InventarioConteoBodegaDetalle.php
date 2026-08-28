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
    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje,
        "data" => $data
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder("no", "No se encontró la conexión a la base de datos", [], [], 500);
}

$conexion->set_charset("utf8mb4");

function limpiarTexto($valor)
{
    return trim((string)($valor ?? ""));
}

function parametro($nombre, $default = "")
{
    return $_GET[$nombre] ?? $_POST[$nombre] ?? $default;
}

function esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)$valor);
}

function obtenerFila($sql)
{
    global $conexion;
    $resultado = $conexion->query($sql);
    if (!$resultado) {
        throw new Exception($conexion->error);
    }
    return $resultado->fetch_assoc() ?: null;
}

function obtenerFilas($sql)
{
    global $conexion;
    $resultado = $conexion->query($sql);
    if (!$resultado) {
        throw new Exception($conexion->error);
    }

    $data = [];
    while ($fila = $resultado->fetch_assoc()) {
        $data[] = $fila;
    }
    return $data;
}

function resolverOperador($idOperador, $idUsuario)
{
    if ($idOperador > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, documento, nombreCompleto, nombre, apellido, cargo
            FROM InventarioOperadores
            WHERE id = $idOperador AND estado = 1
            LIMIT 1
        ");
    }

    if ($idUsuario > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, documento, nombreCompleto, nombre, apellido, cargo
            FROM InventarioOperadores
            WHERE idUsuario = $idUsuario AND estado = 1
            LIMIT 1
        ");
    }

    return null;
}

function validarUsuarioAdministrativo($idUsuario)
{
    if ($idUsuario <= 0) {
        return null;
    }

    $usuario = obtenerFila("
        SELECT id, nombre, correo, rol, estado
        FROM usuarios
        WHERE id = $idUsuario
        LIMIT 1
    ");

    if (!$usuario || intval($usuario["estado"]) !== 1) {
        return null;
    }

    if (defined("INVENTARIO_ROLES_ADMIN_CONTEOS")) {
        $config = constant("INVENTARIO_ROLES_ADMIN_CONTEOS");
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
            && !in_array(
                intval($usuario["rol"]),
                $rolesValidos,
                true
            )
        ) {
            return null;
        }
    }

    return $usuario;
}

function operadorAsignado($idSolicitudConteo, $idOperador)
{
    $fila = obtenerFila("
        SELECT
            s.id,
            s.idOperador,
            s.idOperadorAsignado,
            EXISTS (
                SELECT 1
                FROM InventarioConteoResponsables cr
                WHERE cr.idSolicitudConteo = s.id
                  AND cr.idOperador = $idOperador
                  AND cr.estado = 1
            ) AS asignado
        FROM InventarioSolicitudesConteo s
        WHERE s.id = $idSolicitudConteo
        LIMIT 1
    ");

    if (!$fila) {
        return false;
    }

    return intval($fila["asignado"]) === 1
        || intval($fila["idOperador"]) === $idOperador
        || intval($fila["idOperadorAsignado"]) === $idOperador;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        responder("no", "Método no permitido. Debe utilizar GET", [], [], 405);
    }

    $idSolicitudConteo = intval(parametro("idSolicitudConteo", parametro("id", 0)));
    $idOperadorEntrada = intval(parametro("idOperador", 0));
    $idUsuario = intval(parametro("idUsuario", 0));
    $modoAdministrativo = intval(
        parametro("modoAdministrativo", 0)
    ) === 1;
    $q = limpiarTexto(parametro("q", parametro("busqueda", "")));
    $soloPendientes = intval(parametro("soloPendientes", 0)) === 1;
    $idUbicacion = intval(parametro("idUbicacion", 0));
    $pagina = max(1, intval(parametro("pagina", 1)));
    $limite = intval(parametro("limite", 100));
    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }
    $offset = ($pagina - 1) * $limite;

    if ($idSolicitudConteo <= 0) {
        responder("no", "Debe indicar el conteo de la bodega", [], [], 400);
    }

    $operador = null;
    $idOperador = 0;

    if ($modoAdministrativo) {
        $usuarioAdministrativo =
            validarUsuarioAdministrativo($idUsuario);

        if (!$usuarioAdministrativo) {
            responder(
                "no",
                "El usuario no tiene acceso administrativo al conteo",
                [],
                [],
                403
            );
        }
    } else {
        $operador = resolverOperador(
            $idOperadorEntrada,
            $idUsuario
        );

        if (!$operador) {
            responder(
                "no",
                "No se encontró un operador activo asociado al usuario",
                [],
                [],
                404
            );
        }

        $idOperador = intval($operador["id"]);

        if (
            !operadorAsignado(
                $idSolicitudConteo,
                $idOperador
            )
        ) {
            responder(
                "no",
                "El operador no está asignado a este conteo",
                [],
                [],
                403
            );
        }
    }

    $cabecera = obtenerFila("
        SELECT
            s.id,
            s.codigo,
            s.idOrdenConteo,
            s.idBodega,
            s.estadoProceso,
            s.fechaCorteAplicada,
            s.fechaInicioConteo,
            s.fechaUltimoGuardado,
            s.fechaEnvio,
            s.fechaRevision,
            s.fechaFinalizacion,
            s.numeroRevision,
            s.resultadoVisible,
            s.observacion,
            s.observacionRevision,
            s.idOperador,
            s.idOperadorAsignado,

            o.codigo AS codigoOrden,
            o.nombre AS nombreOrden,
            o.descripcion AS descripcionOrden,
            o.fechaCorte,
            o.fechaInicio,
            o.fechaLimite,
            o.tipoConteo,
            o.estadoProceso AS estadoOrden,
            o.mostrarResultadoBodegas,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            b.descripcion AS descripcionBodega,

            EXISTS (
                SELECT 1
                FROM InventarioConteoResponsables cr
                WHERE cr.idSolicitudConteo = s.id
                  AND cr.idOperador = $idOperador
                  AND cr.estado = 1
                  AND cr.puedeFinalizar = 1
            ) AS permisoFinalizar

        FROM InventarioSolicitudesConteo s
        INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
        INNER JOIN BodegasInventario b ON b.id = s.idBodega
        WHERE s.id = $idSolicitudConteo
        LIMIT 1
    ");

    if (!$cabecera) {
        responder("no", "El conteo de bodega no existe", [], [], 404);
    }

    $resultadoVisible = intval($cabecera["resultadoVisible"]) === 1
        && intval($cabecera["mostrarResultadoBodegas"]) === 1
        && $cabecera["estadoOrden"] === "FINALIZADA";
    $mostrarTeorico = $cabecera["tipoConteo"] === "GUIADO" || $resultadoVisible;

    $where = ["d.idSolicitudConteo = $idSolicitudConteo"];

    if ($q !== "") {
        $like = "%" . esc($q) . "%";
        $where[] = "(
            p.codigo LIKE '$like'
            OR p.descripcion LIKE '$like'
            OR COALESCE(l.lote, '') LIKE '$like'
            OR COALESCE(u.codigo, '') LIKE '$like'
            OR COALESCE(u.nombre, '') LIKE '$like'
            OR EXISTS (
                SELECT 1
                FROM ProductosCodigosBarras cb
                WHERE cb.idProducto = p.id
                  AND cb.estado = 1
                  AND cb.codigoBarras LIKE '$like'
            )
        )";
    }

    if ($soloPendientes) {
        $where[] = "d.conteoRealizado = 0";
    }

    if ($idUbicacion > 0) {
        $where[] = "d.idUbicacion = $idUbicacion";
    }

    $whereSql = implode(" AND ", $where);

    $totalFila = obtenerFila("
        SELECT COUNT(*) AS total
        FROM InventarioConteoDetalle d
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        LEFT JOIN InventarioLotes l ON l.id = d.idLote
        LEFT JOIN UbicacionesInventario u ON u.id = d.idUbicacion
        WHERE $whereSql
    ");
    $total = intval($totalFila["total"] ?? 0);

    $detalles = obtenerFilas("
        SELECT
            d.id,
            d.idSolicitudConteo,
            d.idProducto,
            d.idLote,
            d.idBodega,
            d.idUbicacion,
            d.cantidadSistema,
            d.cantidadDisponibleSistema,
            d.cantidadReservadaSistema,
            d.cantidadBloqueadaSistema,
            d.cantidadTotalSistema,
            d.cantidadFisica,
            d.diferencia,
            d.conteoRealizado,
            d.fechaConteo,
            d.tipoDiferencia,
            d.estadoAnalisis,
            d.observacion,
            d.observacionAnalisis,
            d.updated_at,

            p.codigo AS codigoProducto,
            p.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,
            COALESCE(pic.manejaLote, 1) AS manejaLote,
            COALESCE(pic.manejaVencimiento, 1) AS manejaVencimiento,

            l.lote,
            l.fechaFabricacion,
            l.fechaVencimiento,

            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,

            (
                SELECT cb.codigoBarras
                FROM ProductosCodigosBarras cb
                WHERE cb.idProducto = p.id
                  AND cb.estado = 1
                ORDER BY cb.principal DESC, cb.id ASC
                LIMIT 1
            ) AS codigoBarras

        FROM InventarioConteoDetalle d
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = p.id AND pic.estado = 1
        LEFT JOIN InventarioLotes l ON l.id = d.idLote
        LEFT JOIN UbicacionesInventario u ON u.id = d.idUbicacion
        WHERE $whereSql
        ORDER BY
            COALESCE(u.nombre, 'SIN UBICACIÓN') ASC,
            p.descripcion ASC,
            COALESCE(l.lote, '') ASC
        LIMIT $limite OFFSET $offset
    ");

    $dataDetalles = [];
    foreach ($detalles as $detalle) {
        $contado = intval($detalle["conteoRealizado"]) === 1;

        $dataDetalles[] = [
            "id" => intval($detalle["id"]),
            "idDetalleConteo" => intval($detalle["id"]),
            "idProducto" => intval($detalle["idProducto"]),
            "codigoProducto" => $detalle["codigoProducto"],
            "producto" => $detalle["producto"],
            "codigoBarras" => $detalle["codigoBarras"],
            "unidad" => $detalle["unidad"],
            "manejaLote" => intval($detalle["manejaLote"]),
            "manejaVencimiento" => intval($detalle["manejaVencimiento"]),
            "idLote" => $detalle["idLote"] !== null ? intval($detalle["idLote"]) : null,
            "lote" => $detalle["lote"],
            "fechaFabricacion" => $detalle["fechaFabricacion"],
            "fechaVencimiento" => $detalle["fechaVencimiento"],
            "idBodega" => intval($detalle["idBodega"]),
            "idUbicacion" => $detalle["idUbicacion"] !== null ? intval($detalle["idUbicacion"]) : null,
            "codigoUbicacion" => $detalle["codigoUbicacion"],
            "ubicacion" => $detalle["ubicacion"],
            "conteoRealizado" => $contado,
            "cantidadFisica" => $contado ? round(floatval($detalle["cantidadFisica"]), 3) : null,
            "cantidadSistema" => $mostrarTeorico ? round(floatval($detalle["cantidadSistema"]), 3) : null,
            "cantidadDisponibleSistema" => $mostrarTeorico && $detalle["cantidadDisponibleSistema"] !== null
                ? round(floatval($detalle["cantidadDisponibleSistema"]), 3)
                : null,
            "cantidadReservadaSistema" => $mostrarTeorico && $detalle["cantidadReservadaSistema"] !== null
                ? round(floatval($detalle["cantidadReservadaSistema"]), 3)
                : null,
            "cantidadBloqueadaSistema" => $mostrarTeorico && $detalle["cantidadBloqueadaSistema"] !== null
                ? round(floatval($detalle["cantidadBloqueadaSistema"]), 3)
                : null,
            "diferencia" => $resultadoVisible && $contado
                ? round(floatval($detalle["diferencia"]), 3)
                : null,
            "tipoDiferencia" => $resultadoVisible && $contado ? $detalle["tipoDiferencia"] : null,
            "estadoAnalisis" => $resultadoVisible ? $detalle["estadoAnalisis"] : null,
            "observacion" => $detalle["observacion"],
            "observacionAnalisis" => $resultadoVisible ? $detalle["observacionAnalisis"] : null,
            "fechaConteo" => $detalle["fechaConteo"],
            "updated_at" => $detalle["updated_at"]
        ];
    }

    $resumenFila = obtenerFila("
        SELECT
            COUNT(*) AS totalDetalles,
            SUM(CASE WHEN conteoRealizado = 1 THEN 1 ELSE 0 END) AS totalContados,
            SUM(CASE WHEN conteoRealizado = 0 THEN 1 ELSE 0 END) AS totalPendientes,
            SUM(CASE WHEN conteoRealizado = 1 AND ABS(diferencia) >= 0.0005 THEN 1 ELSE 0 END) AS totalDiferencias
        FROM InventarioConteoDetalle
        WHERE idSolicitudConteo = $idSolicitudConteo
    ");

    $totalDetalles = intval($resumenFila["totalDetalles"] ?? 0);
    $totalContados = intval($resumenFila["totalContados"] ?? 0);
    $totalPendientes = intval($resumenFila["totalPendientes"] ?? 0);

    $ubicaciones = obtenerFilas("
        SELECT id, codigo, nombre, descripcion
        FROM UbicacionesInventario
        WHERE idBodega = " . intval($cabecera["idBodega"]) . "
          AND estado = 1
        ORDER BY nombre ASC
    ");

    $responsables = obtenerFilas("
        SELECT
            cr.idOperador,
            cr.esPrincipal,
            cr.puedeFinalizar,
            op.codigo,
            op.documento,
            op.nombreCompleto,
            op.nombre,
            op.apellido,
            op.cargo
        FROM InventarioConteoResponsables cr
        INNER JOIN InventarioOperadores op ON op.id = cr.idOperador
        WHERE cr.idSolicitudConteo = $idSolicitudConteo
          AND cr.estado = 1
        ORDER BY cr.esPrincipal DESC, COALESCE(NULLIF(op.nombreCompleto, ''), op.nombre) ASC
    ");

    $responsablesData = array_map(function ($fila) {
        $nombre = limpiarTexto($fila["nombreCompleto"]);
        if ($nombre === "") {
            $nombre = trim(limpiarTexto($fila["nombre"]) . " " . limpiarTexto($fila["apellido"]));
        }
        return [
            "idOperador" => intval($fila["idOperador"]),
            "codigo" => $fila["codigo"],
            "documento" => $fila["documento"],
            "nombreCompleto" => $nombre,
            "cargo" => $fila["cargo"],
            "esPrincipal" => intval($fila["esPrincipal"]) === 1,
            "puedeFinalizar" => intval($fila["puedeFinalizar"]) === 1
        ];
    }, $responsables);

    $ahora = time();
    $fechaInicioTs = $cabecera["fechaInicio"] ? strtotime($cabecera["fechaInicio"]) : null;
    $fechaLimiteTs = $cabecera["fechaLimite"] ? strtotime($cabecera["fechaLimite"]) : null;
    $dentroPeriodo = ($fechaInicioTs === null || $ahora >= $fechaInicioTs)
        && ($fechaLimiteTs === null || $ahora <= $fechaLimiteTs);

    $esPrincipal = intval($cabecera["permisoFinalizar"]) === 1
        || intval($cabecera["idOperador"]) === $idOperador
        || intval($cabecera["idOperadorAsignado"]) === $idOperador;

    responder(
        "si",
        "Detalle del conteo consultado correctamente",
        [
            "conteo" => [
                "id" => intval($cabecera["id"]),
                "idSolicitudConteo" => intval($cabecera["id"]),
                "codigo" => $cabecera["codigo"],
                "idOrdenConteo" => intval($cabecera["idOrdenConteo"]),
                "codigoOrden" => $cabecera["codigoOrden"],
                "nombreOrden" => $cabecera["nombreOrden"],
                "descripcionOrden" => $cabecera["descripcionOrden"],
                "idBodega" => intval($cabecera["idBodega"]),
                "codigoBodega" => $cabecera["codigoBodega"],
                "bodega" => $cabecera["bodega"],
                "descripcionBodega" => $cabecera["descripcionBodega"],
                "tipoConteo" => $cabecera["tipoConteo"],
                "estadoProceso" => $cabecera["estadoProceso"],
                "estadoOrden" => $cabecera["estadoOrden"],
                "fechaCorte" => $cabecera["fechaCorte"],
                "fechaCorteAplicada" => $cabecera["fechaCorteAplicada"],
                "fechaInicio" => $cabecera["fechaInicio"],
                "fechaLimite" => $cabecera["fechaLimite"],
                "fechaInicioConteo" => $cabecera["fechaInicioConteo"],
                "fechaUltimoGuardado" => $cabecera["fechaUltimoGuardado"],
                "fechaEnvio" => $cabecera["fechaEnvio"],
                "numeroRevision" => intval($cabecera["numeroRevision"]),
                "observacion" => $cabecera["observacion"],
                "observacionRevision" => $cabecera["observacionRevision"],
                "resultadoVisible" => $resultadoVisible,
                "mostrarTeorico" => $mostrarTeorico,
                "dentroPeriodo" => $dentroPeriodo,
                "modoAdministrativo" => $modoAdministrativo,
                "puedeEditar" => !$modoAdministrativo
                    && $cabecera["estadoProceso"] === "EN_PROCESO"
                    && in_array(
                        $cabecera["estadoOrden"],
                        ["ABIERTA", "EN_CONTEO"],
                        true
                    )
                    && $dentroPeriodo,
                "puedeFinalizar" => !$modoAdministrativo
                    && $esPrincipal,
                "puedeEnviar" => !$modoAdministrativo
                    && $cabecera["estadoProceso"] === "EN_PROCESO"
                    && $esPrincipal
                    && $totalDetalles > 0
                    && $totalPendientes === 0
            ],
            "resumen" => [
                "totalDetalles" => $totalDetalles,
                "totalContados" => $totalContados,
                "totalPendientes" => $totalPendientes,
                "porcentajeAvance" => $totalDetalles > 0
                    ? round(($totalContados * 100) / $totalDetalles, 2)
                    : 0,
                "totalDiferencias" => $resultadoVisible
                    ? intval($resumenFila["totalDiferencias"] ?? 0)
                    : null
            ],
            "detalles" => $dataDetalles,
            "ubicaciones" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idUbicacion" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "descripcion" => $fila["descripcion"]
                ];
            }, $ubicaciones),
            "responsables" => $responsablesData
        ],
        [
            "paginacion" => [
                "pagina" => $pagina,
                "limite" => $limite,
                "total" => $total,
                "totalPaginas" => $limite > 0 ? (int)ceil($total / $limite) : 1
            ]
        ]
    );
} catch (Throwable $e) {
    responder("no", "Error consultando el detalle del conteo", [], ["error" => $e->getMessage()], 500);
}
?>
