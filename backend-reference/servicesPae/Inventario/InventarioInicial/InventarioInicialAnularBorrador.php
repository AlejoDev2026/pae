<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    $db = ii_buscar_conexion();
    $data = ii_entrada_json();
    $idDocumento = ii_entero(
        $data["idDocumento"] ?? $data["id"] ?? 0,
        "idDocumento"
    );
    $idUsuario = ii_entero($data["idUsuario"] ?? 0, "idUsuario");

    ii_validar_usuario_administrativo($db, $idUsuario);

    $db->begin_transaction();
    $documento = ii_documento($db, $idDocumento, true);

    if (!$documento) {
        throw new Exception("El inventario inicial no existe.");
    }

    if (
        strtoupper((string)$documento["estadoProceso"])
        !== II_ESTADO_BORRADOR
    ) {
        throw new Exception(
            "Solo se pueden anular documentos en borrador."
        );
    }

    $estado = II_ESTADO_ANULADA;
    $stmt = ii_preparar(
        $db,
        "UPDATE InventarioDocumentos
         SET estadoProceso = ?, updated_at = NOW()
         WHERE id = ?"
    );
    $stmt->bind_param("si", $estado, $idDocumento);
    $stmt->execute();
    $stmt->close();
    $db->commit();

    ii_responder(true, "Borrador anulado correctamente.", [
        "idDocumento" => $idDocumento,
        "estadoProceso" => II_ESTADO_ANULADA
    ]);
} catch (Throwable $error) {
    if (isset($db) && $db instanceof mysqli) {
        try {
            $db->rollback();
        } catch (Throwable $ignorado) {
        }
    }

    ii_responder(
        false,
        ii_mensaje_excepcion($error),
        [],
        ["error" => $error->getMessage()],
        409
    );
}

?>
