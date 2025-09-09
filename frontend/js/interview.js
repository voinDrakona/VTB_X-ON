document.addEventListener('DOMContentLoaded', function() {
    let sessionId = null;
    const chatBox = document.getElementById("chat-box");
    const setupSection = document.getElementById("setup-section");
    const chatSection = document.getElementById("chat-section");
    const userInput = document.getElementById("user-answer");
    const voiceBtn = document.getElementById("voice-btn");

    // Добавляем начальное сообщение
    addMessage("Добро пожаловать на онлайн-собеседование! Нажмите 'Начать собеседование'.", "bot");

    function addMessage(text, sender) {
        const div = document.createElement("div");
        div.className = `msg ${sender}`;
        div.innerHTML = `<strong>${sender === 'bot' ? 'Система' : 'Вы'}:</strong> ${text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    window.startInterview = async function() {
        try {
            const resp = await fetch("/api/start_interview", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({})
            });
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json();
            console.log("Response data:", data);
            
            if (data.error) {
                alert("Ошибка: " + data.error);
                return;
            }
            
            sessionId = data.session_id;
            setupSection.classList.add("hidden");
            chatSection.classList.remove("hidden");

            addMessage("Интервью началось! " + data.question, "bot");
        } catch (error) {
            console.error("Error starting interview:", error);
            alert("Ошибка при запуске собеседования: " + error.message);
        }
    }

    window.sendAnswer = async function() {
        const answer = userInput.value.trim();
        if (!answer) return;
        
        addMessage(answer, "user");
        userInput.value = "";

        try {
            const resp = await fetch("/api/answer", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ session_id: sessionId, answer })
            });
            
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json();
            console.log("Answer response:", data);

            if (data.next_question) {
                addMessage(data.next_question, "bot");
            }
            if (data.finished) {
                if (data.passed) {
                    addMessage("✅ Интервью завершено: Кандидат прошёл!", "bot");
                } else {
                    addMessage("❌ Интервью завершено: Кандидат не прошёл.", "bot");
                }
                userInput.disabled = true;
                document.querySelector('button[onclick="sendAnswer()"]').disabled = true;
                if (voiceBtn) voiceBtn.disabled = true;
            }
        } catch (error) {
            console.error("Error sending answer:", error);
            addMessage("Ошибка при отправке ответа: " + error.message, "bot");
        }
    }

    // Голосовой ввод
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "ru";
        recognition.continuous = false;
        recognition.interimResults = false;

        voiceBtn.addEventListener("click", () => {
            recognition.start();
            voiceBtn.textContent = "🎤 Слушаю...";
        });

        recognition.addEventListener("result", (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            voiceBtn.textContent = "🎤 Говорить";
            sendAnswer();
        });

        recognition.addEventListener("end", () => {
            console.log("Распознавание завершено");
            voiceBtn.textContent = "🎤 Говорить";
        });

        recognition.addEventListener("error", (event) => {
            console.error("Ошибка распознавания:", event.error);
            voiceBtn.textContent = "🎤 Говорить";
            addMessage("Ошибка распознавания речи. Пожалуйста, введите текст вручную.", "bot");
        });

    } else {
        alert("Ваш браузер не поддерживает голосовой ввод");
    }
});