// Esperamos a que el administrador envie el formulario
document.getElementById('form-roles').addEventListener('submit', function(event) {
    event.preventDefault(); // Evita que la pagina se recargue 

    //  Capturamos los datos usando los nombres de la base de datos 
    const usuario_id = document.getElementById('usuario_id').value;
    const rol_id = document.getElementById('rol_id').value;

    //  Validacion 
    if (!usuario_id || usuario_id <= 0) {
        document.getElementById('mensaje').innerHTML = "Error: Ingrese un ID de usuario válido.";
        return;
    }

    // Simulacion de guardado 
    const datosParaEnviar = {
        usuario_id: parseInt(usuario_id),
        rol_id: parseInt(rol_id)
    };

    // Mostramos feedback al administrador 
    const mensajeDiv = document.getElementById('mensaje');
    mensajeDiv.style.color = "green";
    mensajeDiv.innerHTML = `✅ Solicitud lista: El Usuario ${datosParaEnviar.usuario_id} será actualizado al Rol ${datosParaEnviar.rol_id}.`;
    
    console.log("Objeto JSON listo para la base de datos:", datosParaEnviar);
    
    
});