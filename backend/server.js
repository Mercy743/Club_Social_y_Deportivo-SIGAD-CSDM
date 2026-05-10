require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const XLSX   = require('xlsx');
const bcrypt = require('bcrypt');

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
        // Primero obtener el usuario (incluyendo password hasheado)
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email, u.password, r.nombre AS rol, u.telefono, u.activo
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.email = $1 AND u.activo = true
        `, [email]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        const usuario = resultado.rows[0];
        
        // Verificar contraseña con bcrypt
        const passwordValida = await bcrypt.compare(password, usuario.password);
        
        if (!passwordValida) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        // Si es socio, obtener su tipo_accion
        let tipo_accion = null;
        if (usuario.rol === 'socio') {
            const socio = await pool.query(`
                SELECT tipo_accion FROM socios 
                WHERE usuario_id = $1
            `, [usuario.id]);
            if (socio.rows.length > 0) {
                tipo_accion = socio.rows[0].tipo_accion;
            }
        }

        // Registrar en auditoría
        await pool.query(`
            INSERT INTO auditoria(usuario_id, accion, ip_origen)
            VALUES($1, $2, $3)
        `, [usuario.id, 'login', req.ip]);

        // No enviar el password al frontend
        const { password: _, ...usuarioSinPassword } = usuario;
        
        res.json({
            ...usuarioSinPassword,
            tipo_accion
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en servidor" });
    }
});

// Multer: guarda el Excel en memoria (no en disco)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // máx 100 MB
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (['xlsx', 'xls'].includes(ext)) cb(null, true);
        else cb(new Error('Solo se permiten archivos .xlsx o .xls'));
    }
});

/* ─── Helpers ─────────────────────────────────────────────────────── */
function generarPasswordTemporal(nombre, telefono) {
    const prefijo = (nombre || '').replace(/\s/g, '').substring(0, 4).toLowerCase();
    const sufijo  = String(telefono || '0000').slice(-4);
    return `${prefijo}${sufijo}`;
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

// =============================
// GET TORNEOS
// =============================
app.get('/api/torneos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        t.*, 
        a.nombre AS actividad_nombre, 
        u.nombre AS creador_nombre
      FROM torneos t
      LEFT JOIN actividades a ON t.actividad_id = a.id
      LEFT JOIN usuarios u ON t.creado_por = u.id
      ORDER BY t.fecha_inicio ASC
    `);

    res.json(r.rows);

  } catch (error) {
    res.status(500).json({ error: "Error al obtener torneos" });
  }
});

// =============================
// POST TORNEO
// =============================
app.post('/api/torneos', async (req, res) => {
  let { nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, creado_por } = req.body;

  nombre = nombre?.trim();
  descripcion = descripcion?.trim() || "";

  if (!nombre || !fecha_inicio || !fecha_fin || !actividad_id) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  if (new Date(fecha_fin) < new Date(fecha_inicio)) {
    return res.status(400).json({ error: "Fecha inválida" });
  }

  try {
    const usuarioId = creado_por || 1;

    const r = await pool.query(`
      INSERT INTO torneos(
        nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, estado, creado_por
      )
      VALUES($1,$2,$3,$4,$5,'programado',$6)
      RETURNING *
    `, [nombre, descripcion, fecha_inicio, fecha_fin, actividad_id, usuarioId]);

    res.status(201).json(r.rows[0]);

  } catch (error) {
    res.status(500).json({ error: "Error al crear torneo" });
  }
});


// =============================
// GET TORNEO POR ID
// =============================
app.get('/api/torneos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const r = await pool.query(`SELECT * FROM torneos WHERE id = $1`, [id]);

    if (r.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    res.json(r.rows[0]);

  } catch {
    res.status(500).json({ error: "Error" });
  }
});


// =============================
// PUT TORNEO
// =============================
app.put('/api/torneos/:id', async (req, res) => {

  const { id } = req.params;

  const {
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin,
    actividad_id,
    estado
  } = req.body;

  try {

    // =============================
    // SOLO CAMBIAR ESTADO
    // =============================
    if (estado) {

      const r = await pool.query(`

        UPDATE torneos
        SET estado = $1
        WHERE id = $2
        RETURNING *

      `, [
        estado,
        id
      ]);

      return res.json(r.rows[0]);
    }

    // =============================
    // VALIDAR EDICIÓN NORMAL
    // =============================
    if (
      !nombre ||
      !fecha_inicio ||
      !fecha_fin ||
      !actividad_id
    ) {

      return res.status(400).json({
        error: "Datos incompletos"
      });
    }

    if (
      new Date(fecha_fin) <
      new Date(fecha_inicio)
    ) {

      return res.status(400).json({
        error: "Fecha inválida"
      });
    }

    // =============================
    // EDITAR TORNEO
    // =============================
    const r = await pool.query(`

      UPDATE torneos

      SET
        nombre = $1,
        descripcion = $2,
        fecha_inicio = $3,
        fecha_fin = $4,
        actividad_id = $5

      WHERE id = $6

      RETURNING *

    `, [

      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      actividad_id,
      id

    ]);

    res.json(r.rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error al actualizar"
    });
  }
});


