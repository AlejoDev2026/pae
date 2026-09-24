-- Requiere 2026-09-07_ordenes_compra.sql. Relaciones nuevas, sin alterar entradas manuales.
CREATE TABLE IF NOT EXISTS InventarioEntradaCompra (
 idDocumento INT NOT NULL PRIMARY KEY,
 idOrdenCompra INT NOT NULL,
 KEY idx_entrada_compra (idOrdenCompra),
 FOREIGN KEY (idOrdenCompra) REFERENCES InventarioOrdenesCompra(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS InventarioEntradaCompraDetalle (
 idDocumentoDetalle INT NOT NULL PRIMARY KEY,
 idDocumento INT NOT NULL,
 idOrdenCompraDetalle INT NOT NULL,
 KEY idx_compra_recepcion (idOrdenCompraDetalle),
 KEY idx_compra_documento (idDocumento),
 FOREIGN KEY (idOrdenCompraDetalle) REFERENCES InventarioOrdenesCompraDetalle(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
