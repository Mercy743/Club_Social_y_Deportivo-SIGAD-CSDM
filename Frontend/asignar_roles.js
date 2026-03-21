// Esperamos a que el administrador envie el formulario
document.getElementById('form-roles').addEventListener('submit', function(event) {
    event.preventDefault(); // Evita que la pagina se recargue 

    // Capturamos los datos usando los nombres de la base de datos 
    const usuario_id = document.getElementById('usuario_id').value;
    const rol_id = document.getElementById('rol_id').value;

    const mensajeDiv = document.getElementById('mensaje');

    // Validacion 
    if (!usuario_id || usuario_id <= 0) {
        mensajeDiv.style.color = "red";
        mensajeDiv.innerHTML = "❌ Error: Ingrese un ID de usuario valido.";
        return;
    }

    // Preparamos el objeto JSON
    const datosParaEnviar = {
        usuario_id: parseInt(usuario_id),
        rol_id: parseInt(rol_id)
    };

    // Mostramos feedback de carga mientras el fetch hace su trabajo
    mensajeDiv.style.color = "blue";
    mensajeDiv.innerHTML = "⏳ Enviando solicitud al servidor...";
    console.log("Enviando JSON al backend:", datosParaEnviar);

    
    // (ejemplo: puerto 3000)

    fetch('http://localhost:3000/api/actualizar-rol', {
        method: 'PUT', 
        headers: {
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(datosParaEnviar) 
    })
    .then(respuesta => {
        
        if (!respuesta.ok) {
            // Si el servidor nos mando un error 
            return respuesta.json().then(err => { throw new Error(err.error) });
        }
        // Si todo salio bien, leemos los datos
        return respuesta.json();
    })
    .then(datos => {
        // Solo entramos aqui si la actualizacion fue  real en la base de datos
        mensajeDiv.style.color = "green";
        mensajeDiv.innerHTML = `✅ ¡Exito! El Usuario ${datosParaEnviar.usuario_id} fue actualizado al Rol ${datosParaEnviar.rol_id} en la base de datos.`;
        console.log("Respuesta del servidor:", datos);
    })
    .catch(error => {
        // servidores apagados
        mensajeDiv.style.color = "red";
        mensajeDiv.innerHTML = `❌ Error: ${error.message}`;
        console.error('Error detectado:', error);
    });
});