const user = JSON.parse(localStorage.getItem("loggedUser"));

if (!user) {
  window.location.href = "index.html";
}

document.getElementById("userInfo").textContent =
  `Hola, ${user.nombre} (${user.rol})`;

function ir(ruta) {
  window.location.href = ruta;
}

function logout() {
  localStorage.removeItem("loggedUser");
  window.location.href = "index.html";
}

function verUsuarios() {
  alert("Aquí puedes conectar con /api/usuarios");
}