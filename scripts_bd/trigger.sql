-- Trigger para registrar en el historial cuando se crea una asignación
CREATE OR REPLACE FUNCTION asignacion.registrar_historial_asignacion()
    RETURNS TRIGGER AS
$$
BEGIN
    -- Si es una nueva asignación
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO asignacion.historial_asignaciones (usuario_id,
                                                       rol_id,
                                                       asignado_por,
                                                       fecha_asignacion,
                                                       fecha_finalizacion,
                                                       motivo_cambio,
                                                       turno)
        VALUES (NEW.usuario_id,
                NEW.rol_id,
                NEW.asignado_por,
                NEW.fecha_asignacion,
                NULL, -- Fecha finalización null porque está activa
                'ASIGNACION',
                NEW.turno);

        -- Si se actualiza una asignación (por ejemplo, se desactiva)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Si se está desactivando la asignación
        IF (OLD.activo = TRUE AND NEW.activo = FALSE) THEN
            INSERT INTO asignacion.historial_asignaciones (usuario_id,
                                                rol_id,
                                                asignado_por,
                                                fecha_asignacion,
                                                fecha_finalizacion,
                                                motivo_cambio,
                                                turno)
            VALUES (NEW.usuario_id,
                    NEW.rol_id,
                    NEW.asignado_por,
                    OLD.fecha_asignacion,
                    CURRENT_TIMESTAMP, -- Ahora finaliza
                    'RENUNCIA', -- Por defecto ponemos renuncia, pero se puede modificar luego
                    NEW.turno);
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

-- =============================================================== --
-- Nueva
ALTER TABLE asignacion.asignaciones ADD COLUMN IF NOT EXISTS motivo_cambio VARCHAR;

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