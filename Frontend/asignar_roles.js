// LOGICA PARA BUSCAR EL ROL ACTUAL 
document.getElementById('btn-buscar').addEventListener('click', function() {
    const usuario_id = document.getElementById('usuario_id').value;
    const infoDiv = document.getElementById('info-actual');

    // Validacion rápida antes de molestar al servidor
    if (!usuario_id || usuario_id <= 0) {
        infoDiv.innerHTML = `<span style="color: red;">❌ Ingresa un ID valido para buscar</span>`;
        return;
    }

    infoDiv.innerHTML = "🔍 Buscando datos en el servidor...";

    // Llamamos a nuestra nueva ruta GET del Backend
    fetch(`http://localhost:3000/api/usuario/${usuario_id}`)
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => { throw new Error(err.error) });
            }
            return res.json();
        })
        .then(data => {
            // Mostramos el nombre y el rol actual
            infoDiv.innerHTML = `👤 <b>Usuario:</b> ${data.nombre} | 🔑 <b>Rol actual:</b> ${data.rol_nombre}`;
        })
        .catch(err => {
            // Si el usuario no existe o el servidor está apagado
            infoDiv.innerHTML = `<span style="color: red;">❌ ${err.message}</span>`;
            console.error("Error al buscar:", err);
        });
});

// --- 2. LOGICA PARA ACTUALIZAR EL ROL 
document.getElementById('form-roles').addEventListener('submit', function(event) {
    event.preventDefault(); // Evita que la pagina se recargue

    const usuario_id = document.getElementById('usuario_id').value;
    const rol_id = document.getElementById('rol_id').value;
    const mensajeDiv = document.getElementById('mensaje');

    // Validacion de seguridad
    if (!usuario_id || usuario_id <= 0) {
        mensajeDiv.style.color = "red";
        mensajeDiv.innerHTML = "❌ Error: ID de usuario no válido.";
        return;
    }

    // Preparamos los datos en formato JSON
    const datosParaEnviar = {
        usuario_id: parseInt(usuario_id),
        rol_id: parseInt(rol_id)
    };

    mensajeDiv.style.color = "blue";
    mensajeDiv.innerHTML = "⏳ Enviando actualizacion...";

    // Llamamos a nuestra ruta PUT del Backend
    fetch('http://localhost:3000/api/actualizar-rol', {
        method: 'PUT', 
        headers: {
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(datosParaEnviar) 
    })
    .then(respuesta => {
        if (!respuesta.ok) {
            return respuesta.json().then(err => { throw new Error(err.error) });
        }
        return respuesta.json();
    })
    .then(datos => {
        // Mensaje de exito real
        mensajeDiv.style.color = "green";
        mensajeDiv.innerHTML = `✅ ¡Exito! El Usuario ${datosParaEnviar.usuario_id} fue actualizado correctamente.`;
        
        // Limpiamos
        document.getElementById('info-actual').innerHTML = ""; 
        console.log("Respuesta del servidor:", datos);
    })
    .catch(error => {
        // Atrapamos errores de servidor apagado o fallos de base de datos
        mensajeDiv.style.color = "red";
        mensajeDiv.innerHTML = `❌ Error: ${error.message}`;
        console.error('Error detectado:', error);
    });
});