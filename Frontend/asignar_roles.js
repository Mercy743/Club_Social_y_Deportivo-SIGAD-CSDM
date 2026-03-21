// Esperamos a que el administrador envíe el formulario
document.getElementById('form-roles').addEventListener('submit', function(event) {
    event.preventDefault(); // Evita que la página se recargue

    // Capturamos los datos usando los nombres definidos en el script 
    const usuario_id = document.getElementById('usuario_id').value;
    const rol_id = document.getElementById('rol_id').value;

    // Mostramos un mensaje temporal (luego esto irá al backend)
    const mensajeDiv = document.getElementById('mensaje');
    mensajeDiv.innerHTML = `Preparando actualización: Usuario ID ${usuario_id} pasará a Rol ID ${rol_id}`;
    
    console.log("Datos listos para enviar:", { usuario_id, rol_id });
    
    // Aquí es donde más adelante conectaremos con el Backend usando fetch()
});