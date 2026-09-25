-- Catálogo de embalajes: permite insertar nuevos registros sin enviar un id.
-- Algunos catálogos históricos tienen un único registro con id = 0. MySQL
-- intenta resecuenciarlo al activar AUTO_INCREMENT y puede chocar con otra PK.
-- Se conserva el registro, asignándole primero un id libre al final del catálogo.
SET @nuevoIdEmbalaje = (SELECT COALESCE(MAX(id), 0) + 1 FROM EmbalajeCatalogo);

UPDATE EmbalajeCatalogo
SET id = @nuevoIdEmbalaje
WHERE id = 0;

ALTER TABLE EmbalajeCatalogo
    MODIFY id INT(11) NOT NULL AUTO_INCREMENT;
