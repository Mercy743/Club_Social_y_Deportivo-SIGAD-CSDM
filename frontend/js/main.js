const user = JSON.parse(localStorage.getItem("loggedUser"));

// Solo mostrar info si está logueado
if (user) {
  console.log("Usuario logueado:", user);
}

// navegación
function ir(ruta) {
  window.location.href = ruta;
}

function logout() {
  localStorage.removeItem("loggedUser");
  window.location.href = "index.html";
}

function irLogin() {
  window.location.href = "dashboard.html"; // tu login
}