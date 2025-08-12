document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("newsletterForm");
  const emailInput = document.getElementById("newsletterEmail");
  const messageDiv = document.getElementById("newsletterMessage");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    messageDiv.textContent = "";
    const email = emailInput.value.trim();

    if (!email || !/^[\w\-.]+@[\w\-.]+\.\w{2,}$/.test(email)) {
      messageDiv.textContent = "Please enter a valid email address.";
      messageDiv.style.color = "var(--accent, #6366f1)";
      return;
    }

    form.querySelector(".newsletter-btn").disabled = true;
    messageDiv.textContent = "Subscribing...";
    messageDiv.style.color = "var(--text-muted, #a1a1aa)";

    try {
      const res = await fetch(
        "https://ccw-backend.onrender.com/api/newsletter/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json();
      if (res.status === 201) {
        messageDiv.textContent =
          "🎉 Subscribed successfully! Check your inbox for daily questions.";
        messageDiv.style.color = "var(--accent, #10b981)";
        form.reset();
      } else if (res.status === 409) {
        messageDiv.textContent = "You are already subscribed!";
        messageDiv.style.color = "var(--accent, #6366f1)";
      } else if (data && data.error) {
        messageDiv.textContent = data.error;
        messageDiv.style.color = "var(--accent, #ef4444)";
      } else {
        messageDiv.textContent =
          "Something went wrong. Please try again later.";
        messageDiv.style.color = "var(--accent, #ef4444)";
      }
    } catch (err) {
      messageDiv.textContent = "Network error. Please try again.";
      messageDiv.style.color = "var(--accent, #ef4444)";
    } finally {
      form.querySelector(".newsletter-btn").disabled = false;
    }
  });
});
