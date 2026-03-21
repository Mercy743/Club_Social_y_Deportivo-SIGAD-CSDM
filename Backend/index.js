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
    .then(() => console.log('🟢 Conectado exitosamente a la base de datos PostgreSQL'))
    .catch(err => console.error('🔴 Error de conexión a la base de datos', err.stack));
// Ruta para obtener los datos de un usuario específico
app.get('/api/usuario/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const consultaSQL = `
            SELECT u.nombre, r.nombre AS rol_nombre 
            FROM usuarios u 
            JOIN roles r ON u.rol_id = r.id 
            WHERE u.id = $1`;
        const resultado = await pool.query(consultaSQL, [id]);

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

app.put('/api/actualizar-rol', async (req, res) => {
    const { usuario_id, rol_id } = req.body;

    try {
        const comandoSQL = 'UPDATE usuarios SET rol_id = $1 WHERE id = $2 RETURNING *';
        const valores = [rol_id, usuario_id];
        
        const resultado = await pool.query(comandoSQL, valores);

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado en la base de datos' });
        }

        res.status(200).json({
            mensaje: 'Rol actualizado correctamente',
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(puerto, () => {
    console.log(`🚀 Servidor Backend corriendo en http://localhost:${puerto}`);
});