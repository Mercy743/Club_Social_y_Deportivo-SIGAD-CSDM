require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const XLSX   = require('xlsx');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

/* ===== CONEXION BD ===== */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Render configurará esta variable
    ssl: {
        rejectUnauthorized: false, // ← Esta línea es CLAVE para Render
    },
});

const resend = new Resend(process.env.RESEND_API_KEY);

pool.connect()
    .then(() => console.log('Conectado a PostgreSQL'))
    .catch(err => console.error('Error conexión BD', err.stack));


function generarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Crear tabla de sesiones si no existe (ejecutar una vez al iniciar)
pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        creado_en TIMESTAMP DEFAULT NOW(),
        ultimo_uso TIMESTAMP DEFAULT NOW(),
        expira_en TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
        activo BOOLEAN DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
`).catch(err => console.error('Error creando tabla sesiones:', err));

app.post('/api/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No autorizado" });
    }
    const token = authHeader.split(' ')[1];
    try {
        await pool.query(`UPDATE sesiones SET activo = false WHERE token = $1`, [token]);
        res.json({ mensaje: "Sesión cerrada correctamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al cerrar sesión" });
    }
});

// Middleware para verificar token (colocar antes de las rutas protegidas)
async function verificarSesion(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No autorizado. Token no proporcionado." });
    }
    const token = authHeader.split(' ')[1];
    try {
        const sesion = await pool.query(`
            SELECT usuario_id, expira_en FROM sesiones
            WHERE token = $1 AND activo = true AND expira_en > NOW()
        `, [token]);
        if (sesion.rows.length === 0) {
            return res.status(401).json({ error: "Sesión inválida o expirada. Inicia sesión nuevamente." });
        }
        await pool.query(`UPDATE sesiones SET ultimo_uso = NOW() WHERE token = $1`, [token]);
        req.usuario_id = sesion.rows[0].usuario_id;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error interno al verificar sesión" });
    }
}

// Aplicar middleware a todas las rutas /api excepto login y recuperar
app.use('/api', (req, res, next) => {
    const rutasPublicas = ['/login', '/recuperar/solicitar', '/recuperar/restablecer'];
    if (rutasPublicas.some(ruta => req.path.startsWith(ruta))) {
        return next();
    }
    verificarSesion(req, res, next);
});

async function obtenerRolUsuario(usuario_id) {
    if (!usuario_id) return null;
    const res = await pool.query(`SELECT r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1`, [usuario_id]);
    return res.rows[0]?.rol || null;
}

async function esAdmin(usuario_id) {
    const rol = await obtenerRolUsuario(usuario_id);
    return rol === 'admin';
}

function normalizarTexto(str) {
    if (!str) return '';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/* ===== LOGIN ===== */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const emailNormalizado = normalizarTexto(email);

    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, u.password, r.nombre AS rol, u.telefono, u.activo
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.email = $1 AND u.activo = true
        `, [emailNormalizado]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        const usuario = resultado.rows[0];
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        // Verificar si ya existe sesión activa
        const sesionActiva = await pool.query(`
            SELECT id FROM sesiones
            WHERE usuario_id = $1 AND activo = true AND expira_en > NOW()
        `, [usuario.id]);

        if (sesionActiva.rows.length > 0) {
            return res.status(409).json({ error: "Ya hay una sesión activa. Cierra la sesión en el otro dispositivo primero." });
        }

        // Crear nueva sesión
        const token = generarToken();
        await pool.query(`
            INSERT INTO sesiones (usuario_id, token, expira_en)
            VALUES ($1, $2, NOW() + INTERVAL '24 hours')
        `, [usuario.id, token]);

        let tipo_accion = null;
        if (usuario.rol === 'socio') {
            const socio = await pool.query(`SELECT tipo_accion FROM socios WHERE usuario_id = $1`, [usuario.id]);
            if (socio.rows.length > 0) tipo_accion = socio.rows[0].tipo_accion;
        }

        await pool.query(`INSERT INTO auditoria(usuario_id, accion, ip_origen) VALUES($1, $2, $3)`, [usuario.id, 'login', req.ip]);

        const { password: _, ...usuarioSinPassword } = usuario;
        res.json({ ...usuarioSinPassword, tipo_accion, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en servidor" });
    }
});

// Multer: guarda el Excel en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (['xlsx', 'xls'].includes(ext)) cb(null, true);
        else cb(new Error('Solo se permiten archivos .xlsx o .xls'));
    }
});

/* ─── Helpers ─────────────────────────────────────────────────────── */
function generarPasswordTemporal(nombreCompleto, telefono) {
    // Tomar primeras 4 letras del nombre limpio (sin acentos, sin espacios)
    const nombreLimpio = normalizarTexto(nombreCompleto).replace(/\s/g, '').substring(0, 4);
    // Últimos 4 dígitos del teléfono (solo números)
    const telefonoLimpio = String(telefono || '0000').replace(/\D/g, '').slice(-4);
    return (nombreLimpio || 'sigad') + telefonoLimpio;
}

function parsearFecha(valor) {
    if (!valor) return null;
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor))
        return valor.substring(0, 10);
    if (typeof valor === 'number') {
        const f = XLSX.SSF.parse_date_code(valor);
        if (f) return `${f.y}-${String(f.m).padStart(2,'0')}-${String(f.d).padStart(2,'0')}`;
    }
    return null;
}

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
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const nuevoUsuario = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, hashedPassword, rolSocio.rows[0].id, telefono]);
        
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
            SELECT i.id, u.nombre, u.email, u.telefono, u.activo,
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
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const nuevoUsuario = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, hashedPassword, rolInstructor.rows[0].id, telefono]);
        
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
        // Obtener el rol del usuario
        const usuarioRol = await pool.query(`
            SELECT r.nombre as rol 
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1
        `, [usuario_id]);

        const rol = usuarioRol.rows[0]?.rol;

        let limite = 0;
        if (rol === 'socio') limite = 3;
        else if (rol === 'instructor') limite = 5;
        else if (rol === 'admin') limite = 10;

        // Verificar limite de reservaciones activas
        const reservacionesActivas = await pool.query(`
            SELECT COUNT(*) FROM reservaciones 
            WHERE usuario_id = $1 AND estado = 'confirmada' AND fecha_reserva >= CURRENT_DATE
        `, [usuario_id]);

        if (parseInt(reservacionesActivas.rows[0].count) >= limite && rol !== 'admin') {
            return res.status(400).json({ 
                error: `Maximo ${limite} reservaciones activas para ${rol}s` 
            });
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
        const r = await pool.query(`
            SELECT t.*, a.nombre AS actividad_nombre, u.nombre AS creador_nombre
            FROM torneos t
            LEFT JOIN actividades a ON t.actividad_id = a.id
            LEFT JOIN usuarios u ON t.creado_por = u.id
            ORDER BY t.fecha_inicio ASC
        `);
        res.json(r.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener torneos" });
    }
});

