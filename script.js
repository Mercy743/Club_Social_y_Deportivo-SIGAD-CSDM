//Datos de prueba sin base de datos 
//Roles
const roles = {
    1: "socio",
    2: "instructor",
    3: "admin"
};
//Usuarios
const usuarios = [
    //Admin
    {
        id: 1,
        nombre: "Administrator",
        email: "admin@sigad.com",
        password: "admin123",
        rolId: 3
    },
    //Juanito
    {
        id: 2,
        nombre: "Juan Perez",
        email: "juan@sigad.com",
        password: "1234",
        rolId: 1
    },
    //Instructor
    {
        id: 3,
        nombre: "Instructor Uno",
        email: "instructor@sigad.com",
        password: "abcd",
        rolId: 2
    }
];


///Código 
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const emailInput = document.getElementById("emailInput").value;
    const passwordInput = document.getElementById("passwordInput").value;

    //Aquí se hace consulta con SQL
    const usuarioValido = usuarios.find(user =>
        user.email === emailInput && user.password === passwordInput
    );

    if (usuarioValido) {
        const rolNombre = roles [usuarioValido.rolId];

        message.style.color = "green";
        message.textContent = "Access granted (" + rolNombre + ")";

        //Guardar sesión
        localStorage.setItem("loggedUser", JSON.stringify({
            id: usuarioValido.id,
            nombre: usuarioValido.nombre,
            email: usuarioValido.email,
            rol: rolNombre
        }));

        //Sale de login (index.html) y se dirige a la página principal (dashboard.html)
        setTimeout(() => {
            alert("login correcto redirigiendo...");
            window.location.href = "dashboard.html";
        }, 1000);

    } else {
        message.style.color = "red";
        message.textContent = "Invalid email or password";
    }
});