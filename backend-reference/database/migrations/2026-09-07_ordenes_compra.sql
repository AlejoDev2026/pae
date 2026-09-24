-- Nueva estructura de importación; no modifica documentos ni existencias.
-- Requiere 2026-09-01_roles_permisos.sql. Ejecutar antes de publicar los servicios.
CREATE TABLE IF NOT EXISTS InventarioOrdenesCompra (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    empresa VARCHAR(255) NOT NULL,
    nitEmpresa VARCHAR(30) NOT NULL,
    direccionEmpresa VARCHAR(255) NOT NULL,
    tipoDocumento VARCHAR(30) NOT NULL,
    numero VARCHAR(80) NOT NULL,
    estadoOrigen VARCHAR(60) NOT NULL,
    fecha DATE NOT NULL,
    vencimiento DATE NOT NULL,
    impresion VARCHAR(150) NOT NULL,
    proveedor VARCHAR(255) NOT NULL,
    nitProveedor VARCHAR(30) NOT NULL,
    telefono VARCHAR(80) NOT NULL,
    ciudad VARCHAR(120) NOT NULL,
    observacion TEXT NOT NULL,
    subtotal DECIMAL(18,2) NOT NULL,
    descuento DECIMAL(18,2) NOT NULL,
    subtotalDescuento DECIMAL(18,2) NOT NULL,
    iva DECIMAL(18,2) NOT NULL,
    retefuente DECIMAL(18,2) NOT NULL,
    reteica DECIMAL(18,2) NOT NULL,
    reteiva DECIMAL(18,2) NOT NULL,
    retecree DECIMAL(18,2) NOT NULL,
    total DECIMAL(18,2) NOT NULL,
    archivoNombre VARCHAR(255) NOT NULL,
    archivoHash CHAR(64) NOT NULL,
    archivoContenido MEDIUMBLOB NOT NULL,
    idUsuarioRegistro INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_compra_documento (nitEmpresa, tipoDocumento, numero),
    UNIQUE KEY uq_compra_archivo (archivoHash),
    KEY idx_compra_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS InventarioOrdenesCompraDetalle (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    idOrdenCompra INT NOT NULL,
    renglon INT NOT NULL,
    filaArchivo INT NOT NULL,
    codigo VARCHAR(80) NOT NULL,
    ubicacionOrigen VARCHAR(80) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    costo DECIMAL(18,2) NOT NULL,
    peso DECIMAL(18,3) NOT NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    valorUnitario DECIMAL(18,2) NOT NULL,
    valorTotal DECIMAL(18,2) NOT NULL,
    UNIQUE KEY uq_compra_renglon (idOrdenCompra, renglon),
    CONSTRAINT fk_compra_detalle FOREIGN KEY (idOrdenCompra)
        REFERENCES InventarioOrdenesCompra (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La asignación a los dos roles operativos queda pendiente.
-- El administrador conserva acceso mediante el mecanismo existente.
INSERT INTO Permisos (codigo, modulo, accion, nombre, descripcion) VALUES
('compras.cargar', 'compras', 'cargar', 'Cargar órdenes de compra', 'Consulta e importa órdenes de compra desde CSV, sin afectar inventario.')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion);
