CREATE TABLE asignacion.asignaciones
(
    id               SERIAL PRIMARY KEY,
    usuario_id       INTEGER NOT NULL,
    rol_id           INTEGER NOT NULL REFERENCES autenticacion.rol (id_rol),
    asignado_por     INTEGER,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    turno            VARCHAR(10) CHECK (turno IN ('MAÑANA', 'TARDE', 'N/A')),
    activo           BOOLEAN   DEFAULT TRUE,
    UNIQUE (usuario_id, rol_id)
);


CREATE TABLE asignacion.historial_asignaciones
(
    id                 SERIAL PRIMARY KEY,
    usuario_id         INTEGER     NOT NULL,
    rol_id             INTEGER NOT NULL REFERENCES autenticacion.rol (id_rol),
    asignado_por       INTEGER,
    fecha_asignacion   TIMESTAMP   NOT NULL,
    fecha_finalizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    turno              VARCHAR(10) CHECK (turno IN ('MAÑANA', 'TARDE', 'N/A')),
    motivo_cambio      VARCHAR(50) NOT NULL
);

CREATE TABLE asignacion.asignacion_preguntas (
    id SERIAL PRIMARY KEY,
    seccion_id INTEGER NOT NULL,
    pregunta_id INTEGER NOT NULL,
    total_asignaciones INTEGER NOT NULL,
    supervisor_id INTEGER NOT NULL,
    codificador_id INTEGER NOT NULL,
    cantidad_asignada INTEGER NOT NULL,
    fecha_distribucion_de_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMP NULL,
    motivo_desasignacion VARCHAR NULL,
    esta_asignada BOOLEAN DEFAULT FALSE
);

ALTER TABLE asignacion.asignacion_preguntas
    ADD COLUMN asignacion_id INTEGER REFERENCES asignacion.asignaciones (id);

