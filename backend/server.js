require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
<<<<<<< HEAD
const { Pool } = require('pg'); 
=======
const { Pool } = require('pg');
>>>>>>> 4a9b4fe95414b16c37e0318fc0c65c9d40b723b3
const path = require('path');

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

<<<<<<< HEAD
app.use(express.static(path.join(__dirname, '../Frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

=======
/* ===== CONEXION BD ===== */
>>>>>>> 4a9b4fe95414b16c37e0318fc0c65c9d40b723b3
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
            SELECT u.id, u.nombre, u.email, r.nombre AS rol
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.email = $1 AND u.password = $2
        `, [email, password]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        res.json(resultado.rows[0]);

    } catch (error) {
        res.status(500).json({ error: "Error en servidor" });
    }
});

/* ===== USUARIOS ===== */
app.get('/api/usuarios', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT u.id, u.nombre, r.nombre AS rol, u.rol_id
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
        `);

        res.json(resultado.rows);

    } catch (error) {
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

app.put('/api/actualizar-rol', async (req, res) => {
    const { usuario_id, rol_id } = req.body;

    try {
        await pool.query(
            'UPDATE usuarios SET rol_id = $1 WHERE id = $2',
            [rol_id, usuario_id]
        );

        res.json({ mensaje: 'Rol actualizado' });

    } catch (error) {
        res.status(500).json({ error: 'Error' });
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
        res.status(500).json({ error: "Error" });
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
        res.status(500).json({ error: "Error" });
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
        res.status(500).json({ error: "Error" });
    }
});

app.delete('/api/eventos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM eventos WHERE id_evento = $1', [id]);
        res.json({ mensaje: "Evento eliminado" });
    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

/* ===== ESTADISTICAS ===== */
app.get('/api/estadisticas', async (req, res) => {
    try {
        const eventos = await pool.query('SELECT COUNT(*) FROM eventos');
        const usuarios = await pool.query('SELECT COUNT(*) FROM usuarios');

        res.json({
            eventos: eventos.rows[0].count,
            usuarios: usuarios.rows[0].count
        });

    } catch (error) {
        res.status(500).json({ error: "Error" });
    }
});

<<<<<<< HEAD
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

=======
/* ===== FRONTEND (SOLUCION DEFINITIVA) ===== */
const frontendPath = path.join(__dirname, '../frontend');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ===== SERVER ===== */
>>>>>>> 4a9b4fe95414b16c37e0318fc0c65c9d40b723b3
app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});