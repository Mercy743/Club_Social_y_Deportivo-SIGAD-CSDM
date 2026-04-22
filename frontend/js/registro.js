const form = document.getElementById("registroForm");
const mensaje = document.getElementById("mensaje");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    nombre: document.getElementById("nombre").value,
    apellido: document.getElementById("apellido").value,
    email: document.getElementById("email").value,
    password: document.getElementById("password").value,
    telefono: document.getElementById("telefono").value,
    ine: document.getElementById("ine").value,
    direccion: document.getElementById("direccion").value
  };

  try {
    const res = await fetch("/api/socios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) {
      mensaje.textContent = result.error;
      return;
    }

    mensaje.textContent = "Socio registrado correctamente";

  } catch (error) {
    mensaje.textContent = "Error de conexión";
  }
});