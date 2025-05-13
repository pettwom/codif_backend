-- Nueva columna para la tabla asignacion
ALTER TABLE asignacion.asignaciones ADD COLUMN IF NOT EXISTS motivo_cambio VARCHAR;

-- Trigger para registrar en el historial cuando se crea una asignación
CREATE OR REPLACE FUNCTION asignacion.registrar_historial_asignacion()
    RETURNS TRIGGER AS $$
BEGIN
    -- Si es una nueva asignación
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO asignacion.historial_asignaciones (
            usuario_id,
            rol_id,
            asignado_por,
            fecha_asignacion,
            fecha_finalizacion,
            motivo_cambio,
            turno
        )
        VALUES (
            NEW.usuario_id,
            NEW.rol_id,
            NEW.asignado_por,
            NEW.fecha_asignacion,
            NULL, -- Fecha finalización null porque está activa
            COALESCE(NEW.motivo_cambio, 'ASIGNACION'), -- Usa el valor proporcionado o el default
            NEW.turno
        );

    -- Si se actualiza una asignación (por ejemplo, se desactiva)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si se está desactivando la asignación
        IF (OLD.activo = TRUE AND NEW.activo = FALSE) THEN
            INSERT INTO asignacion.historial_asignaciones (
                usuario_id,
                rol_id,
                asignado_por,
                fecha_asignacion,
                fecha_finalizacion,
                motivo_cambio,
                turno
            )
            VALUES (
                NEW.usuario_id,
                NEW.rol_id,
                NEW.asignado_por,
                OLD.fecha_asignacion,
                CURRENT_TIMESTAMP, -- Ahora finaliza
                COALESCE(NEW.motivo_cambio, 'BAJA'), -- Usa el valor proporcionado o el default
                NEW.turno
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger para INSERT
CREATE TRIGGER trigger_asignacion_insert
    AFTER INSERT
    ON asignacion.asignaciones
    FOR EACH ROW
EXECUTE FUNCTION asignacion.registrar_historial_asignacion();

-- Crear el trigger para UPDATE
CREATE TRIGGER trigger_asignacion_update
    AFTER UPDATE
    ON asignacion.asignaciones
    FOR EACH ROW
EXECUTE FUNCTION asignacion.registrar_historial_asignacion();


-- ====================================================================================
-- Este trigger verifica la validez jerarquica de las asignaciones antes de insertarlas
-- ====================================================================================
CREATE OR REPLACE FUNCTION asignacion.validar_jerarquia_asignacion()
    RETURNS TRIGGER AS $$
DECLARE
    rol_asignador VARCHAR;
    rol_asignado VARCHAR;
    es_valido BOOLEAN := FALSE;
BEGIN
    -- Obtener el rol del asignador
    SELECT r.sistema INTO rol_asignador
    FROM asignacion.asignaciones a
    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
    WHERE a.usuario_id = NEW.asignado_por AND a.activo = TRUE
    LIMIT 1;

    -- Obtener el rol que se esta asignando
    SELECT r.sistema INTO rol_asignado
    FROM autenticacion.rol r
    WHERE r.id_rol = NEW.rol_id;

    -- Verificar jerarquía valida
    IF (rol_asignador = 'GSP' AND rol_asignado = 'JTMT') OR
       (rol_asignador = 'JTMT' AND rol_asignado = 'SUP') OR
       (rol_asignador = 'SUP' AND rol_asignado = 'COD') THEN
        es_valido := TRUE;
    END IF;

    -- Si no es valido entonces se muestra 1 mensaje
    IF NOT es_valido THEN
        RAISE EXCEPTION 'Violación de jerarquía: % no puede asignar el rol %',
                         rol_asignador, rol_asignado;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asginar el trigguer anteriormente creado
CREATE TRIGGER validar_jerarquia_trigger
    BEFORE INSERT OR UPDATE ON asignacion.asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION asignacion.validar_jerarquia_asignacion();

-- Modificando el trigguer
CREATE OR REPLACE FUNCTION asignacion.validar_jerarquia_asignacion()
RETURNS TRIGGER AS $$
DECLARE
    rol_asignador VARCHAR;
    rol_asignado VARCHAR;
    es_valido BOOLEAN := FALSE;
    es_admin_usuario BOOLEAN := FALSE;
BEGIN
    -- Verificar si el usuario asignador es un administrador (por ID o privilegios)
    SELECT EXISTS (
        SELECT 1
        FROM autenticacion.usuarios u
        WHERE u.id_usuario = NEW.asignado_por
          AND u.es_administrador = TRUE  -- Ajusta esto según tu esquema
    ) INTO es_admin_usuario;

    -- Si el usuario asignador es administrador, permitir la asignación
    IF es_admin_usuario THEN
        es_valido := TRUE;
    ELSE
        -- Obtener el rol del asignador
        SELECT r.sistema INTO rol_asignador
        FROM asignacion.asignaciones a
        JOIN autenticacion.rol r ON a.rol_id = r.id_rol
        WHERE a.usuario_id = NEW.asignado_por AND a.activo = TRUE
        LIMIT 1;

        -- Obtener el rol que se está asignando
        SELECT r.sistema INTO rol_asignado
        FROM autenticacion.rol r
        WHERE r.id_rol = NEW.rol_id;

        -- Verificar jerarquía válida
        IF (rol_asignador = 'GSP' AND rol_asignado = 'JTMT') OR
           (rol_asignador = 'JTMT' AND rol_asignado = 'SUP') OR
           (rol_asignador = 'SUP' AND rol_asignado = 'COD') THEN
            es_valido := TRUE;
        END IF;
    END IF;

    -- Si no es válido entonces se muestra un mensaje
    IF NOT es_valido THEN
        RAISE EXCEPTION 'Violación de jerarquía: No se puede asignar el rol % con los permisos actuales',
                       rol_asignado;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;