app.post('/api/torneos', async (req, res) => {
    let { nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, tipo_torneo, creado_por } = req.body;
    
    nombre = nombre?.trim();
    descripcion = descripcion?.trim() || "";
    tipo_torneo = tipo_torneo?.trim() || "eliminacion";

    const tiposValidos = ['eliminacion', 'liga', 'grupos'];
    if (!tiposValidos.includes(tipo_torneo)) {
        return res.status(400).json({ error: 'Tipo de torneo inválido' });
    }

    if (!nombre || !fecha_inicio || !fecha_fin || !actividad_id) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioD = new Date(fecha_inicio + 'T00:00:00');
    const finD = new Date(fecha_fin + 'T00:00:00');

    if (inicioD < hoy) {
        return res.status(400).json({ error: "La fecha de inicio no puede ser anterior a hoy" });
    }
    if (finD < inicioD) {
        return res.status(400).json({ error: "Fecha inválida" });
    }

    let estadoInicial = 'programado';
    if (inicioD.getTime() === hoy.getTime()) {
        estadoInicial = 'en curso';
    }

    try {
        const usuarioId = creado_por || 1;
        const r = await pool.query(`
            INSERT INTO torneos(nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, tipo_torneo, estado, creado_por)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
        `, [nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, tipo_torneo, estadoInicial, usuarioId]);
        res.status(201).json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear torneo" });
    }
});

app.get('/api/torneos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`SELECT * FROM torneos WHERE id = $1`, [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error de servidor" });
    }
});

app.put('/api/torneos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, tipo_torneo, estado } = req.body;

    try {
        if (estado && !nombre) {
            const estadosValidos = ['programado', 'en curso', 'finalizado', 'cancelado'];
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({ error: 'Estado inválido' });
            }
            const r = await pool.query(`UPDATE torneos SET estado = $1 WHERE id = $2 RETURNING *`, [estado, id]);
            if (r.rows.length === 0) return res.status(404).json({ error: 'Torneo no encontrado' });
            return res.json(r.rows[0]);
        }

        const tiposValidos = ['eliminacion', 'liga', 'grupos'];
        if (!tiposValidos.includes(tipo_torneo)) {
            return res.status(400).json({ error: 'Tipo de torneo inválido' });
        }

        if (!nombre || !fecha_inicio || !fecha_fin || !actividad_id) {
            return res.status(400).json({ error: "Datos incompletos" });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const inicioD = new Date(fecha_inicio + 'T00:00:00');
        const finD = new Date(fecha_fin + 'T00:00:00');

        if (inicioD < hoy) {
            return res.status(400).json({ error: "La fecha de inicio no puede estar en el pasado" });
        }
        if (finD < inicioD) {
            return res.status(400).json({ error: "Fecha inválida" });
        }

        let nuevoEstado = estado || 'programado';
        if (inicioD.getTime() === hoy.getTime()) {
            nuevoEstado = 'en curso';
        }

        const r = await pool.query(`
            UPDATE torneos SET nombre = $1, descripcion = $2, fecha_inicio = $3, fecha_fin = $4, actividad_id = $5, tipo_torneo = $6, estado = $7
            WHERE id = $8 RETURNING *
        `, [nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, tipo_torneo, nuevoEstado, id]);

        if (r.rows.length === 0) return res.status(404).json({ error: 'Torneo no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al actualizar" });
    }
});

app.delete('/api/torneos/:id', async (req, res) => {
    const { id } = req.params;
    const { usuario_id, password } = req.body;

    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });

    const adminCheck = await pool.query(`
        SELECT u.password, r.nombre as rol
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.id = $1
    `, [usuario_id]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].rol !== 'admin') {
        return res.status(403).json({ error: "No autorizado. Solo administradores pueden eliminar torneos." });
    }
    const passwordValida = await bcrypt.compare(password, adminCheck.rows[0].password);
    if (!passwordValida) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    try {
        const resultado = await pool.query('DELETE FROM torneos WHERE id = $1', [id]);
        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: "El torneo no existe." });
        }
        res.json({ mensaje: "Torneo eliminado correctamente." });
    } catch (error) {
        console.error("Error al eliminar torneo:", error);
        if (error.code === '23503') {
            return res.status(400).json({ error: "No se puede eliminar: El torneo ya tiene participantes inscritos." });
        }
        res.status(500).json({ error: "Error interno al eliminar el torneo." });
    }
});

app.put('/api/torneos/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['programado', 'en curso', 'finalizado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }
    try {
        const r = await pool.query(`UPDATE torneos SET estado = $1 WHERE id = $2 RETURNING *`, [estado, id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Torneo no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

/* ===== PARTICIPANTES TORNEO ===== */
app.get('/api/torneos/:id/participantes', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`
            SELECT pt.*, u.nombre, u.apellido, u.email
            FROM participantes_torneo pt
            LEFT JOIN usuarios u ON pt.usuario_id = u.id
            WHERE pt.torneo_id = $1
            ORDER BY pt.id
        `, [id]);
        res.json(r.rows);
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

app.post('/api/torneos/:id/participantes', async (req, res) => {
    const { id } = req.params;
    const { usuario_id, nombre_invitado, cuota_pagada } = req.body;

    try {
        const torneo = await pool.query('SELECT estado FROM torneos WHERE id = $1', [id]);
        if (torneo.rows.length === 0) {
            return res.status(404).json({ error: "Torneo no encontrado" });
        }
        const estado = torneo.rows[0].estado;
        if (estado === 'finalizado' || estado === 'cancelado') {
            return res.status(400).json({ error: "No se pueden agregar participantes a un torneo finalizado o cancelado" });
        }
        if (!usuario_id && !nombre_invitado) {
            return res.status(400).json({ error: "Debe enviar usuario o invitado" });
        }

        const torneoResult = await pool.query(`SELECT max_participantes FROM torneos WHERE id = $1`, [id]);
        const maxParticipantes = torneoResult.rows[0]?.max_participantes || 16;
        
        const totalResult = await pool.query(`SELECT COUNT(*) AS total FROM participantes_torneo WHERE torneo_id = $1`, [id]);
        const totalActual = parseInt(totalResult.rows[0].total);

        if (totalActual >= maxParticipantes) {
            return res.status(400).json({ error: 'El torneo ya está lleno' });
        }

        if (usuario_id) {
            const existe = await pool.query(`SELECT id FROM participantes_torneo WHERE torneo_id=$1 AND usuario_id=$2`, [id, usuario_id]);
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: "Ya registrado" });
            }
        }

        if (nombre_invitado) {
            const invitadoExiste = await pool.query(`SELECT id FROM participantes_torneo WHERE torneo_id=$1 AND LOWER(nombre_invitado) = LOWER($2)`, [id, nombre_invitado]);
            if (invitadoExiste.rows.length > 0) {
                return res.status(400).json({ error: 'El invitado ya está registrado' });
            }
        }

        const r = await pool.query(`
            INSERT INTO participantes_torneo (torneo_id, usuario_id, nombre_invitado, cuota_pagada)
            VALUES ($1,$2,$3,$4) RETURNING *
        `, [id, usuario_id || null, nombre_invitado || null, cuota_pagada || 0]);
        res.json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error" });
    }
});