// =============================
// DELETE TORNEO (CON REGLA)
// =============================
app.delete('/api/torneos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const t = await pool.query(`SELECT estado FROM torneos WHERE id=$1`, [id]);

    if (t.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    if (t.rows[0].estado !== 'programado') {
      return res.status(400).json({ error: "Solo se puede eliminar si está programado" });
    }

    await pool.query(`DELETE FROM torneos WHERE id=$1`, [id]);

    res.json({ mensaje: "Eliminado" });

  } catch {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// =============================
// CAMBIAR ESTADO
// =============================
app.put('/api/torneos/:id/estado', async (req, res) => {

  const { id } = req.params;
  const { estado } = req.body;

  const estadosValidos = [

    "programado",
    "en curso",
    "finalizado",
    "cancelado"

  ];

  if (!estadosValidos.includes(estado)) {

    return res.status(400).json({
      error: "Estado inválido"
    });
  }

  try {

    const r = await pool.query(`

      UPDATE torneos
      SET estado = $1
      WHERE id = $2
      RETURNING *

    `, [
      estado,
      id
    ]);

    res.json(r.rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error"
    });
  }
});



/* ===== PARTICIPANTES ===== */

// =============================
// GET PARTICIPANTES
// =============================
app.get('/api/torneos/:id/participantes', async (req, res) => {

  const { id } = req.params;

  try {

    const r = await pool.query(`

      SELECT

        pt.*,

        u.nombre,
        u.apellido,
        u.email

      FROM participantes_torneo pt

      LEFT JOIN usuarios u
        ON pt.usuario_id = u.id

      WHERE pt.torneo_id = $1

      ORDER BY pt.id

    `, [id]);

    res.json(r.rows);

  } catch {

    res.status(500).json({
      error: "Error"
    });
  }
});


// =============================
// POST PARTICIPANTE
// =============================
app.post('/api/torneos/:id/participantes', async (req, res) => {
  const { id } = req.params;
  const { usuario_id, nombre_invitado, cuota_pagada } = req.body;

  try {
    if (!usuario_id && !nombre_invitado) {
      return res.status(400).json({ error: "Debe enviar usuario o invitado" });
    }

    if (usuario_id) {
      const existe = await pool.query(`
        SELECT id FROM participantes_torneo
        WHERE torneo_id=$1 AND usuario_id=$2
      `, [id, usuario_id]);

      if (existe.rows.length > 0) {
        return res.status(400).json({ error: "Ya registrado" });
      }
    }

    const r = await pool.query(`
      INSERT INTO participantes_torneo
      (torneo_id, usuario_id, nombre_invitado, cuota_pagada)
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `, [id, usuario_id || null, nombre_invitado || null, cuota_pagada || 0]);

    res.json(r.rows[0]);

  } catch {
    res.status(500).json({ error: "Error" });
  }
});


// =============================
// DELETE PARTICIPANTE
// =============================
app.delete('/api/torneos/:id/participantes/:pid', async (req, res) => {
  const { pid } = req.params;

  try {
    await pool.query(`DELETE FROM participantes_torneo WHERE id=$1`, [pid]);

    res.json({ mensaje: "Eliminado" });

  } catch {
    res.status(500).json({ error: "Error" });
  }
});


// =============================
// PUT RESULTADO
// =============================
app.put('/api/torneos/:id/participantes/:pid/resultado', async (req, res) => {
  const { pid } = req.params;
  const { resultado } = req.body;

  try {
    const r = await pool.query(`
      UPDATE participantes_torneo
      SET resultado=$1
      WHERE id=$2
      RETURNING *
    `, [resultado, pid]);

    res.json(r.rows[0]);

  } catch {
    res.status(500).json({ error: "Error" });
  }
});


// =========================================
// GENERAR BRACKET AUTOMATICO
// =========================================
app.post('/api/torneos/:id/generar-bracket', async (req, res) => {

  const { id } = req.params;

  try {

    // 🔹 obtener participantes
    const participantesResult = await pool.query(`
      SELECT *
      FROM participantes_torneo
      WHERE torneo_id = $1
      ORDER BY RANDOM()
    `, [id]);

    const participantes = participantesResult.rows;

    if (participantes.length < 2) {
      return res.status(400).json({
        error: 'Se necesitan al menos 2 participantes'
      });
    }

    // 🔹 validar pares
    if (participantes.length % 2 !== 0) {
      return res.status(400).json({
        error: 'El número de participantes debe ser par'
      });
    }

    // 🔹 detectar ronda
    let ronda = 'Primera ronda';

    if (participantes.length === 4) {
      ronda = 'Semifinal';
    }

    if (participantes.length === 8) {
      ronda = 'Cuartos';
    }

    if (participantes.length === 16) {
      ronda = 'Octavos';
    }

    const partidosGenerados = [];

    // 🔹 crear partidos
    for (let i = 0; i < participantes.length; i += 2) {

      const p1 = participantes[i];
      const p2 = participantes[i + 1];

      const partido = await pool.query(`
        INSERT INTO partidos (
          torneo_id,
          participante1_id,
          participante2_id,
          ronda,
          estado
        )
        VALUES ($1,$2,$3,$4,'pendiente')
        RETURNING *
      `, [
        id,
        p1.id,
        p2.id,
        ronda
      ]);

      partidosGenerados.push(partido.rows[0]);
    }

    res.json({
      mensaje: 'Bracket generado correctamente',
      ronda,
      partidos: partidosGenerados
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Error al generar bracket'
    });
  }
});

// =========================================
// OBTENER BRACKET
// =========================================
app.get('/api/torneos/:id/bracket', async (req, res) => {

  const { id } = req.params;

  try {

    const r = await pool.query(`

      SELECT

        p.*,

        COALESCE(
          u1.nombre,
          pt1.nombre_invitado,
          'Jugador 1'
        ) AS jugador1,

        COALESCE(
          u2.nombre,
          pt2.nombre_invitado,
          'Jugador 2'
        ) AS jugador2

      FROM partidos p

      LEFT JOIN participantes_torneo pt1
        ON p.participante1_id = pt1.id

      LEFT JOIN participantes_torneo pt2
        ON p.participante2_id = pt2.id

      LEFT JOIN usuarios u1
        ON pt1.usuario_id = u1.id

      LEFT JOIN usuarios u2
        ON pt2.usuario_id = u2.id

      WHERE p.torneo_id = $1

      ORDER BY p.id

    `, [id]);

    const partidos = r.rows;

    const bracket = {};

    partidos.forEach(p => {

      if (!bracket[p.ronda]) {

        bracket[p.ronda] = [];
      }

      bracket[p.ronda].push(p);
    });

    res.json(bracket);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Error al obtener bracket'
    });
  }
});

