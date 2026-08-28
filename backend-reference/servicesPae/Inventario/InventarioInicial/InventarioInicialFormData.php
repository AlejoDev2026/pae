<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    $db = ii_buscar_conexion();
    $idUsuario = ii_entero($_GET["idUsuario"] ?? 0, "idUsuario");
    $acceso = ii_validar_usuario_administrativo($db, $idUsuario);
    $tipoDocumento = ii_tipo_documento($db);

    $bodegas = [];
    $resultado = $db->query(
        "SELECT id, id AS idBodega, codigo, nombre, estado
         FROM BodegasInventario
         WHERE estado = 1
         ORDER BY nombre ASC"
    );

    while ($bodega = $resultado->fetch_assoc()) {
        $estado = ii_estado_bodega($db, intval($bodega["idBodega"]));
        $bodega["id"] = intval($bodega["id"]);
        $bodega["idBodega"] = intval($bodega["idBodega"]);
        $bodega["estado"] = intval($bodega["estado"]);
        $bodega["estadoInventarioInicial"] = $estado["estado"];
        $bodega["puedeCrearInventarioInicial"] = $estado["puedeCrear"];
        $bodega["totalMovimientos"] = $estado["totalMovimientos"];
        $bodega["totalExistencias"] = $estado["totalExistencias"];
        $bodegas[] = $bodega;
    }

    $ubicaciones = [];
    $resultado = $db->query(
        "SELECT id, id AS idUbicacion, idBodega, codigo, nombre, estado
         FROM UbicacionesInventario
         WHERE estado = 1
         ORDER BY idBodega ASC, nombre ASC"
    );

    while ($fila = $resultado->fetch_assoc()) {
        $fila["id"] = intval($fila["id"]);
        $fila["idUbicacion"] = intval($fila["idUbicacion"]);
        $fila["idBodega"] = intval($fila["idBodega"]);
        $fila["estado"] = intval($fila["estado"]);
        $ubicaciones[] = $fila;
    }

    ii_responder(true, "Datos consultados correctamente.", [
        "fechaActual" => date("Y-m-d"),
        "tipoDocumento" => $tipoDocumento,
        "usuario" => $acceso["usuario"],
        "operador" => $acceso["operador"],
        "bodegas" => $bodegas,
        "ubicaciones" => $ubicaciones
    ]);
} catch (Throwable $error) {
    ii_responder(
        false,
        "No fue posible consultar los datos del inventario inicial.",
        [],
        ["error" => ii_mensaje_excepcion($error)],
        500
    );
}

?>
