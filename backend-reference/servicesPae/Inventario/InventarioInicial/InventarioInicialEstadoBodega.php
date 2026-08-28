<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    $db = ii_buscar_conexion();
    $idUsuario = ii_entero($_GET["idUsuario"] ?? 0, "idUsuario");
    $idBodega = ii_entero($_GET["idBodega"] ?? 0, "idBodega");
    ii_validar_usuario_administrativo($db, $idUsuario);

    ii_responder(
        true,
        "Estado de la bodega consultado correctamente.",
        ii_estado_bodega($db, $idBodega)
    );
} catch (Throwable $error) {
    ii_responder(
        false,
        "No fue posible consultar el estado de la bodega.",
        [],
        ["error" => ii_mensaje_excepcion($error)],
        500
    );
}

?>
