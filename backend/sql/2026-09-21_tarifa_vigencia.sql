-- =============================================================================
-- Migración: tarifas con vigencia (fechaDesde / fechaHasta)
-- Fecha: 2026-09-21
-- =============================================================================
-- Objetivo: permitir cargar tarifas NUEVAS sin perder las históricas, respetando
-- el rango de vigencia. Regla de negocio: para una misma `cantidadDias` sólo puede
-- haber UNA tarifa vigente en un rango de fechas dado (los rangos NO se solapan).
--
-- Antes de esta migración la tabla tenía PRIMARY KEY (cantidadDias), lo que hacía
-- IMPOSIBLE tener más de una tarifa por cantidad de días. Se cambia a la PK
-- compuesta (cantidadDias, fechaDesde): cada tarifa de esa cantidad de días arranca
-- en una fecha distinta.
--
-- Cómo ejecutar (desde backend/, con las credenciales del .env):
--   mysql -h localhost -u root -p kinesis < sql/2026-09-21_tarifa_vigencia.sql
--
-- La tarifa VIGENTE de una cantidadDias es la fila con fechaHasta IS NULL
-- (rango abierto). Las tarifas históricas tienen fechaHasta con el último día
-- en que estuvieron activas.
--
-- Convención: las tarifas arrancan el 1° de mes (fechaDesde = 'YYYY-MM-01'), porque
-- la cuota mensual toma la tarifa vigente el 1° del mes al que corresponde la cuota.
-- =============================================================================

-- 1) Esquema: fechaDesde pasa a ser obligatoria y parte de la PK ---------------
--    (todas las filas actuales ya tienen fechaDesde, así que es seguro).
ALTER TABLE tarifagrupo
  MODIFY COLUMN fechaDesde DATE NOT NULL,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (cantidadDias, fechaDesde);

-- 2) Stored procedure para dar de alta una tarifa nueva de forma segura --------
--    Cierra la tarifa vigente anterior (le pone fechaHasta = fechaDesde nueva - 1
--    día) e inserta la nueva como vigente (fechaHasta = NULL), todo en una
--    transacción. Así nunca quedan dos vigentes ni rangos solapados.
--
--    Uso:  CALL sp_nueva_tarifa(2, 2800, '2026-10-01');
DROP PROCEDURE IF EXISTS sp_nueva_tarifa;
DELIMITER $$
CREATE PROCEDURE sp_nueva_tarifa(
    IN p_cantidadDias INT,
    IN p_monto        INT,
    IN p_fechaDesde   DATE
)
BEGIN
    DECLARE v_diaPrevio DATE;
    DECLARE v_abiertaFutura INT DEFAULT 0;

    -- Validaciones de entrada
    IF p_cantidadDias IS NULL OR p_cantidadDias < 1 OR p_cantidadDias > 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'cantidadDias debe estar entre 1 y 5.';
    END IF;
    IF p_monto IS NULL OR p_monto < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'monto invalido (debe ser >= 0).';
    END IF;
    IF p_fechaDesde IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fechaDesde es requerida.';
    END IF;

    SET v_diaPrevio = DATE_SUB(p_fechaDesde, INTERVAL 1 DAY);

    START TRANSACTION;

    -- Evitar solapamiento: no puede existir una tarifa vigente (abierta) que arranque
    -- en o después de la fecha nueva; en ese caso la carga está mal ordenada.
    SELECT COUNT(*) INTO v_abiertaFutura
      FROM tarifagrupo
     WHERE cantidadDias = p_cantidadDias
       AND fechaHasta IS NULL
       AND fechaDesde >= p_fechaDesde;

    IF v_abiertaFutura > 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ya existe una tarifa vigente que arranca en o despues de fechaDesde.';
    END IF;

    -- Cerrar la tarifa vigente anterior (si la hay)
    UPDATE tarifagrupo
       SET fechaHasta = v_diaPrevio
     WHERE cantidadDias = p_cantidadDias
       AND fechaHasta IS NULL
       AND fechaDesde <= v_diaPrevio;

    -- Insertar la tarifa nueva como vigente
    INSERT INTO tarifagrupo (cantidadDias, monto, fechaDesde, fechaHasta)
    VALUES (p_cantidadDias, p_monto, p_fechaDesde, NULL);

    COMMIT;
END$$
DELIMITER ;

-- =============================================================================
-- ROLLBACK del esquema (si hiciera falta revertir la PK; sólo posible si volvés
-- a dejar una única fila por cantidadDias):
--   ALTER TABLE tarifagrupo DROP PRIMARY KEY, ADD PRIMARY KEY (cantidadDias);
--   DROP PROCEDURE IF EXISTS sp_nueva_tarifa;
-- =============================================================================
