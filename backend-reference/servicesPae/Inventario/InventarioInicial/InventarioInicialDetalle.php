<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    $db = ii_buscar_conexion();
    $idDocumento = ii_entero(
        $_GET["idDocumento"] ?? $_GET["id"] ?? 0,
        "idDocumento"
    );
    $documento = ii_documento($db, $idDocumento);

    if (!$documento) {
        ii_responder(
            false,
            "El inventario inicial no existe.",
            [],
            [],
            404
        );
    }

    $detalles = ii_detalles_documento($db, $idDocumento);
    $documento["editable"] = (
        strtoupper((string)$documento["estadoProceso"])
        === II_ESTADO_BORRADOR
    );

    ii_responder(true, "Inventario inicial consultado correctamente.", [
        "documento" => $documento,
        "detalles" => $detalles
    ]);
} catch (Throwable $error) {
    ii_responder(
        false,
        "No fue posible consultar el inventario inicial.",
        [],
        ["error" => ii_mensaje_excepcion($error)],
        500
    );
}

?>
