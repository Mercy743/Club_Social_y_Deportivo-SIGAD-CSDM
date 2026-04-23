const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
loginForm.addEventListener("submit", async e => {
e.preventDefault();

const email = document.getElementById("emailInput").value;
const password = document.getElementById("passwordInput").value;

const res = await fetch("/api/login", {
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
window.location.href = "dashboard.html";
});
}