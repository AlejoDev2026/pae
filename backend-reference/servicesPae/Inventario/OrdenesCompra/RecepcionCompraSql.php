<?php
// Expresión interna: el identificador SQL lo fija el servicio, nunca el usuario.
function ocPendienteSql($idOrden) {
    return "EXISTS (SELECT 1 FROM InventarioOrdenesCompraDetalle ocp
        WHERE ocp.idOrdenCompra = $idOrden AND ocp.cantidad > (
            SELECT COALESCE(SUM(ocd.cantidadSolicitada), 0)
            FROM InventarioEntradaCompraDetalle ocr
            INNER JOIN InventarioDocumentoDetalle ocd ON ocd.id = ocr.idDocumentoDetalle
            INNER JOIN InventarioDocumentos oce ON oce.id = ocr.idDocumento
            WHERE ocr.idOrdenCompraDetalle = ocp.id AND oce.estadoProceso = 'FINALIZADA'
        ))";
}