// =============================
// GET PARTIDOS DE UN TORNEO
// =============================
app.get('/api/torneos/:id/partidos', async (req, res) => {
  const { id } = req.params;

  try {

    const r = await pool.query(`
      SELECT *
      FROM partidos
      WHERE torneo_id = $1
      ORDER BY fecha, hora_inicio
    `, [id]);

    res.json(r.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al obtener partidos'
    });
  }
});

// =========================================
// GENERAR SIGUIENTE RONDA
// =========================================
app.post('/api/torneos/:id/siguiente-ronda', async (req, res) => {

  const { id } = req.params;

  try {

    // 🔹 obtener partidos finalizados
    const partidosResult = await pool.query(`
      SELECT *
      FROM partidos
      WHERE torneo_id = $1
      AND estado = 'finalizado'
      ORDER BY id
    `, [id]);

    const partidos = partidosResult.rows;

    if (partidos.length === 0) {
      return res.status(400).json({
        error: 'No hay partidos finalizados'
      });
    }

    // 🔹 obtener ganadores
    const ganadores = partidos
      .filter(p => p.ganador_id)
      .map(p => p.ganador_id);

    // =====================================
    // 🔥 CAMPEÓN + TOP 3
    // =====================================
    if (ganadores.length === 1) {

      const campeon = ganadores[0];

      // 🔹 obtener final
      const finalResult = await pool.query(`
        SELECT *
        FROM partidos
        WHERE torneo_id = $1
        AND ronda = 'Final'
        AND estado = 'finalizado'
        LIMIT 1
      `, [id]);

      let segundoLugar = null;

      if (finalResult.rows.length > 0) {

        const final = finalResult.rows[0];

        segundoLugar =
          final.participante1_id === campeon
            ? final.participante2_id
            : final.participante1_id;
      }

      // 🔹 semifinalistas perdedores
      const semifinales = await pool.query(`
        SELECT *
        FROM partidos
        WHERE torneo_id = $1
        AND ronda = 'Semifinal'
        AND estado = 'finalizado'
      `, [id]);

      let tercerLugar = null;

      if (semifinales.rows.length > 0) {

        const perdedores = semifinales.rows.map(s => {

          return s.participante1_id === s.ganador_id
            ? s.participante2_id
            : s.participante1_id;
        });

        tercerLugar = perdedores[0] || null;
      }

      // 🔹 guardar top 3
      await pool.query(`
        INSERT INTO resultados_torneo (
          torneo_id,
          primer_lugar,
          segundo_lugar,
          tercer_lugar
        )
        VALUES ($1,$2,$3,$4)
      `, [
        id,
        campeon,
        segundoLugar,
        tercerLugar
      ]);

      // 🔹 finalizar torneo
      await pool.query(`
        UPDATE torneos
        SET estado = 'finalizado'
        WHERE id = $1
      `, [id]);

      return res.json({
        mensaje: 'Torneo finalizado',
        campeon,
        segundoLugar,
        tercerLugar
      });
    }

    // 🔹 validar suficientes ganadores
    if (ganadores.length < 2) {
      return res.status(400).json({
        error: 'No hay suficientes ganadores'
      });
    }

    // 🔹 detectar nueva ronda
    let ronda = 'Nueva ronda';

    if (ganadores.length === 2) {
      ronda = 'Final';
    }

    if (ganadores.length === 4) {
      ronda = 'Semifinal';
    }

    if (ganadores.length === 8) {
      ronda = 'Cuartos';
    }

    const nuevosPartidos = [];

    // 🔹 crear nueva ronda
    for (let i = 0; i < ganadores.length; i += 2) {

      const partido = await pool.query(`
        INSERT INTO partidos (
          torneo_id,
          participante1_id,
          participante2_id,
          ronda,
          estado
        )
        VALUES ($1,$2,$3,$4,'pendiente')
        RETURNING *
      `, [
        id,
        ganadores[i],
        ganadores[i + 1],
        ronda
      ]);

      nuevosPartidos.push(partido.rows[0]);
    }

    res.json({
      mensaje: 'Siguiente ronda generada',
      ronda,
      partidos: nuevosPartidos
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Error al generar siguiente ronda'
    });
  }
});
// =========================================
// TOP 3 DEL TORNEO
// =========================================
app.get('/api/torneos/:id/top3', async (req, res) => {

  const { id } = req.params;

  try {

    const r = await pool.query(`

      SELECT

        rt.*,

        p1.nombre_invitado AS primer_nombre,
        p1.usuario_id AS primer_usuario,

        p2.nombre_invitado AS segundo_nombre,
        p2.usuario_id AS segundo_usuario,

        p3.nombre_invitado AS tercer_nombre,
        p3.usuario_id AS tercer_usuario

      FROM resultados_torneo rt

      LEFT JOIN participantes_torneo p1
        ON rt.primer_lugar = p1.id

      LEFT JOIN participantes_torneo p2
        ON rt.segundo_lugar = p2.id

      LEFT JOIN participantes_torneo p3
        ON rt.tercer_lugar = p3.id

      WHERE rt.torneo_id = $1

    `, [id]);

    if (r.rows.length === 0) {

      return res.status(404).json({
        error: 'Top 3 no disponible'
      });
    }

    res.json(r.rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Error al obtener top 3'
    });
  }
});