app.delete('/api/torneos/:id/participantes/:pid', async (req, res) => {
    const { pid } = req.params;
    try {
        await pool.query(`DELETE FROM participantes_torneo WHERE id=$1`, [pid]);
        res.json({ mensaje: "Eliminado" });
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

app.put('/api/torneos/:id/participantes/:pid/resultado', async (req, res) => {
    const { pid } = req.params;
    const { resultado } = req.body;
    try {
        const r = await pool.query(`UPDATE participantes_torneo SET resultado=$1 WHERE id=$2 RETURNING *`, [resultado, pid]);
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

/* ===== BRACKET - GENERAR ===== */
app.post('/api/torneos/:id/generar-bracket', async (req, res) => {
    const { id } = req.params;

    try {
        const torneoResult = await pool.query(`SELECT tipo_torneo FROM torneos WHERE id = $1`, [id]);
        if (torneoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Torneo no encontrado' });
        }

        const tipoTorneo = torneoResult.rows[0].tipo_torneo;
        if (tipoTorneo !== 'eliminacion') {
            return res.status(400).json({ error: 'Este torneo no utiliza bracket' });
        }

        const existentes = await pool.query(`SELECT id FROM partidos WHERE torneo_id = $1 LIMIT 1`, [id]);
        if (existentes.rows.length > 0) {
            return res.status(400).json({ error: 'El bracket ya fue generado' });
        }

        const participantesResult = await pool.query(`SELECT * FROM participantes_torneo WHERE torneo_id = $1 ORDER BY RANDOM()`, [id]);
        const participantes = participantesResult.rows;

        if (participantes.length < 2) {
            return res.status(400).json({ error: 'Se necesitan al menos 2 participantes' });
        }
        if (participantes.length % 2 !== 0) {
            return res.status(400).json({ error: 'El número de participantes debe ser par' });
        }

        let ronda = 'Primera ronda';
        if (participantes.length === 4) ronda = 'Semifinal';
        if (participantes.length === 8) ronda = 'Cuartos';
        if (participantes.length === 16) ronda = 'Octavos';

        const partidosGenerados = [];
        for (let i = 0; i < participantes.length; i += 2) {
            const p1 = participantes[i];
            const p2 = participantes[i + 1];
            const partido = await pool.query(`
                INSERT INTO partidos (torneo_id, participante1_id, participante2_id, ronda, estado)
                VALUES ($1,$2,$3,$4,'pendiente') RETURNING *
            `, [id, p1.id, p2.id, ronda]);
            partidosGenerados.push(partido.rows[0]);
        }

        await pool.query(`UPDATE torneos SET estado = 'en curso' WHERE id = $1`, [id]);

        res.json({ mensaje: 'Bracket generado correctamente', ronda, partidos: partidosGenerados });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar bracket' });
    }
});

/* ===== BRACKET - OBTENER ===== */
app.get('/api/torneos/:id/bracket', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`
            SELECT p.*,
                COALESCE(u1.nombre, pt1.nombre_invitado, 'Jugador 1') AS jugador1,
                COALESCE(u2.nombre, pt2.nombre_invitado, 'Jugador 2') AS jugador2
            FROM partidos p
            LEFT JOIN participantes_torneo pt1 ON p.participante1_id = pt1.id
            LEFT JOIN participantes_torneo pt2 ON p.participante2_id = pt2.id
            LEFT JOIN usuarios u1 ON pt1.usuario_id = u1.id
            LEFT JOIN usuarios u2 ON pt2.usuario_id = u2.id
            WHERE p.torneo_id = $1 ORDER BY p.id
        `, [id]);
        const partidos = r.rows;
        const bracket = {};
        partidos.forEach(p => {
            if (!bracket[p.ronda]) bracket[p.ronda] = [];
            bracket[p.ronda].push(p);
        });
        res.json(bracket);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener bracket' });
    }
});

/* ===== PARTIDOS ===== */
app.get('/api/torneos/:id/partidos', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`SELECT * FROM partidos WHERE torneo_id = $1 ORDER BY fecha, hora_inicio`, [id]);
        res.json(r.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener partidos' });
    }
});

app.get('/api/partidos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`SELECT * FROM partidos WHERE id = $1`, [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Partido no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener partido' });
    }
});

