let sessionId = null;

function addMessage(text, sender) {
    const chatBox = document.getElementById("chat-box");
    const div = document.createElement("div");
    div.className = `msg ${sender}`;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function startInterview() {
    const topic = document.getElementById("topic").value.trim();
    const level = document.getElementById("level").value;

    const resp = await fetch("/api/start_interview", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ topic, level })
    });
    const data = await resp.json();
    if (data.error) {
        alert("Ошибка: " + JSON.stringify(data.error));
        return;
    }
    sessionId = data.session_id;
    document.getElementById("setup-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");

    addMessage("Интервью началось! " + data.question, "bot");
}

async function sendAnswer() {
    const input = document.getElementById("user-answer");
    const answer = input.value.trim();
    if (!answer) return;
    addMessage(answer, "user");
    input.value = "";

    const resp = await fetch("/api/answer", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ session_id: sessionId, answer })
    });
    const data = await resp.json();

    if (data.reasoning) {
        addMessage("Оценка: " + data.reasoning + " (Баллы: " + data.score + ")", "bot");
    }
    if (data.next_question) {
        addMessage(data.next_question, "bot");
    }
    if (data.finished) {
        if (data.passed) {
            addMessage("✅ Интервью завершено: Кандидат прошёл!", "bot");
        } else {
            addMessage("❌ Интервью завершено: Кандидат не прошёл.", "bot");
        }
        document.getElementById("chat-section").classList.add("hidden");
    }
}