const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;

    const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
        message.textContent = data.error;
        return;
    }

    localStorage.setItem("loggedUser", JSON.stringify(data));

    message.textContent = "Access granted";

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
});