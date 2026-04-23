require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../Frontend')));

/* ===== CONEXION BD ===== */
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log('Conectado a PostgreSQL'))
    .catch(err => console.error('Error conexión BD', err.stack));

/* ===== LOGIN ===== */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, r.nombre AS rol, u.telefono, u.activo
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.email = $1 AND u.password = $2 AND u.activo = true
        `, [email, password]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        // Si es socio, obtener su tipo_accion
        let tipo_accion = null;
        if (resultado.rows[0].rol === 'socio') {
            const socio = await pool.query(`
                SELECT tipo_accion FROM socios 
                WHERE usuario_id = $1
            `, [resultado.rows[0].id]);
            if (socio.rows.length > 0) {
                tipo_accion = socio.rows[0].tipo_accion;
            }
        }

        // Registrar en auditoría
        await pool.query(`
            INSERT INTO auditoria(usuario_id, accion, ip_origen)
            VALUES($1, $2, $3)
        `, [resultado.rows[0].id, 'login', req.ip]);

        res.json({
            ...resultado.rows[0],
            tipo_accion
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en servidor" });
    }
});

/* ===== USUARIOS ===== */
app.get('/api/usuarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, r.nombre AS rol, u.rol_id, u.telefono, u.activo, u.fecha_registro
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            ORDER BY u.id
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

app.delete('/api/usuarios/:id/seguro', async (req, res) => {
    const { id } = req.params;
    const { admin_id, password } = req.body;

    try {
        // Verificar admin
        const admin = await pool.query(`
            SELECT u.password, r.nombre as rol
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1
        `, [admin_id]);

        if (admin.rows.length === 0 || admin.rows[0].rol !== 'admin') {
            return res.status(403).json({ error: "No autorizado" });
        }

        // Validar contraseña
        if (admin.rows[0].password !== password) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        if (parseInt(id) === parseInt(admin_id)) {
            return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
        }

        await pool.query('DELETE FROM familiares WHERE socio_id IN (SELECT id FROM socios WHERE usuario_id = $1)', [id]);
        await pool.query('DELETE FROM socios WHERE usuario_id = $1', [id]);
        await pool.query('DELETE FROM instructores WHERE usuario_id = $1', [id]);
        await pool.query('DELETE FROM reservaciones WHERE usuario_id = $1', [id]);

        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

        res.json({ mensaje: "Usuario eliminado correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar usuario" });
    }
});

app.get('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(`
            SELECT id, nombre, apellido, email, telefono
            FROM usuarios
            WHERE id = $1
        `,[id]);

        if (resultado.rows.length == 0) {
            return res.status(404).json({error: "Usuario no encontrado"});
        }

        res.json(resultado.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol_id, telefono } = req.body;

    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Email ya registrado" });
        }

        const resultado = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, password, rol_id, telefono]);

        res.json({ id: resultado.rows[0].id, mensaje: "Usuario creado" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear usuario" });
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, activo, rol_id } = req.body;

    try {
        await pool.query(`
            UPDATE usuarios 
            SET nombre = $1, email = $2, telefono = $3, activo = COALESCE($4, activo), rol_id = COALESCE($5, rol_id)
            WHERE id = $6
        `, [nombre, email, telefono, activo, rol_id, id]);

        res.json({ mensaje: "Usuario actualizado" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al actualizar usuario" });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);
        res.json({ mensaje: "Usuario desactivado" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al desactivar usuario" });
    }
});

/* ===== SOCIOS ===== */
app.get('/api/socios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, u.telefono, u.activo,
                   s.tipo_accion, s.fecha_afiliacion
            FROM usuarios u
            JOIN socios s ON u.id = s.usuario_id
            WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
            ORDER BY u.nombre
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener socios" });
    }
});

app.post('/api/socios', async (req, res) => {
    const { nombre, email, password, telefono, tipo_accion } = req.body;

    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Email ya registrado" });
        }

        const rolSocio = await pool.query("SELECT id FROM roles WHERE nombre = 'socio'");
        
        const nuevoUsuario = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, password, rolSocio.rows[0].id, telefono]);
        
        await pool.query(`
            INSERT INTO socios(usuario_id, tipo_accion)
            VALUES($1, $2)
        `, [nuevoUsuario.rows[0].id, tipo_accion]);
        
        res.json({ 
            id: nuevoUsuario.rows[0].id, 
            mensaje: "Socio creado exitosamente" 
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear socio" });
    }
});

/* ===== FAMILIARES ===== */
app.get('/api/socios/:id/familiares', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(`
            SELECT f.* FROM familiares f
            JOIN socios s ON f.socio_id = s.id
            WHERE s.usuario_id = $1 AND f.activo = true
            ORDER BY f.id
        `, [id]);
        
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener familiares" });
    }
});

app.post('/api/socios/:id/familiares', async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, parentesco, fecha_nacimiento } = req.body;
    
    try {
        const socio = await pool.query(`SELECT id FROM socios WHERE usuario_id = $1`, [id]);
        
        if (socio.rows.length === 0) {
            return res.status(404).json({ error: "Socio no encontrado" });
        }
        
        const socioId = socio.rows[0].id;
        
        const count = await pool.query(`
            SELECT COUNT(*) FROM familiares 
            WHERE socio_id = $1 AND activo = true
        `, [socioId]);
        
        if (parseInt(count.rows[0].count) >= 5) {
            return res.status(400).json({ error: "Máximo 5 familiares por socio" });
        }
        
        const resultado = await pool.query(`
            INSERT INTO familiares(socio_id, nombre_completo, parentesco, fecha_nacimiento)
            VALUES($1, $2, $3, $4)
            RETURNING *
        `, [socioId, nombre_completo, parentesco, fecha_nacimiento]);
        
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al agregar familiar" });
    }
});

app.delete('/api/familiares/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('UPDATE familiares SET activo = false WHERE id = $1', [id]);
        res.json({ mensaje: "Familiar eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar familiar" });
    }
});

/* ===== INSTRUCTORES ===== */
app.get('/api/instructores', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, u.telefono, u.activo,
                   i.especialidad, i.fecha_contratacion
            FROM usuarios u
            JOIN instructores i ON u.id = i.usuario_id
            WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'instructor')
            ORDER BY u.nombre
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener instructores" });
    }
});

app.post('/api/instructores', async (req, res) => {
    const { nombre, email, password, telefono, especialidad, fecha_contratacion } = req.body;

    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Email ya registrado" });
        }

        const rolInstructor = await pool.query("SELECT id FROM roles WHERE nombre = 'instructor'");
        
        const nuevoUsuario = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, password, rolInstructor.rows[0].id, telefono]);
        
        await pool.query(`
            INSERT INTO instructores(usuario_id, especialidad, fecha_contratacion)
            VALUES($1, $2, $3)
        `, [nuevoUsuario.rows[0].id, especialidad, fecha_contratacion || new Date().toISOString().split('T')[0]]);
        
        res.json({ 
            id: nuevoUsuario.rows[0].id, 
            mensaje: "Instructor creado exitosamente" 
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear instructor" });
    }
});

/* ===== ESPACIOS DEPORTIVOS ===== */
app.get('/api/espacios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT * FROM espacios_deportivos 
            WHERE activo = true 
            ORDER BY tipo, nombre
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener espacios" });
    }
});

/* ===== RESERVACIONES ===== */
app.get('/api/reservaciones', async (req, res) => {
    const { fecha, usuario_id } = req.query;

    try {
        let query = `
            SELECT r.*, u.nombre as usuario_nombre, e.nombre as espacio_nombre
            FROM reservaciones r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN espacios_deportivos e ON r.espacio_id = e.id
            WHERE 1=1
        `;
        const params = [];

        if (fecha) {
            params.push(fecha);
            query += ` AND r.fecha_reserva = $${params.length}`;
        }

        if (usuario_id) {
            params.push(usuario_id);
            query += ` AND r.usuario_id = $${params.length}`;
        }

        query += ` ORDER BY r.fecha_reserva DESC, r.hora_inicio`;

        const resultado = await pool.query(query, params);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener reservaciones" });
    }
});

app.post('/api/reservaciones', async (req, res) => {
    const { usuario_id, espacio_id, fecha_reserva, hora_inicio, hora_fin } = req.body;

    try {
        const conflicto = await pool.query(`
            SELECT * FROM reservaciones 
            WHERE espacio_id = $1 
            AND fecha_reserva = $2 
            AND estado = 'confirmada'
            AND (
                (hora_inicio BETWEEN $3 AND $4) OR
                (hora_fin BETWEEN $3 AND $4) OR
                ($3 BETWEEN hora_inicio AND hora_fin)
            )
        `, [espacio_id, fecha_reserva, hora_inicio, hora_fin]);

        if (conflicto.rows.length > 0) {
            return res.status(409).json({ error: "Espacio no disponible en ese horario" });
        }

        const resultado = await pool.query(`
            INSERT INTO reservaciones(usuario_id, espacio_id, fecha_reserva, hora_inicio, hora_fin)
            VALUES($1, $2, $3, $4, $5)
            RETURNING *
        `, [usuario_id, espacio_id, fecha_reserva, hora_inicio, hora_fin]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear reservación" });
    }
});

app.put('/api/reservaciones/:id/cancelar', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(`UPDATE reservaciones SET estado = 'cancelada' WHERE id = $1`, [id]);
        res.json({ mensaje: "Reservación cancelada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al cancelar reservación" });
    }
});

/* ===== LUDOTECA ===== */
app.post('/api/ludoteca/entrada', async (req, res) => {
    const { usuario_responsable_id, nombre_menor, edad_menor, hora_entrada } = req.body;

    try {
        const activos = await pool.query(`
            SELECT COUNT(*) FROM registro_ludoteca 
            WHERE usuario_responsable_id = $1 AND estatus = 'activo' AND fecha = CURRENT_DATE
        `, [usuario_responsable_id]);

        if (parseInt(activos.rows[0].count) >= 3) {
            return res.status(400).json({ error: "Máximo 3 menores por responsable" });
        }

        const resultado = await pool.query(`
            INSERT INTO registro_ludoteca(usuario_responsable_id, nombre_menor, edad_menor, hora_entrada)
            VALUES($1, $2, $3, $4)
            RETURNING *
        `, [usuario_responsable_id, nombre_menor, edad_menor, hora_entrada]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al registrar entrada" });
    }
});

app.put('/api/ludoteca/salida/:id', async (req, res) => {
    const { id } = req.params;
    const { hora_salida } = req.body;

    try {
        const resultado = await pool.query(`
            UPDATE registro_ludoteca 
            SET hora_salida = $1, estatus = 'finalizado'
            WHERE id = $2
            RETURNING *
        `, [hora_salida, id]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al registrar salida" });
    }
});

app.get('/api/ludoteca/activos', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT l.*, u.nombre as responsable_nombre
            FROM registro_ludoteca l
            JOIN usuarios u ON l.usuario_responsable_id = u.id
            WHERE l.estatus = 'activo' AND l.fecha = CURRENT_DATE
            ORDER BY l.hora_entrada
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener menores activos" });
    }
});

/* ===== INVITADOS ===== */
app.post('/api/invitados', async (req, res) => {
    const { nombre_completo, socio_anfitrion_id, cuota_pagada, actividades_autorizadas } = req.body;

    try {
        const resultado = await pool.query(`
            INSERT INTO invitados(nombre_completo, socio_anfitrion_id, cuota_pagada, actividades_autorizadas)
            VALUES($1, $2, $3, $4)
            RETURNING *
        `, [nombre_completo, socio_anfitrion_id, cuota_pagada, actividades_autorizadas]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al registrar invitado" });
    }
});

app.get('/api/invitados/hoy', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT i.*, u.nombre as anfitrion_nombre
            FROM invitados i
            LEFT JOIN usuarios u ON i.socio_anfitrion_id = u.id
            WHERE i.fecha_visita = CURRENT_DATE
            ORDER BY i.creado_en DESC
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener invitados" });
    }
});

/* ===== TORNEOS ===== */
app.get('/api/torneos', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT t.*, a.nombre as actividad_nombre, u.nombre as creador_nombre
            FROM torneos t
            LEFT JOIN actividades a ON t.actividad_id = a.id
            LEFT JOIN usuarios u ON t.creado_por = u.id
            ORDER BY t.fecha_inicio DESC
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener torneos" });
    }
});

app.post('/api/torneos', async (req, res) => {
    const { nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, creado_por } = req.body;

    try {
        const resultado = await pool.query(`
            INSERT INTO torneos(nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, creado_por)
            VALUES($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, creado_por]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear torneo" });
    }
});