app.post('/api/torneos/:id/partidos', async (req, res) => {
    const { id } = req.params;
    const { participante1_id, participante2_id, ronda, espacio_id, fecha, hora_inicio, hora_fin } = req.body;
    try {
        const r = await pool.query(`
            INSERT INTO partidos (torneo_id, participante1_id, participante2_id, ronda, espacio_id, fecha, hora_inicio, hora_fin)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [id, participante1_id, participante2_id, ronda, espacio_id, fecha, hora_inicio, hora_fin]);
        res.status(201).json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear partido' });
    }
});

app.put('/api/partidos/:id', async (req, res) => {
    const { id } = req.params;
    const { participante1_id, participante2_id, ronda, espacio_id, fecha, hora_inicio, hora_fin, estado } = req.body;
    try {
        const r = await pool.query(`
            UPDATE partidos SET participante1_id=$1, participante2_id=$2, ronda=$3, espacio_id=$4, fecha=$5, hora_inicio=$6, hora_fin=$7, estado=$8
            WHERE id=$9 RETURNING *
        `, [participante1_id, participante2_id, ronda, espacio_id, fecha, hora_inicio, hora_fin, estado, id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Partido no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar partido' });
    }
});

app.delete('/api/partidos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`DELETE FROM partidos WHERE id = $1 RETURNING *`, [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Partido no encontrado' });
        res.json({ mensaje: 'Partido eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar partido' });
    }
});

app.put('/api/partidos/:id/resultado', async (req, res) => {
    const { id } = req.params;
    const { marcador1, marcador2, ganador_id } = req.body;

    try {
        const partidoResult = await pool.query(`SELECT * FROM partidos WHERE id = $1`, [id]);
        if (partidoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }

        const partido = partidoResult.rows[0];

        if (marcador1 === null || marcador2 === null || marcador1 < 0 || marcador2 < 0) {
            return res.status(400).json({ error: 'Marcador inválido' });
        }
        if (marcador1 === marcador2) {
            return res.status(400).json({ error: 'No puede haber empate' });
        }

        const ganadorCorrecto = marcador1 > marcador2 ? partido.participante1_id : partido.participante2_id;
        if (ganador_id !== ganadorCorrecto) {
            return res.status(400).json({ error: 'Ganador incorrecto según el marcador' });
        }

        const r = await pool.query(`
            UPDATE partidos SET marcador1=$1, marcador2=$2, ganador_id=$3, estado='finalizado'
            WHERE id=$4 RETURNING *
        `, [marcador1, marcador2, ganador_id, id]);
        res.json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar resultado' });
    }
});

/* ===== SIGUIENTE RONDA ===== */
app.post('/api/torneos/:id/siguiente-ronda', async (req, res) => {
    const { id } = req.params;

    try {
        const ultimaRondaResult = await pool.query(`SELECT ronda FROM partidos WHERE torneo_id = $1 ORDER BY id DESC LIMIT 1`, [id]);
        if (ultimaRondaResult.rows.length === 0) {
            return res.status(400).json({ error: 'No existen rondas' });
        }

        const ultimaRonda = ultimaRondaResult.rows[0].ronda;
        const partidosResult = await pool.query(`SELECT * FROM partidos WHERE torneo_id = $1 AND estado = 'finalizado' AND ronda = $2 ORDER BY id`, [id, ultimaRonda]);
        const partidos = partidosResult.rows;

        if (partidos.length === 0) {
            return res.status(400).json({ error: 'No hay partidos finalizados en la última ronda' });
        }

        const incompletos = partidos.filter(p => !p.ganador_id);
        if (incompletos.length > 0) {
            return res.status(400).json({ error: 'Aún hay partidos sin finalizar' });
        }

        const ganadores = partidos.map(p => p.ganador_id);

        if (ganadores.length === 1) {
            const campeon = ganadores[0];
            const finalResult = await pool.query(`SELECT * FROM partidos WHERE torneo_id = $1 AND ronda = 'Final' AND estado = 'finalizado' LIMIT 1`, [id]);
            let segundoLugar = null;
            if (finalResult.rows.length > 0) {
                const final = finalResult.rows[0];
                segundoLugar = final.participante1_id === campeon ? final.participante2_id : final.participante1_id;
            }
            await pool.query(`INSERT INTO resultados_torneo (torneo_id, primer_lugar, segundo_lugar, tercer_lugar) VALUES ($1,$2,$3,NULL)`, [id, campeon, segundoLugar]);
            await pool.query(`UPDATE torneos SET estado = 'finalizado' WHERE id = $1`, [id]);
            return res.json({ mensaje: 'Torneo finalizado', campeon, segundoLugar });
        }

        if (ganadores.length < 2) return res.status(400).json({ error: 'No hay suficientes ganadores' });
        if (ganadores.length % 2 !== 0) return res.status(400).json({ error: 'La cantidad de ganadores debe ser par' });

        let ronda = 'Nueva ronda';
        if (ganadores.length === 2) ronda = 'Final';
        if (ganadores.length === 4) ronda = 'Semifinal';
        if (ganadores.length === 8) ronda = 'Cuartos';

        const nuevosPartidos = [];
        for (let i = 0; i < ganadores.length; i += 2) {
            const partido = await pool.query(`
                INSERT INTO partidos (torneo_id, participante1_id, participante2_id, ronda, estado)
                VALUES ($1,$2,$3,$4,'pendiente') RETURNING *
            `, [id, ganadores[i], ganadores[i + 1], ronda]);
            nuevosPartidos.push(partido.rows[0]);
        }
        res.json({ mensaje: 'Siguiente ronda generada', ronda, partidos: nuevosPartidos });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar siguiente ronda' });
    }
});

/* ===== TOP 3 TORNEO ===== */
app.get('/api/torneos/:id/top3', async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query(`
            SELECT rt.*,
                COALESCE(u1.nombre, p1.nombre_invitado) AS primer_nombre,
                COALESCE(u2.nombre, p2.nombre_invitado) AS segundo_nombre,
                COALESCE(u3.nombre, p3.nombre_invitado) AS tercer_nombre
            FROM resultados_torneo rt
            LEFT JOIN participantes_torneo p1 ON rt.primer_lugar = p1.id
            LEFT JOIN participantes_torneo p2 ON rt.segundo_lugar = p2.id
            LEFT JOIN participantes_torneo p3 ON rt.tercer_lugar = p3.id
            LEFT JOIN usuarios u1 ON p1.usuario_id = u1.id
            LEFT JOIN usuarios u2 ON p2.usuario_id = u2.id
            LEFT JOIN usuarios u3 ON p3.usuario_id = u3.id
            WHERE rt.torneo_id = $1
        `, [id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Top 3 no disponible' });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener top 3' });
    }
});

/* ===== TABLA DE POSICIONES ===== */
app.get('/api/torneos/:id/tabla', async (req, res) => {
    const { id } = req.params;
    try {
        const participantesResult = await pool.query(`
            SELECT pt.*, u.nombre
            FROM participantes_torneo pt
            LEFT JOIN usuarios u ON pt.usuario_id = u.id
            WHERE pt.torneo_id = $1
        `, [id]);
        const participantes = participantesResult.rows;
        const partidosResult = await pool.query(`SELECT * FROM partidos WHERE torneo_id = $1 AND estado = 'finalizado'`, [id]);
        const partidos = partidosResult.rows;
        const tabla = {};
        participantes.forEach(p => {
            tabla[p.id] = {
                participante_id: p.id,
                nombre: p.nombre || p.nombre_invitado || 'Participante',
                PJ: 0, PG: 0, PE: 0, PP: 0, GF: 0, GC: 0, PTS: 0
            };
        });
        partidos.forEach(partido => {
            const p1 = tabla[partido.participante1_id];
            const p2 = tabla[partido.participante2_id];
            if (!p1 || !p2) return;
            p1.PJ++; p2.PJ++;
            p1.GF += partido.marcador1; p1.GC += partido.marcador2;
            p2.GF += partido.marcador2; p2.GC += partido.marcador1;
            if (partido.marcador1 > partido.marcador2) {
                p1.PG++; p2.PP++; p1.PTS += 3;
            } else if (partido.marcador2 > partido.marcador1) {
                p2.PG++; p1.PP++; p2.PTS += 3;
            } else {
                p1.PE++; p2.PE++; p1.PTS += 1; p2.PTS += 1;
            }
        });
        const resultado = Object.values(tabla).sort((a, b) => {
            if (b.PTS !== a.PTS) return b.PTS - a.PTS;
            const diffA = a.GF - a.GC;
            const diffB = b.GF - b.GC;
            return diffB - diffA;
        });
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: 'Error al generar tabla' });
    }
});

/* ===== EVENTOS ===== */
app.post('/api/eventos', async (req, res) => {
    const { nombre, descripcion, fecha_evento, hora, creado_por } = req.body;
    // Validar que la fecha no sea anterior a hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(fecha_evento);
    if (fechaEvento < hoy) {
        return res.status(400).json({ error: "No se pueden crear eventos en fechas pasadas." });
    }
    try {
        await pool.query('INSERT INTO eventos(nombre, descripcion, fecha_evento, hora, creado_por) VALUES($1, $2, $3, $4, $5)', [nombre, descripcion, fecha_evento, hora, creado_por]);
        res.json({ mensaje: "Evento creado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear evento" });
    }
});

app.get('/api/eventos', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT e.id_evento, e.nombre, e.descripcion, e.fecha_evento, e.hora, u.nombre AS creador
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

/* ===== OBTENER EVENTO POR ID ===== */
app.get('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query('SELECT * FROM eventos WHERE id_evento = $1', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Evento no encontrado" });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener evento" });
    }
});

app.put('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, fecha_evento, hora } = req.body;
    // Validar que la fecha no sea anterior a hoy (opcional: permitir edición solo si la fecha no es pasada)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(fecha_evento);
    if (fechaEvento < hoy) {
        return res.status(400).json({ error: "No se puede cambiar la fecha a una fecha pasada." });
    }
    try {
        await pool.query(`UPDATE eventos SET nombre=$1, descripcion=$2, fecha_evento=$3, hora=$4 WHERE id_evento=$5`, [nombre, descripcion, fecha_evento, hora, id]);
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
app.get("/api/actividades", async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT a.*, COUNT(i.id) AS inscritos
            FROM actividades a
            LEFT JOIN inscripciones i ON a.id = i.actividad_id AND i.estado = 'activa'
            GROUP BY a.id ORDER BY a.id
        `);
        res.json(r.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener actividades" });
    }
});

app.get("/api/actividades/:id", async (req, res) => {
    try {
        const r = await pool.query(`SELECT a.*, COALESCE((SELECT COUNT(*) FROM inscripciones WHERE actividad_id = a.id AND estado = 'activa'), 0) as inscritos FROM actividades a WHERE a.id = $1`, [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

app.post("/api/actividades", async (req, res) => {
    const { nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id, usuario_id } = req.body;
    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });
    const rol = await obtenerRolUsuario(usuario_id);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });

    if (!nombre || !capacidad) return res.status(400).json({ error: "Datos incompletos" });
    try {
        const r = await pool.query(`
            INSERT INTO actividades(nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id, creado_por) 
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
        `, [nombre, descripcion || '', capacidad, icono, nivel, duracion, equipo, tipo_actividad_id || null, usuario_id]);
        res.status(201).json(r.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear" });
    }
});

app.put("/api/actividades/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id, usuario_id, admin_id, password } = req.body;
    const usuario = usuario_id || admin_id;
    if (!usuario) return res.status(401).json({ error: "No autorizado" });

    const rol = await obtenerRolUsuario(usuario);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });

    if (rol === 'admin') {
        if (!password) return res.status(400).json({ error: "Contraseña requerida" });
        const adminData = await pool.query(`SELECT password FROM usuarios WHERE id = $1`, [usuario]);
        const passOk = await bcrypt.compare(password, adminData.rows[0].password);
        if (!passOk) return res.status(401).json({ error: "Contraseña incorrecta" });
    } else {
        const actividad = await pool.query(`SELECT creado_por FROM actividades WHERE id = $1`, [id]);
        if (actividad.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
        if (actividad.rows[0].creado_por !== usuario) {
            return res.status(403).json({ error: "Solo puedes editar tus propias actividades" });
        }
    }

    const r = await pool.query(`
        UPDATE actividades SET nombre=$1, descripcion=$2, capacidad=$3, icono=$4, nivel=$5, duracion=$6, equipo=$7, tipo_actividad_id=$8
        WHERE id=$9 RETURNING *
    `, [nombre, descripcion || '', capacidad, icono, nivel, duracion, equipo, tipo_actividad_id || null, id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json(r.rows[0]);
});

app.delete("/api/actividades/:id", async (req, res) => {
    const { id } = req.params;
    const { usuario_id, admin_id, password } = req.body;
    const usuario = usuario_id || admin_id;
    if (!usuario) return res.status(401).json({ error: "No autorizado" });

    const rol = await obtenerRolUsuario(usuario);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });

    if (rol === 'admin') {
        if (!password) return res.status(400).json({ error: "Contraseña requerida" });
        const adminData = await pool.query(`SELECT password FROM usuarios WHERE id = $1`, [usuario]);
        const passOk = await bcrypt.compare(password, adminData.rows[0].password);
        if (!passOk) return res.status(401).json({ error: "Contraseña incorrecta" });
    } else {
        const actividad = await pool.query(`SELECT creado_por FROM actividades WHERE id = $1`, [id]);
        if (actividad.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
        if (actividad.rows[0].creado_por !== usuario) {
            return res.status(403).json({ error: "Solo puedes eliminar tus propias actividades" });
        }
    }

    const check = await pool.query("SELECT * FROM inscripciones WHERE actividad_id=$1 AND estado='activa'", [id]);
    if (check.rows.length > 0) return res.status(400).json({ error: "Tiene inscripciones activas" });
    const r = await pool.query("DELETE FROM actividades WHERE id=$1 RETURNING *", [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json({ mensaje: "Actividad eliminada" });
});

/* ===== HORARIOS ===== */
app.get('/api/horarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT h.*, e.nombre as espacio_nombre, a.nombre as actividad_nombre, u.nombre as instructor_nombre
            FROM horarios h
            LEFT JOIN espacios_deportivos e ON h.espacio_id = e.id
            LEFT JOIN actividades a ON h.actividad_id = a.id
            LEFT JOIN usuarios u ON h.instructor_id = u.id
            ORDER BY h.dia_semana, h.hora_inicio
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener horarios" });
    }
});

app.post('/api/horarios', async (req, res) => {
    const { espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, usuario_id } = req.body;
    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });
    const rol = await obtenerRolUsuario(usuario_id);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });
    let instructorFinal = instructor_id;
    if (rol === 'instructor') {
        // Forzar que instructor_id sea el mismo que usuario_id
        instructorFinal = usuario_id;
    }
    // ... conflicto y demás
    const resultado = await pool.query(`
        INSERT INTO horarios(espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, activo)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *
    `, [espacio_id, actividad_id, instructorFinal, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia]);
    res.json(resultado.rows[0]);
});

