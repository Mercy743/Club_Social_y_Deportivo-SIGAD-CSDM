require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); 

const app = express();
const puerto = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log('🟢 Conectado a PostgreSQL'))
    .catch(err => console.error('🔴 Error conexión BD', err.stack));

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const consulta = `
            SELECT u.id, u.nombre, u.email, r.nombre AS rol
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.email = $1 AND u.password = $2
        `;

        const resultado = await pool.query(consulta, [email, password]);

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        res.json(resultado.rows[0]);

    } catch (error) {
        res.status(500).json({ error: "Error en servidor" });
    }
});

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
        const resultado = await pool.query(
            'UPDATE usuarios SET rol_id = $1 WHERE id = $2 RETURNING *',
            [rol_id, usuario_id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            mensaje: 'Rol actualizado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.listen(puerto, () => {
    console.log(`http://localhost:${puerto}`);
});