/* ===== EVENTOS ===== */
app.post('/api/eventos', async (req, res) => {
    const { nombre, descripcion, fecha_evento, creado_por } = req.body;

    try {
        await pool.query(
            `INSERT INTO eventos(nombre, descripcion, fecha_evento, creado_por)
             VALUES($1, $2, $3, $4)`,
            [nombre, descripcion, fecha_evento, creado_por]
        );
        res.json({ mensaje: "Evento creado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear evento" });
    }
});

app.get('/api/eventos', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT e.id_evento, e.nombre, e.descripcion, e.fecha_evento, u.nombre AS creador
            FROM eventos e
            LEFT JOIN usuarios u ON e.creado_por = u.id
            ORDER BY e.fecha_evento DESC
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener eventos" });
    }
});

app.put('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, fecha_evento } = req.body;

    try {
        await pool.query(
            `UPDATE eventos 
             SET nombre=$1, descripcion=$2, fecha_evento=$3 
             WHERE id_evento=$4`,
            [nombre, descripcion, fecha_evento, id]
        );
        res.json({ mensaje: "Evento actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al actualizar evento" });
    }
});

app.delete('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM eventos WHERE id_evento = $1', [id]);
        res.json({ mensaje: "Evento eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar evento" });
    }
});

/* ===== ACTIVIDADES ===== */
app.get('/api/actividades', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT * FROM actividades ORDER BY nombre
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener actividades" });
    }
});