app.put('/api/horarios/:id', async (req, res) => {
    const { id } = req.params;
    const { espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, usuario_id } = req.body;
    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });
    const rol = await obtenerRolUsuario(usuario_id);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });
    if (rol === 'instructor') {
        const horario = await pool.query("SELECT instructor_id FROM horarios WHERE id = $1", [id]);
        if (horario.rows.length === 0) return res.status(404).json({ error: "Horario no encontrado" });
        if (horario.rows[0].instructor_id !== usuario_id) {
            return res.status(403).json({ error: "Solo puedes editar tus propios horarios" });
        }
    }
    // ... actualización
    await pool.query(`
        UPDATE horarios SET espacio_id=$1, actividad_id=$2, instructor_id=$3, dia_semana=$4, hora_inicio=$5, hora_fin=$6, fecha_inicio_vigencia=$7, fecha_fin_vigencia=$8
        WHERE id=$9
    `, [espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, id]);
    res.json({ mensaje: "Horario actualizado" });
});

app.patch('/api/horarios/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { activo, usuario_id } = req.body;
    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });
    const rol = await obtenerRolUsuario(usuario_id);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });
    if (rol === 'instructor') {
        const horario = await pool.query("SELECT instructor_id FROM horarios WHERE id = $1", [id]);
        if (horario.rows.length === 0) return res.status(404).json({ error: "Horario no encontrado" });
        if (horario.rows[0].instructor_id !== usuario_id) {
            return res.status(403).json({ error: "No puedes modificar este horario" });
        }
    }
    await pool.query(`UPDATE horarios SET activo = $1 WHERE id = $2`, [activo, id]);
    res.json({ mensaje: "Estado actualizado" });
});

