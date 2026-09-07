START TRANSACTION;

CREATE TABLE IF NOT EXISTS Roles (
    id INT NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    color VARCHAR(10) NOT NULL DEFAULT '#1D4ED8',
    esAdministrador TINYINT(1) NOT NULL DEFAULT 0,
    estado TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Permisos (
    id INT NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(100) NOT NULL,
    modulo VARCHAR(60) NOT NULL,
    accion VARCHAR(40) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    estado TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permisos_codigo (codigo),
    KEY idx_permisos_modulo (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS RolesPermisos (
    idRol INT NOT NULL,
    idPermiso INT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idRol, idPermiso),
    CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (idRol) REFERENCES Roles (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (idPermiso) REFERENCES Permisos (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Roles (id, codigo, nombre, descripcion, color, esAdministrador, estado) VALUES
    (1, 'ADMINISTRADOR', 'Administrador', 'Acceso completo a configuración y operación.', '#1D4ED8', 1, 1),
    (2, 'INVENTARIO_ADMIN', 'Inventario administrativo', 'Administra catálogos, movimientos, conteos y alistamiento.', '#047857', 0, 1),
    (3, 'OPERATIVO_BODEGA', 'Operativo de bodega', 'Ejecuta movimientos, alistamientos y conteos asignados.', '#7C3AED', 0, 1),
    (4, 'DESPACHOS', 'Despachos', 'Gestiona despachos, archivos e informes logísticos.', '#0369A1', 0, 1),
    (5, 'AUDITOR', 'Consulta / Auditoría', 'Consulta indicadores, inventario e informes sin modificar datos.', '#475569', 0, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion), color = VALUES(color), esAdministrador = VALUES(esAdministrador), estado = VALUES(estado);

INSERT INTO Permisos (codigo, modulo, accion, nombre, descripcion) VALUES
    ('dashboard.ver', 'dashboard', 'ver', 'Ver dashboard', 'Consulta indicadores ejecutivos.'),
    ('usuarios.administrar', 'usuarios', 'administrar', 'Administrar usuarios', 'Crea, edita, suspende y restablece usuarios.'),
    ('despachos.ver', 'despachos', 'ver', 'Consultar despachos', 'Consulta despachos y sus detalles.'),
    ('despachos.gestionar', 'despachos', 'gestionar', 'Gestionar despachos', 'Crea y modifica despachos y cargas.'),
    ('despachos.informes', 'despachos', 'exportar', 'Consultar informes de despachos', 'Consulta y exporta informes logísticos.'),
    ('inventario.catalogos', 'inventario', 'configurar', 'Administrar catálogos', 'Administra bodegas, ubicaciones, productos y códigos.'),
    ('inventario.operacion.ver', 'inventario', 'ver', 'Consultar operación de inventario', 'Consulta entradas, salidas, traslados y ajustes.'),
    ('inventario.operacion.gestionar', 'inventario', 'gestionar', 'Gestionar operación de inventario', 'Crea y finaliza movimientos de inventario.'),
    ('inventario.control', 'inventario', 'controlar', 'Consultar control de inventario', 'Consulta existencias, lotes y kardex.'),
    ('inventario.configuracion', 'inventario', 'configurar', 'Configurar inventario', 'Administra tipos documentales y operadores.'),
    ('alistamiento.administrar', 'alistamiento', 'administrar', 'Administrar alistamiento', 'Crea, asigna y controla órdenes.'),
    ('alistamiento.ejecutar', 'alistamiento', 'ejecutar', 'Ejecutar alistamiento', 'Consulta y ejecuta órdenes asignadas.'),
    ('conteos.administrar', 'conteos', 'administrar', 'Administrar conteos físicos', 'Crea, analiza, exporta y finaliza conteos.'),
    ('conteos.ejecutar', 'conteos', 'ejecutar', 'Ejecutar conteos físicos', 'Registra y envía conteos asignados.'),
    ('reportes.exportar', 'reportes', 'exportar', 'Exportar reportes', 'Autoriza exportaciones operativas.')
ON DUPLICATE KEY UPDATE modulo = VALUES(modulo), accion = VALUES(accion), nombre = VALUES(nombre), descripcion = VALUES(descripcion), estado = 1;

INSERT IGNORE INTO RolesPermisos (idRol, idPermiso)
SELECT 1, id FROM Permisos WHERE estado = 1;

INSERT IGNORE INTO RolesPermisos (idRol, idPermiso)
SELECT 2, id FROM Permisos WHERE codigo IN (
    'dashboard.ver', 'inventario.catalogos', 'inventario.operacion.ver', 'inventario.operacion.gestionar',
    'inventario.control', 'inventario.configuracion', 'alistamiento.administrar', 'conteos.administrar',
    'conteos.ejecutar', 'reportes.exportar'
);

INSERT IGNORE INTO RolesPermisos (idRol, idPermiso)
SELECT 3, id FROM Permisos WHERE codigo IN (
    'dashboard.ver', 'inventario.operacion.ver', 'inventario.operacion.gestionar', 'inventario.control',
    'alistamiento.ejecutar', 'conteos.ejecutar'
);

INSERT IGNORE INTO RolesPermisos (idRol, idPermiso)
SELECT 4, id FROM Permisos WHERE codigo IN (
    'dashboard.ver', 'despachos.ver', 'despachos.gestionar', 'despachos.informes', 'inventario.control', 'reportes.exportar'
);

INSERT IGNORE INTO RolesPermisos (idRol, idPermiso)
SELECT 5, id FROM Permisos WHERE codigo IN (
    'dashboard.ver', 'despachos.ver', 'despachos.informes', 'inventario.operacion.ver', 'inventario.control', 'reportes.exportar'
);

UPDATE usuarios u
LEFT JOIN parametros p ON p.id = u.rol AND p.tipoParametro = 1
SET u.rol = CASE
    WHEN u.rol = 1 OR UPPER(COALESCE(p.parametro, '')) LIKE '%ADMINISTRADOR%' THEN 1
    WHEN UPPER(COALESCE(p.parametro, '')) LIKE '%INVENTARIO%' THEN 2
    WHEN UPPER(COALESCE(p.parametro, '')) LIKE '%BODEGA%' OR UPPER(COALESCE(p.parametro, '')) LIKE '%OPERATIVO%' THEN 3
    WHEN UPPER(COALESCE(p.parametro, '')) LIKE '%DESPACH%' OR UPPER(COALESCE(p.parametro, '')) LIKE '%LOGIST%' THEN 4
    ELSE 5
END;

ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol) REFERENCES Roles (id) ON UPDATE CASCADE;

COMMIT;