/* ===== ESTADISTICAS ===== */
app.get('/api/estadisticas', async (req, res) => {
    try {
        const eventos = await pool.query('SELECT COUNT(*) FROM eventos');
        const usuarios = await pool.query('SELECT COUNT(*) FROM usuarios');
        const socios = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'socio')");
        const instructores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'instructor')");
        const reservacionesHoy = await pool.query("SELECT COUNT(*) FROM reservaciones WHERE fecha_reserva = CURRENT_DATE");
        const ludotecaActivos = await pool.query("SELECT COUNT(*) FROM registro_ludoteca WHERE estatus = 'activo' AND fecha = CURRENT_DATE");
        const invitadosHoy = await pool.query("SELECT COUNT(*) FROM invitados WHERE fecha_visita = CURRENT_DATE");

        res.json({
            eventos: parseInt(eventos.rows[0].count),
            usuarios: parseInt(usuarios.rows[0].count),
            socios: parseInt(socios.rows[0].count),
            instructores: parseInt(instructores.rows[0].count),
            reservacionesHoy: parseInt(reservacionesHoy.rows[0].count),
            ludotecaActivos: parseInt(ludotecaActivos.rows[0].count),
            invitadosHoy: parseInt(invitadosHoy.rows[0].count)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener estadísticas" });
    }
});

