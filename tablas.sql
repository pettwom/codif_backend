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