// =========================================
// TABLA DE POSICIONES
// =========================================
app.get('/api/torneos/:id/tabla', async (req, res) => {

  const { id } = req.params;

  try {

    // 🔹 obtener participantes
    const participantesResult = await pool.query(`
      SELECT *
      FROM participantes_torneo
      WHERE torneo_id = $1
    `, [id]);

    const participantes = participantesResult.rows;

    // 🔹 obtener partidos finalizados
    const partidosResult = await pool.query(`
      SELECT *
      FROM partidos
      WHERE torneo_id = $1
      AND estado = 'finalizado'
    `, [id]);

    const partidos = partidosResult.rows;

    // 🔹 tabla
    const tabla = {};

    // inicializar
    participantes.forEach(p => {

      tabla[p.id] = {
        participante_id: p.id,

        nombre:
          p.nombre_invitado ||
          `Usuario ${p.usuario_id}`,

        PJ: 0,
        PG: 0,
        PE: 0,
        PP: 0,

        GF: 0,
        GC: 0,

        PTS: 0
      };
    });

    // 🔹 procesar partidos
    partidos.forEach(partido => {

      const p1 = tabla[partido.participante1_id];
      const p2 = tabla[partido.participante2_id];

      if (!p1 || !p2) return;

      // PJ
      p1.PJ++;
      p2.PJ++;

      // goles
      p1.GF += partido.marcador1;
      p1.GC += partido.marcador2;

      p2.GF += partido.marcador2;
      p2.GC += partido.marcador1;

      // ganador
      if (partido.marcador1 > partido.marcador2) {

        p1.PG++;
        p2.PP++;

        p1.PTS += 3;

      } else if (partido.marcador2 > partido.marcador1) {

        p2.PG++;
        p1.PP++;

        p2.PTS += 3;

      } else {

        // empate
        p1.PE++;
        p2.PE++;

        p1.PTS += 1;
        p2.PTS += 1;
      }
    });

    // 🔹 ordenar
    const resultado = Object.values(tabla).sort((a, b) => {

      // puntos
      if (b.PTS !== a.PTS) {
        return b.PTS - a.PTS;
      }

      // diferencia goles
      const diffA = a.GF - a.GC;
      const diffB = b.GF - b.GC;

      return diffB - diffA;
    });

    res.json(resultado);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Error al generar tabla'
    });
  }
});


/* =========================================
   PARTIDOS
========================================= */


// =============================
// GET PARTIDO POR ID
// =============================
app.get('/api/partidos/:id', async (req, res) => {
  const { id } = req.params;

  try {

    const r = await pool.query(`
      SELECT *
      FROM partidos
      WHERE id = $1
    `, [id]);

    if (r.rows.length === 0) {
      return res.status(404).json({
        error: 'Partido no encontrado'
      });
    }

    res.json(r.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al obtener partido'
    });
  }
});


// =============================
// CREAR PARTIDO
// =============================
app.post('/api/torneos/:id/partidos', async (req, res) => {
  const { id } = req.params;

  const {
    participante1_id,
    participante2_id,
    ronda,
    espacio_id,
    fecha,
    hora_inicio,
    hora_fin
  } = req.body;

  try {

    const r = await pool.query(`
      INSERT INTO partidos (
        torneo_id,
        participante1_id,
        participante2_id,
        ronda,
        espacio_id,
        fecha,
        hora_inicio,
        hora_fin
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      id,
      participante1_id,
      participante2_id,
      ronda,
      espacio_id,
      fecha,
      hora_inicio,
      hora_fin
    ]);

    res.status(201).json(r.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al crear partido'
    });
  }
});


// =============================
// ACTUALIZAR PARTIDO
// =============================
app.put('/api/partidos/:id', async (req, res) => {
  const { id } = req.params;

  const {
    participante1_id,
    participante2_id,
    ronda,
    espacio_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado
  } = req.body;

  try {

    const r = await pool.query(`
      UPDATE partidos
      SET
        participante1_id = $1,
        participante2_id = $2,
        ronda = $3,
        espacio_id = $4,
        fecha = $5,
        hora_inicio = $6,
        hora_fin = $7,
        estado = $8
      WHERE id = $9
      RETURNING *
    `, [
      participante1_id,
      participante2_id,
      ronda,
      espacio_id,
      fecha,
      hora_inicio,
      hora_fin,
      estado,
      id
    ]);

    if (r.rows.length === 0) {
      return res.status(404).json({
        error: 'Partido no encontrado'
      });
    }

    res.json(r.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al actualizar partido'
    });
  }
});


// =============================
// ELIMINAR PARTIDO
// =============================
app.delete('/api/partidos/:id', async (req, res) => {
  const { id } = req.params;

  try {

    const r = await pool.query(`
      DELETE FROM partidos
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (r.rows.length === 0) {
      return res.status(404).json({
        error: 'Partido no encontrado'
      });
    }

    res.json({
      mensaje: 'Partido eliminado'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al eliminar partido'
    });
  }
});


// =============================
// REGISTRAR RESULTADO
// =============================
app.put('/api/partidos/:id/resultado', async (req, res) => {
  const { id } = req.params;

  const {
    marcador1,
    marcador2,
    ganador_id
  } = req.body;

  try {

    const r = await pool.query(`
      UPDATE partidos
      SET
        marcador1 = $1,
        marcador2 = $2,
        ganador_id = $3,
        estado = 'finalizado'
      WHERE id = $4
      RETURNING *
    `, [
      marcador1,
      marcador2,
      ganador_id,
      id
    ]);

    if (r.rows.length === 0) {
      return res.status(404).json({
        error: 'Partido no encontrado'
      });
    }

    res.json(r.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Error al registrar resultado'
    });
  }
});



