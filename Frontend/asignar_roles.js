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
        method: 'PUT', // actualizando (UPDATE) un rol existente
        headers: {
            'Content-Type': 'application/json' // Le decimos al backend que le mandamos un JSON
        },
        body: JSON.stringify(datosParaEnviar) // Convertimos nuestro objeto a texto JSON
    })
    .then(respuesta => respuesta.json()) // Esperamos la respuesta del backend y la leemos
    .then(datos => {
        // Si la conexion fue exitosa, mostramos el mensaje final
        mensajeDiv.style.color = "green";
        mensajeDiv.innerHTML = `✅ ¡Exito! El Usuario ${datosParaEnviar.usuario_id} fue actualizado al Rol ${datosParaEnviar.rol_id} en la base de datos.`;
        console.log("Respuesta del servidor:", datos);
    })
    .catch(error => {
        // Si el backend esta apagado o hay un error, lo atrapamos aqui
        mensajeDiv.style.color = "red";
        mensajeDiv.innerHTML = "❌ Error: No se pudo conectar con el servidor de la base de datos.";
        console.error('Error de conexion en el fetch:', error);
    });
});