app.delete('/api/horarios/:id', async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(401).json({ error: "No autorizado" });
    const rol = await obtenerRolUsuario(usuario_id);
    if (rol !== 'admin' && rol !== 'instructor') return res.status(403).json({ error: "No autorizado" });
    if (rol === 'instructor') {
        const horario = await pool.query("SELECT instructor_id FROM horarios WHERE id = $1", [id]);
        if (horario.rows.length === 0) return res.status(404).json({ error: "Horario no encontrado" });
        if (horario.rows[0].instructor_id !== usuario_id) {
            return res.status(403).json({ error: "No puedes eliminar este horario" });
        }
    }
    await pool.query('DELETE FROM horarios WHERE id = $1', [id]);
    res.json({ mensaje: "Horario eliminado" });
});
/* ===== INSTRUCTOR ASIGNAR A ACTIVIDAD ===== */
app.post('/api/actividades/:id/asignar-instructor', async (req, res) => {
    const { id } = req.params;
    const { instructor_id } = req.body;
    try {
        const usuario = await pool.query(`SELECT u.id, r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND r.nombre = 'instructor' AND u.activo = true`, [instructor_id]);
        if (usuario.rows.length === 0) {
            return res.status(403).json({ error: "No eres instructor o no existe" });
        }
        const actividad = await pool.query("SELECT id FROM actividades WHERE id = $1", [id]);
        if (actividad.rows.length === 0) {
            return res.status(404).json({ error: "Actividad no encontrada" });
        }
        await pool.query(`CREATE TABLE IF NOT EXISTS actividad_instructores (id SERIAL PRIMARY KEY, actividad_id INTEGER REFERENCES actividades(id) ON DELETE CASCADE, instructor_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE, fecha_asignacion DATE DEFAULT CURRENT_DATE, activo BOOLEAN DEFAULT true, UNIQUE(actividad_id, instructor_id))`);
        const existe = await pool.query(`SELECT id FROM actividad_instructores WHERE actividad_id = $1 AND instructor_id = $2 AND activo = true`, [id, instructor_id]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Ya estás asignado a esta actividad" });
        }
        await pool.query(`INSERT INTO actividad_instructores (actividad_id, instructor_id, fecha_asignacion, activo) VALUES ($1, $2, CURRENT_DATE, true)`, [id, instructor_id]);
        res.json({ mensaje: "Te has asignado como instructor de esta actividad" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al asignar instructor" });
    }
});

app.get('/api/actividades/:id/instructores', async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(`SELECT u.id, u.nombre, u.email FROM actividad_instructores ai JOIN usuarios u ON ai.instructor_id = u.id WHERE ai.actividad_id = $1 AND ai.activo = true`, [id]);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener instructores" });
    }
});