/* ===== EVENTOS ===== */
app.post('/api/eventos', async (req, res) => {
    const { nombre, descripcion, fecha_evento, hora, creado_por } = req.body;

    try {
        await pool.query(
            'INSERT INTO eventos(nombre, descripcion, fecha_evento, hora, creado_por) VALUES($1, $2, $3, $4, $5)',
            [nombre, descripcion, fecha_evento, hora, creado_por]
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

app.put('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, fecha_evento, hora } = req.body;

    try {
        await pool.query(
            `UPDATE eventos 
             SET nombre=$1, descripcion=$2, fecha_evento=$3 
             WHERE id_evento=$4`,
            [nombre, descripcion, fecha_evento, hora, id]
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

/* ===== HORARIOS ===== */

// Obtener todos los horarios
app.get('/api/horarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT h.*, 
                   e.nombre as espacio_nombre,
                   a.nombre as actividad_nombre,
                   u.nombre as instructor_nombre
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

// Crear horario
app.post('/api/horarios', async (req, res) => {
    const { espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia } = req.body;

    try {
        // Validar que no haya horarios superpuestos
        const conflicto = await pool.query(`
            SELECT * FROM horarios
            WHERE espacio_id = $1
            AND dia_semana = $2
            AND activo = true
            AND (
                (hora_inicio BETWEEN $3 AND $4) OR
                (hora_fin BETWEEN $3 AND $4) OR
                ($3 BETWEEN hora_inicio AND hora_fin)
            )
        `, [espacio_id, dia_semana, hora_inicio, hora_fin]);

        if (conflicto.rows.length > 0) {
            return res.status(409).json({ error: "Ya existe un horario en ese espacio y horario" });
        }

        const resultado = await pool.query(`
            INSERT INTO horarios(espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, activo)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING *
        `, [espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear horario" });
    }
});

// Actualizar horario
app.put('/api/horarios/:id', async (req, res) => {
    const { id } = req.params;
    const { espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia } = req.body;

    try {
        await pool.query(`
            UPDATE horarios
            SET espacio_id = $1, actividad_id = $2, instructor_id = $3,
                dia_semana = $4, hora_inicio = $5, hora_fin = $6,
                fecha_inicio_vigencia = $7, fecha_fin_vigencia = $8
            WHERE id = $9
        `, [espacio_id, actividad_id, instructor_id, dia_semana, hora_inicio, hora_fin, fecha_inicio_vigencia, fecha_fin_vigencia, id]);

        res.json({ mensaje: "Horario actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al actualizar horario" });
    }
});

// Activar/desactivar horario
app.patch('/api/horarios/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;

    try {
        await pool.query(`UPDATE horarios SET activo = $1 WHERE id = $2`, [activo, id]);
        res.json({ mensaje: "Estado actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al actualizar estado" });
    }
});

// Eliminar horario
app.delete('/api/horarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM horarios WHERE id = $1', [id]);
        res.json({ mensaje: "Horario eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar horario" });
    }
});

/* ===== ESTADISTICAS PARA DASHBOARD ===== */
app.get('/api/estadisticas', async (req, res) => {
    try {
        // Estadisticas basicas
        const eventos = await pool.query('SELECT COUNT(*) FROM eventos');
        const usuarios = await pool.query('SELECT COUNT(*) FROM usuarios WHERE activo = true');
        const socios = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'socio') AND activo = true");
        const instructores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'instructor') AND activo = true");
        const reservacionesHoy = await pool.query("SELECT COUNT(*) FROM reservaciones WHERE fecha_reserva = CURRENT_DATE");
        const ludotecaActivos = await pool.query("SELECT COUNT(*) FROM registro_ludoteca WHERE estatus = 'activo' AND fecha = CURRENT_DATE");
        const invitadosHoy = await pool.query("SELECT COUNT(*) FROM invitados WHERE fecha_visita = CURRENT_DATE");
        
        // Socios por tipo de accion
        const sociosPorTipo = await pool.query(`
            SELECT s.tipo_accion, COUNT(*) as total
            FROM socios s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE u.activo = true
            GROUP BY s.tipo_accion
        `);
        
        // Socios por estatus de accion
        const sociosPorEstatus = await pool.query(`
            SELECT s.estatus_accion, COUNT(*) as total
            FROM socios s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE u.activo = true AND s.estatus_accion IS NOT NULL
            GROUP BY s.estatus_accion
        `);
        
        // Actividades mas populares
        const actividadesPopulares = await pool.query(`
            SELECT a.nombre, COUNT(i.id) as inscritos
            FROM actividades a
            LEFT JOIN inscripciones i ON a.id = i.actividad_id AND i.estado = 'activa'
            GROUP BY a.id
            ORDER BY inscritos DESC
            LIMIT 5
        `);
        
        // Ingresos mensuales
        const ingresosMensuales = await pool.query(`
            SELECT 
                TO_CHAR(fecha, 'YYYY-MM') as mes,
                SUM(monto) as total
            FROM pagos
            WHERE fecha >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY TO_CHAR(fecha, 'YYYY-MM')
            ORDER BY mes ASC
        `);

        // Ingresos totales
        const ingresosTotales = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) as total FROM pagos
        `);

        // Datos basicos para el dashboard (formato plano)
        const basicsPlano = {
            eventos: parseInt(eventos.rows[0].count),
            usuarios: parseInt(usuarios.rows[0].count),
            socios: parseInt(socios.rows[0].count),
            instructores: parseInt(instructores.rows[0].count),
            reservacionesHoy: parseInt(reservacionesHoy.rows[0].count),
            ludotecaActivos: parseInt(ludotecaActivos.rows[0].count),
            invitadosHoy: parseInt(invitadosHoy.rows[0].count),
            ingresosTotales: parseFloat(ingresosTotales.rows[0].total)
        };

        // Respuesta completa (compatible con dashboard y estadisticas)
        res.json({
            ...basicsPlano,  // Para compatibilidad con dashboard.js
            basics: basicsPlano,  // Para estadisticas.js
            sociosPorTipo: sociosPorTipo.rows,
            sociosPorEstatus: sociosPorEstatus.rows,
            actividadesPopulares: actividadesPopulares.rows,
            ingresosMensuales: ingresosMensuales.rows
        });
        
    } catch (error) {
        console.error('Error en estadisticas:', error);
        res.status(500).json({ error: "Error al obtener estadisticas" });
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
            // Buscar por ID de usuario
            query = `
                SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.telefono_particular, u.fecha_nacimiento,
                       s.numero_accion, s.tipo_accion, s.estatus_accion
                FROM usuarios u
                JOIN socios s ON u.id = s.usuario_id
                WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
                AND (u.id = $1 OR s.numero_accion = $2)
                ORDER BY u.nombre
                LIMIT 20
            `;
            params = [parseInt(q), String(q)];
        } else {
            // Buscar por email o nombre
            query = `
                SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.telefono_particular, u.fecha_nacimiento,
                       s.numero_accion, s.tipo_accion, s.estatus_accion
                FROM usuarios u
                JOIN socios s ON u.id = s.usuario_id
                WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
                AND (u.email ILIKE $1 OR u.nombre ILIKE $1 OR u.apellido ILIKE $1)
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

/* ===== USUARIOS EXCEPTO ADMIN CON PAGINACIÓN ===== */
app.get('/api/usuarios/except/:admin_id', async (req, res) => {
    const { admin_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    try {
        // Obtener total de registros
        const totalResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            LEFT JOIN socios s ON u.id = s.usuario_id
            WHERE u.id != $1
        `, [admin_id]);
        
        const total = parseInt(totalResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        // Obtener usuarios paginados
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.telefono_particular,
                   u.fecha_nacimiento, u.activo, u.fecha_registro,
                   r.nombre AS rol, u.rol_id,
                   s.numero_accion, s.tipo_accion, s.estatus_accion
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            LEFT JOIN socios s ON u.id = s.usuario_id
            WHERE u.id != $1
            ORDER BY u.id
            LIMIT $2 OFFSET $3
        `, [admin_id, limit, offset]);
        
        res.json({
            usuarios: resultado.rows,
            paginacion: {
                currentPage: page,
                totalPages: totalPages,
                totalRegistros: total,
                limit: limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
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
const frontendPath = path.join(__dirname, '../Frontend');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'main.html'));
});


/* =====================================================================
   DEPENDENCIAS (instalar una sola vez):
     npm install multer xlsx
/* ─── POST /api/socios/importar ──────────────────────────────────── */
 /*
 * Endpoint que recibe un archivo Excel y carga todos los socios a la BD.
 * Solo accesible para administradores.
 */
/* ===================================================================== */
app.post('/api/socios/importar-excel', upload.single('archivo'), async (req, res) => {
    // Validacion de admin
    const { admin_id } = req.body;
    
    if (!admin_id) {
        return res.status(401).json({ error: "Se requiere identificacion de administrador" });
    }
    
    const adminCheck = await pool.query(`
        SELECT r.nombre FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.id = $1 AND u.activo = true
    `, [admin_id]);
    
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].nombre !== 'admin') {
        return res.status(403).json({ error: "No autorizado. Solo administradores pueden importar socios." });
    }
    
    if (!req.file) {
        return res.status(400).json({ error: 'No se recibio ningun archivo' });
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = workbook.Sheets[workbook.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: null });

        if (filas.length === 0) {
            return res.status(400).json({ error: 'El archivo esta vacio' });
        }

        const columnasRequeridas = ['Numero_Accion', 'Nombre_Completo', 'Email'];
        const columnasFaltantes = columnasRequeridas.filter(c => !filas[0].hasOwnProperty(c));
        
        if (columnasFaltantes.length > 0) {
            return res.status(400).json({ 
                error: `Faltan columnas: ${columnasFaltantes.join(', ')}` 
            });
        }

        const rolSocio = await pool.query("SELECT id FROM roles WHERE nombre = 'socio'");
        if (rolSocio.rows.length === 0) {
            return res.status(500).json({ error: "No existe el rol 'socio'" });
        }
        const rolSocioId = rolSocio.rows[0].id;

        // Agrupar por Numero_Accion
        const grupos = new Map();
        for (const fila of filas) {
            const numAccion = fila.Numero_Accion;
            if (!numAccion) continue;
            if (!grupos.has(numAccion)) {
                grupos.set(numAccion, []);
            }
            grupos.get(numAccion).push(fila);
        }

        let insertados = 0, omitidos = 0, errores = 0;
        const detalle = [];
        const credencialesGeneradas = [];

        // Procesar cada grupo
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

                const existe = await client.query(
                    `SELECT u.id FROM usuarios u 
                     JOIN socios s ON u.id = s.usuario_id 
                     WHERE u.email = $1 OR s.numero_accion = $2`,
                    [titular.Email?.toLowerCase(), String(numAccion)]
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
                    INSERT INTO usuarios(
                        nombre, apellido, email, password, rol_id, 
                        telefono, telefono_particular, fecha_nacimiento, activo
                    )
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, true)
                    RETURNING id
                `, [
                    nombre,
                    apellido,
                    titular.Email?.toLowerCase(),
                    hashedPassword,
                    rolSocioId,
                    titular.Telefono_Celular ? String(titular.Telefono_Celular) : null,
                    titular.Telefono_Particular ? String(titular.Telefono_Particular) : null,
                    fechaNacimiento
                ]);

                credencialesGeneradas.push({
                    numero_accion: String(numAccion),
                    nombre: nombreCompleto,
                    email: titular.Email?.toLowerCase(),
                    contrasena: passwordTemp
                });

                await client.query(`
                    INSERT INTO socios(
                        usuario_id, numero_accion, tipo_accion, 
                        estatus_accion, rol_en_accion, activo
                    )
                    VALUES($1, $2, $3, $4, $5, true)
                `, [
                    nuevoUsuario.rows[0].id,
                    String(numAccion),
                    titular.Tipo_Accion || null,
                    titular.Estatus_Accion || null,
                    'Titular'
                ]);

                let familiaresInsertados = 0;
                for (const miembro of miembros) {
                    if (miembro.Rol === 'Titular') continue;
                    
                    const nombreFamiliar = miembro.Nombre_Completo;
                    if (!nombreFamiliar) continue;
                    
                    const fechaNacFamiliar = parsearFecha(miembro.Fecha_Nacimiento);
                    
                    await client.query(`
                        INSERT INTO familiares(socio_id, nombre_completo, parentesco, fecha_nacimiento, activo)
                        SELECT s.id, $1, $2, $3, true
                        FROM socios s
                        WHERE s.usuario_id = $4
                    `, [
                        nombreFamiliar,
                        miembro.Parentesco || 'Familiar',
                        fechaNacFamiliar,
                        nuevoUsuario.rows[0].id
                    ]);
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

/* ===== EXPORTAR SOCIOS A EXCEL ===== */
app.get('/api/socios/exportar-excel', async (req, res) => {
    try {
        // Obtener todos los socios con sus datos
        const resultado = await pool.query(`
            SELECT 
                s.numero_accion,
                s.tipo_accion,
                s.estatus_accion,
                s.rol_en_accion,
                u.nombre,
                u.apellido,
                u.email,
                u.telefono,
                u.telefono_particular,
                u.fecha_nacimiento,
                u.fecha_registro,
                u.activo
            FROM socios s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'socio')
            ORDER BY s.numero_accion
        `);

        // Preparar datos para Excel
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

        // Crear hoja de Excel
        const worksheet = XLSX.utils.json_to_sheet(datos);
        
        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Socios');

        // Generar archivo
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // Configurar respuesta
        res.setHeader('Content-Disposition', 'attachment; filename=socios_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error al exportar socios:', error);
        res.status(500).json({ error: 'Error al exportar socios' });
    }
});

/* ===== SERVER ===== */
app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
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
  const { nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id } = req.body;
  if (!nombre || !capacidad) return res.status(400).json({ error: "Datos incompletos" });
  try {
    const r = await pool.query(
      `INSERT INTO actividades(nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id) 
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nombre, descripcion || '', capacidad, icono, nivel, duracion, equipo, tipo_actividad_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear" });
  }
});

app.put("/api/actividades/:id", async (req, res) => {
  const { nombre, descripcion, capacidad, icono, nivel, duracion, equipo, tipo_actividad_id } = req.body;
  try {
    const r = await pool.query(
      `UPDATE actividades SET nombre=$1, descripcion=$2, capacidad=$3, icono=$4, nivel=$5, duracion=$6, equipo=$7, tipo_actividad_id=$8 WHERE id=$9 RETURNING *`,
      [nombre, descripcion || '', capacidad, icono, nivel, duracion, equipo, tipo_actividad_id || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

app.delete("/api/actividades/:id", async (req, res) => {
  try {
    const check = await pool.query("SELECT * FROM inscripciones WHERE actividad_id=$1 AND estado='activa'", [req.params.id]);
    if (check.rows.length > 0) return res.status(400).json({ error: "Tiene inscripciones activas" });
    const r = await pool.query("DELETE FROM actividades WHERE id=$1 RETURNING *", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json({ mensaje: "Actividad eliminada" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// ===== INSTRUCTOR: Asignarse a una actividad =====
app.post('/api/actividades/:id/asignar-instructor', async (req, res) => {
    const { id } = req.params;
    const { instructor_id } = req.body;
    
    try {
        const usuario = await pool.query(
            `SELECT u.id, r.nombre as rol 
             FROM usuarios u
             JOIN roles r ON u.rol_id = r.id
             WHERE u.id = $1 AND r.nombre = 'instructor' AND u.activo = true`,
            [instructor_id]
        );
        
        if (usuario.rows.length === 0) {
            return res.status(403).json({ error: "No eres instructor o no existe" });
        }
        
        const actividad = await pool.query(
            "SELECT id FROM actividades WHERE id = $1",
            [id]
        );
        
        if (actividad.rows.length === 0) {
            return res.status(404).json({ error: "Actividad no encontrada" });
        }
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS actividad_instructores (
                id SERIAL PRIMARY KEY,
                actividad_id INTEGER REFERENCES actividades(id) ON DELETE CASCADE,
                instructor_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                fecha_asignacion DATE DEFAULT CURRENT_DATE,
                activo BOOLEAN DEFAULT true,
                UNIQUE(actividad_id, instructor_id)
            )
        `);
        
        const existe = await pool.query(
            `SELECT id FROM actividad_instructores 
             WHERE actividad_id = $1 AND instructor_id = $2 AND activo = true`,
            [id, instructor_id]
        );
        
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Ya estás asignado a esta actividad" });
        }
        
        await pool.query(
            `INSERT INTO actividad_instructores (actividad_id, instructor_id, fecha_asignacion, activo)
             VALUES ($1, $2, CURRENT_DATE, true)`,
            [id, instructor_id]
        );
        
        res.json({ mensaje: "Te has asignado como instructor de esta actividad" });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al asignar instructor" });
    }
});

// ===== Obtener instructores de una actividad =====
app.get('/api/actividades/:id/instructores', async (req, res) => {
    const { id } = req.params;
    
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, u.email
            FROM actividad_instructores ai
            JOIN usuarios u ON ai.instructor_id = u.id
            WHERE ai.actividad_id = $1 AND ai.activo = true
        `, [id]);
        
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener instructores" });
    }
});

// ===== SOCIO: Inscribirse a una actividad =====
app.post('/api/actividades/:id/inscribirse', async (req, res) => {
    const { id } = req.params;
    const { socio_id } = req.body;
    
    try {
        const usuario = await pool.query(
            `SELECT u.id, r.nombre as rol 
             FROM usuarios u
             JOIN roles r ON u.rol_id = r.id
             WHERE u.id = $1 AND r.nombre = 'socio' AND u.activo = true`,
            [socio_id]
        );
        
        if (usuario.rows.length === 0) {
            return res.status(403).json({ error: "No eres socio o no existe" });
        }
        
        const actividad = await pool.query(
            `SELECT a.capacidad, a.nombre,
                    (SELECT COUNT(*) FROM inscripciones 
                     WHERE actividad_id = a.id AND estado = 'activa') as inscritos
             FROM actividades a
             WHERE a.id = $1`,
            [id]
        );
        
        if (actividad.rows.length === 0) {
            return res.status(404).json({ error: "Actividad no encontrada" });
        }
        
        const inscritos = parseInt(actividad.rows[0].inscritos) || 0;
        const capacidad = actividad.rows[0].capacidad;
        
        if (inscritos >= capacidad) {
            return res.status(400).json({ error: "No hay cupo disponible" });
        }
        
        const existe = await pool.query(
            `SELECT id FROM inscripciones 
             WHERE actividad_id = $1 AND socio_id = $2 AND estado = 'activa'`,
            [id, socio_id]
        );
        
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Ya estás inscrito en esta actividad" });
        }
        
        await pool.query(
            `INSERT INTO inscripciones (actividad_id, socio_id, fecha_inscripcion, estado)
             VALUES ($1, $2, CURRENT_DATE, 'activa')`,
            [id, socio_id]
        );
        
        res.json({ mensaje: "Te has inscrito exitosamente a la actividad" });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al inscribirse" });
    }
});

// ===== SOCIO: Verificar si está inscrito =====
app.get('/api/actividades/:id/inscrito/:socio_id', async (req, res) => {
    const { id, socio_id } = req.params;
    
    try {
        const resultado = await pool.query(`
            SELECT * FROM inscripciones 
            WHERE actividad_id = $1 AND socio_id = $2 AND estado = 'activa'
        `, [id, socio_id]);
        
        res.json({ inscrito: resultado.rows.length > 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al verificar inscripción" });
    }
});

/* ===== PAGOS ===== */
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