/* ===== BUSCAR SOCIOS ===== */
app.get('/api/socios/buscar', async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
        return res.json([]);
    }
    
    try {
        const esNumero = /^\d+$/.test(q);
        let query;
        let params;
        
        if (esNumero) {
            query = `
                SELECT u.id, u.nombre, u.apellido, u.ine, u.email, u.telefono
                FROM usuarios u
                WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
                AND u.id = $1
                ORDER BY u.nombre
                LIMIT 20
            `;
            params = [parseInt(q)];
        } else {
            query = `
                SELECT u.id, u.nombre, u.apellido, u.ine, u.email, u.telefono
                FROM usuarios u
                WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
                AND (u.ine ILIKE $1 OR u.email ILIKE $1)
                ORDER BY u.nombre
                LIMIT 20
            `;
            params = [`%${q}%`];
        }
        
        const resultado = await pool.query(query, params);
        res.json(resultado.rows);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en búsqueda" });
    }
});

/* ===== USUARIOS EXCEPTO ADMIN ===== */
app.get('/api/usuarios/except/:admin_id', async (req, res) => {
    const { admin_id } = req.params;
    
    const resultado = await pool.query(`
        SELECT u.id, u.nombre, u.apellido, u.ine, u.email, u.telefono, 
               r.nombre AS rol, u.rol_id, u.activo
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.id != $1
        ORDER BY u.id
    `, [admin_id]);
    
    res.json(resultado.rows);
});

/* ===== CAMBIAR ROL ===== */
app.put('/api/usuarios/:id/rol', async (req, res) => {
    const { id } = req.params;
    const { rol_id, admin_id } = req.body;
    
    // Verificar que es admin y no es sí mismo
    const admin = await pool.query(`SELECT rol_id FROM usuarios WHERE id = $1`, [admin_id]);
    const rolAdmin = await pool.query(`SELECT id FROM roles WHERE nombre = 'admin'`);
    
    if (admin.rows[0]?.rol_id !== rolAdmin.rows[0]?.id) {
        return res.status(403).json({ error: "No autorizado" });
    }
    
    if (parseInt(id) === parseInt(admin_id)) {
        return res.status(400).json({ error: "No puedes cambiar tu propio rol" });
    }
    
    await pool.query(`UPDATE usuarios SET rol_id = $1 WHERE id = $2`, [rol_id, id]);
    res.json({ mensaje: "Rol actualizado" });
});

/* ===== FRONTEND ===== */
const frontendPath = path.join(__dirname, '../frontend');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ===== SERVER ===== */
app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});

app.post('/api/pagos', async (req, res) => {
    const { usuario_id, monto, fecha, metodo_pago, estado } = req.body;

    try {
        await pool.query(`
            INSERT INTO pagos (usuario_id, monto, fecha, metodo_pago, estado)
            VALUES ($1, $2, $3, $4, $5)
        `, [usuario_id, monto, fecha, metodo_pago, estado]);

        res.json({ mensaje: "Pago registrado correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al registrar pago" });
    }
});