/* ===== SOCIO INSCRIBIRSE ===== */
app.post('/api/actividades/:id/inscribirse', async (req, res) => {
    const { id } = req.params;
    const { socio_id } = req.body;
    try {
        const usuario = await pool.query(`SELECT u.id, r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND r.nombre = 'socio' AND u.activo = true`, [socio_id]);
        if (usuario.rows.length === 0) {
            return res.status(403).json({ error: "No eres socio o no existe" });
        }
        const actividad = await pool.query(`SELECT a.capacidad, a.nombre, (SELECT COUNT(*) FROM inscripciones WHERE actividad_id = a.id AND estado = 'activa') as inscritos FROM actividades a WHERE a.id = $1`, [id]);
        if (actividad.rows.length === 0) {
            return res.status(404).json({ error: "Actividad no encontrada" });
        }
        const inscritos = parseInt(actividad.rows[0].inscritos) || 0;
        const capacidad = actividad.rows[0].capacidad;
        if (inscritos >= capacidad) {
            return res.status(400).json({ error: "No hay cupo disponible" });
        }
        const existe = await pool.query(`SELECT id FROM inscripciones WHERE actividad_id = $1 AND socio_id = $2 AND estado = 'activa'`, [id, socio_id]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Ya estás inscrito en esta actividad" });
        }
        await pool.query(`INSERT INTO inscripciones (actividad_id, socio_id, fecha_inscripcion, estado) VALUES ($1, $2, CURRENT_DATE, 'activa')`, [id, socio_id]);
        res.json({ mensaje: "Te has inscrito exitosamente a la actividad" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al inscribirse" });
    }
});

app.get('/api/actividades/:id/inscrito/:socio_id', async (req, res) => {
    const { id, socio_id } = req.params;
    try {
        const resultado = await pool.query(`SELECT * FROM inscripciones WHERE actividad_id = $1 AND socio_id = $2 AND estado = 'activa'`, [id, socio_id]);
        res.json({ inscrito: resultado.rows.length > 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al verificar inscripción" });
    }
});

/* ===== ESTADISTICAS DASHBOARD ===== */
app.get('/api/estadisticas', async (req, res) => {
    try {
        const eventos = await pool.query('SELECT COUNT(*) FROM eventos');
        const usuarios = await pool.query('SELECT COUNT(*) FROM usuarios WHERE activo = true');
        const socios = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'socio') AND activo = true");
        const instructores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'instructor') AND activo = true");
        const reservacionesHoy = await pool.query("SELECT COUNT(*) FROM reservaciones WHERE fecha_reserva = CURRENT_DATE");
        const ludotecaActivos = await pool.query("SELECT COUNT(*) FROM registro_ludoteca WHERE estatus = 'activo' AND fecha = CURRENT_DATE");
        const invitadosHoy = await pool.query("SELECT COUNT(*) FROM invitados WHERE fecha_visita = CURRENT_DATE");
        const sociosPorTipo = await pool.query(`SELECT s.tipo_accion, COUNT(*) as total FROM socios s JOIN usuarios u ON s.usuario_id = u.id WHERE u.activo = true GROUP BY s.tipo_accion`);
        const sociosPorEstatus = await pool.query(`SELECT s.estatus_accion, COUNT(*) as total FROM socios s JOIN usuarios u ON s.usuario_id = u.id WHERE u.activo = true AND s.estatus_accion IS NOT NULL GROUP BY s.estatus_accion`);
        const actividadesPopulares = await pool.query(`SELECT a.nombre, COUNT(i.id) as inscritos FROM actividades a LEFT JOIN inscripciones i ON a.id = i.actividad_id AND i.estado = 'activa' GROUP BY a.id ORDER BY inscritos DESC LIMIT 5`);
        
        const basicsPlano = {
            eventos: parseInt(eventos.rows[0].count),
            usuarios: parseInt(usuarios.rows[0].count),
            socios: parseInt(socios.rows[0].count),
            instructores: parseInt(instructores.rows[0].count),
            reservacionesHoy: parseInt(reservacionesHoy.rows[0].count),
            ludotecaActivos: parseInt(ludotecaActivos.rows[0].count),
            invitadosHoy: parseInt(invitadosHoy.rows[0].count)
        };
        res.json({ ...basicsPlano, basics: basicsPlano, sociosPorTipo: sociosPorTipo.rows, sociosPorEstatus: sociosPorEstatus.rows, actividadesPopulares: actividadesPopulares.rows });
    } catch (error) {
        console.error('Error en estadisticas:', error);
        res.status(500).json({ error: "Error al obtener estadisticas" });
    }
});

/* ===== BUSCAR USUARIOS (socios + instructores) ===== */
app.get('/api/usuarios/buscar', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json([]);
    try {
        const esNumero = /^\d+$/.test(q);
        let query, params;
        if (esNumero) {
            // Buscar por ID de usuario o número de acción (solo socios tienen número)
            query = `
                SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.activo, r.nombre AS rol,
                       s.numero_accion, s.tipo_accion
                FROM usuarios u
                LEFT JOIN socios s ON u.id = s.usuario_id
                JOIN roles r ON u.rol_id = r.id
                WHERE u.id = $1 OR s.numero_accion = $2
                ORDER BY u.nombre
                LIMIT 20
            `;
            params = [parseInt(q), String(q)];
        } else {
            query = `
                SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.activo, r.nombre AS rol,
                       s.numero_accion, s.tipo_accion
                FROM usuarios u
                LEFT JOIN socios s ON u.id = s.usuario_id
                JOIN roles r ON u.rol_id = r.id
                WHERE u.email ILIKE $1 OR u.nombre ILIKE $1 OR u.apellido ILIKE $1
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    try {
        const totalResult = await pool.query(`SELECT COUNT(*) as total FROM usuarios u JOIN roles r ON u.rol_id = r.id LEFT JOIN socios s ON u.id = s.usuario_id WHERE u.id != $1`, [admin_id]);
        const total = parseInt(totalResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);
        const resultado = await pool.query(`SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.telefono_particular, u.fecha_nacimiento, u.activo, u.fecha_registro, r.nombre AS rol, u.rol_id, s.numero_accion, s.tipo_accion, s.estatus_accion FROM usuarios u JOIN roles r ON u.rol_id = r.id LEFT JOIN socios s ON u.id = s.usuario_id WHERE u.id != $1 ORDER BY u.id LIMIT $2 OFFSET $3`, [admin_id, limit, offset]);
        res.json({ usuarios: resultado.rows, paginacion: { currentPage: page, totalPages, totalRegistros: total, limit, hasNext: page < totalPages, hasPrev: page > 1 } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

/* ===== USUARIOS ===== */
app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol_id, telefono } = req.body;

    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Email ya registrado" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const resultado = await pool.query(`
            INSERT INTO usuarios(nombre, email, password, rol_id, telefono, activo)
            VALUES($1, $2, $3, $4, $5, true)
            RETURNING id
        `, [nombre, email, hashedPassword, rol_id, telefono]);

        res.json({ id: resultado.rows[0].id, mensaje: "Usuario creado" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear usuario" });
    }
});

app.delete('/api/usuarios/:id/seguro', async (req, res) => {
    const { id } = req.params;
    const { admin_id, password } = req.body;

    try {
        const admin = await pool.query(`
            SELECT u.password, r.nombre as rol
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1
        `, [admin_id]);

        if (admin.rows.length === 0 || admin.rows[0].rol !== 'admin') {
            return res.status(403).json({ error: "No autorizado" });
        }

        const passwordValida = await bcrypt.compare(password, admin.rows[0].password);
        if (!passwordValida) {
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

app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email, telefono } = req.body;

    try {
        await pool.query(`
            UPDATE usuarios 
            SET nombre = $1, apellido = $2, email = $3, telefono = $4
            WHERE id = $5
        `, [nombre, apellido, email, telefono, id]);

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

app.get('/api/usuarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.activo, r.nombre AS rol
            FROM usuarios u
            LEFT JOIN roles r ON u.rol_id = r.id
            WHERE u.activo = true
            ORDER BY u.nombre
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

/* ===== CAMBIAR ROL ===== */
app.put('/api/usuarios/:id/rol', async (req, res) => {
    const { id } = req.params;
    const { rol_id, admin_id } = req.body;
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

/* ===== IMPORTAR SOCIOS EXCEL ===== */
app.post('/api/socios/importar-excel', upload.single('archivo'), async (req, res) => {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(401).json({ error: "Se requiere identificacion de administrador" });

    const adminCheck = await pool.query(`SELECT r.nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND u.activo = true`, [admin_id]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].nombre !== 'admin') {
        return res.status(403).json({ error: "No autorizado. Solo administradores pueden importar socios." });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibio ningun archivo' });

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = workbook.Sheets[workbook.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: null });
        if (filas.length === 0) return res.status(400).json({ error: 'El archivo esta vacio' });

        const columnasRequeridas = ['Numero_Accion', 'Nombre_Completo', 'Email'];
        const columnasFaltantes = columnasRequeridas.filter(c => !filas[0].hasOwnProperty(c));
        if (columnasFaltantes.length > 0) {
            return res.status(400).json({ error: `Faltan columnas: ${columnasFaltantes.join(', ')}` });
        }

        const rolSocio = await pool.query("SELECT id FROM roles WHERE nombre = 'socio'");
        if (rolSocio.rows.length === 0) return res.status(500).json({ error: "No existe el rol 'socio'" });
        const rolSocioId = rolSocio.rows[0].id;

        // Agrupar por Numero_Accion
        const grupos = new Map();
        for (const fila of filas) {
            const numAccion = fila.Numero_Accion;
            if (!numAccion) continue;
            if (!grupos.has(numAccion)) grupos.set(numAccion, []);
            grupos.get(numAccion).push(fila);
        }

        let insertados = 0, omitidos = 0, errores = 0;
        const detalle = [], credencialesGeneradas = [];

        for (const [numAccion, miembros] of grupos) {
            const titular = miembros.find(m => m.Rol === 'Titular');
            if (!titular) {
                omitidos++;
                detalle.push({ numAccion, error: 'No tiene titular' });
                continue;
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const emailNormalizado = normalizarTexto(titular.Email);
                const existe = await client.query(
                    `SELECT u.id FROM usuarios u JOIN socios s ON u.id = s.usuario_id WHERE u.email = $1 OR s.numero_accion = $2`,
                    [emailNormalizado, String(numAccion)]
                );
                if (existe.rows.length > 0) {
                    omitidos++;
                    detalle.push({ numAccion, error: 'Ya existe (email o numero accion duplicado)' });
                    await client.query('ROLLBACK');
                    continue;
                }

                const nombreCompleto = titular.Nombre_Completo || '';
                const partes = nombreCompleto.trim().split(' ');
                const nombre = partes[0] || '';
                const apellido = partes.slice(1).join(' ') || '';
                const passwordTemp = generarPasswordTemporal(nombreCompleto, titular.Telefono_Celular);
                const hashedPassword = await bcrypt.hash(passwordTemp, 10);
                const fechaNacimiento = parsearFecha(titular.Fecha_Nacimiento);

                const nuevoUsuario = await client.query(`
                    INSERT INTO usuarios(nombre, apellido, email, password, rol_id, telefono, telefono_particular, fecha_nacimiento, activo)
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, true)
                    RETURNING id
                `, [
                    nombre,
                    apellido,
                    emailNormalizado,
                    hashedPassword,
                    rolSocioId,
                    titular.Telefono_Celular ? String(titular.Telefono_Celular).replace(/\D/g, '') : null,
                    titular.Telefono_Particular ? String(titular.Telefono_Particular).replace(/\D/g, '') : null,
                    fechaNacimiento
                ]);

                credencialesGeneradas.push({
                    numero_accion: String(numAccion),
                    nombre: nombreCompleto,
                    email: emailNormalizado,
                    contrasena: passwordTemp
                });

                await client.query(`
                    INSERT INTO socios(usuario_id, numero_accion, tipo_accion, estatus_accion, rol_en_accion, activo)
                    VALUES($1, $2, $3, $4, $5, true)
                `, [nuevoUsuario.rows[0].id, String(numAccion), titular.Tipo_Accion || null, titular.Estatus_Accion || null, 'Titular']);

                let familiaresInsertados = 0;
                for (const miembro of miembros) {
                    if (miembro.Rol === 'Titular') continue;
                    const nombreFamiliar = miembro.Nombre_Completo;
                    if (!nombreFamiliar) continue;
                    const fechaNacFamiliar = parsearFecha(miembro.Fecha_Nacimiento);
                    await client.query(`
                        INSERT INTO familiares(socio_id, nombre_completo, parentesco, fecha_nacimiento, activo)
                        SELECT s.id, $1, $2, $3, true FROM socios s WHERE s.usuario_id = $4
                    `, [nombreFamiliar, miembro.Parentesco || 'Familiar', fechaNacFamiliar, nuevoUsuario.rows[0].id]);
                    familiaresInsertados++;
                }

                await client.query('COMMIT');
                insertados++;
                detalle.push({ numAccion, exito: true, usuario_id: nuevoUsuario.rows[0].id, familiares: familiaresInsertados });

            } catch (err) {
                await client.query('ROLLBACK');
                errores++;
                detalle.push({ numAccion, error: err.message });
                console.error(`Error importando ${numAccion}:`, err.message);
            } finally {
                client.release();
            }
        }

        res.json({
            mensaje: 'Importacion completada',
            total_grupos: grupos.size,
            insertados,
            omitidos,
            errores,
            credenciales: credencialesGeneradas,
            detalle: detalle.slice(0, 100)
        });

    } catch (error) {
        console.error('Error en importacion:', error);
        res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
    }
});

/* ===== EXPORTAR SOCIOS EXCEL ===== */
app.get('/api/socios/exportar-excel', async (req, res) => {
    try {
        const resultado = await pool.query(`SELECT s.numero_accion, s.tipo_accion, s.estatus_accion, s.rol_en_accion, u.nombre, u.apellido, u.email, u.telefono, u.telefono_particular, u.fecha_nacimiento, u.fecha_registro, u.activo FROM socios s JOIN usuarios u ON s.usuario_id = u.id WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio') ORDER BY s.numero_accion`);
        const datos = resultado.rows.map(row => ({
            'Número de Acción': row.numero_accion || '',
            'Tipo de Acción': row.tipo_accion || '',
            'Estatus de Acción': row.estatus_accion || '',
            'Rol en Acción': row.rol_en_accion || '',
            'Nombre(s)': row.nombre || '',
            'Apellido(s)': row.apellido || '',
            'Email': row.email || '',
            'Teléfono Celular': row.telefono || '',
            'Teléfono Particular': row.telefono_particular || '',
            'Fecha de Nacimiento': row.fecha_nacimiento || '',
            'Fecha de Registro': row.fecha_registro || '',
            'Estatus': row.activo ? 'Activo' : 'Inactivo'
        }));
        const worksheet = XLSX.utils.json_to_sheet(datos);
        worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Socios');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=socios_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error al exportar socios:', error);
        res.status(500).json({ error: 'Error al exportar socios' });
    }
});

// ===== RECUPERAR CONTRASEÑA con PIN =====
function generarPin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/recuperar/solicitar', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "El correo es requerido" });
    
    try {
        const emailNormalizado = normalizarTexto(email);
        const usuario = await pool.query(`
            SELECT id, nombre, email FROM usuarios 
            WHERE email = $1 AND activo = true
        `, [emailNormalizado]);
        
        if (usuario.rows.length === 0) {
            return res.json({ mensaje: "Si el correo existe, recibirás un PIN en breve" });
        }
        
        const user = usuario.rows[0];
        const pin = generarPin(); 
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 15);
        
        await pool.query(`
            UPDATE usuarios 
            SET reset_pin = $1, reset_pin_expires = $2 
            WHERE id = $3
        `, [pin, expires, user.id]);
        
        // ===== ENVÍO DE CORREO CON RESEND =====
        const { data, error } = await resend.emails.send({
            from: 'sigad.com',   
            to: [user.email],
            subject: 'Código de recuperación - SIGAD',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: white; border-radius: 10px;">
                    <h2 style="color: #54cfe0;">Recuperación de contraseña</h2>
                    <p>Hola <strong>${user.nombre}</strong>,</p>
                    <p>Tu código de verificación es:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 12px; text-align: center;">${pin}</div>
                    <p>Este código expira en 15 minutos.</p>
                    <p>Si no solicitaste este cambio, ignora este mensaje.</p>
                    <hr style="border-color: #333;">
                    <p style="font-size: 12px; color: #888;">SIGAD - Sistema de Gestión Integral</p>
                </div>
            `
        });
        
        if (error) {
            console.error('Error al enviar correo con Resend:', error);
            return res.status(500).json({ error: "No se pudo enviar el código. Inténtalo más tarde." });
        }
        
        console.log(`PIN enviado a ${user.email}, ID de Resend: ${data.id}`);
        res.json({ mensaje: "Revisa tu correo (incluyendo spam). El PIN es válido por 15 minutos." });
        
    } catch (error) {
        console.error('Error en solicitar PIN:', error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.post('/api/recuperar/restablecer', async (req, res) => {
    const { email, pin, nueva_password } = req.body;
    if (!email || !pin || !nueva_password) {
        return res.status(400).json({ error: "Faltan datos (email, PIN o nueva contraseña)" });
    }
    if (nueva_password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    try {
        const emailNormalizado = normalizarTexto(email);
        const usuario = await pool.query(`
            SELECT id, reset_pin, reset_pin_expires FROM usuarios 
            WHERE email = $1 AND activo = true
        `, [emailNormalizado]);
        if (usuario.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        const user = usuario.rows[0];
        if (!user.reset_pin || user.reset_pin !== pin) {
            return res.status(400).json({ error: "PIN incorrecto" });
        }
        if (new Date() > user.reset_pin_expires) {
            return res.status(400).json({ error: "El PIN ha expirado. Solicita uno nuevo." });
        }
        const hashedPassword = await bcrypt.hash(nueva_password, 10);
        await pool.query(`
            UPDATE usuarios 
            SET password = $1, reset_pin = NULL, reset_pin_expires = NULL 
            WHERE id = $2
        `, [hashedPassword, user.id]);
        res.json({ mensaje: "Contraseña actualizada correctamente" });
    } catch (error) {
        console.error('Error al restablecer:', error);
        res.status(500).json({ error: "Error interno" });
    }
});

/* ===== FRONTEND STATIC ===== */
const frontendPath = path.join(__dirname, '../frontend');
console.log('Ruta frontend:', frontendPath);
const fs = require('fs');
if (fs.existsSync(frontendPath)) {
    console.log('Carpeta Frontend existe');
    console.log('Archivos:', fs.readdirSync(frontendPath));
} else {
    console.log('❌ Carpeta Frontend NO existe');
}
app.use(express.static(frontendPath, { index: false }));
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'main.html'));
});

setInterval(async () => {
    try {
        const result = await pool.query(`DELETE FROM sesiones WHERE expira_en < NOW() OR activo = false`);
        if (result.rowCount > 0) console.log(`Limpiadas ${result.rowCount} sesiones expiradas`);
    } catch (err) { console.error(err); }
}, 3600000);

/* ===== SERVER ===== */
app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});
