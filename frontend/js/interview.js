// let sessionId = null;

// function addMessage(text, sender) {
//     const chatBox = document.getElementById("chat-box");
//     const div = document.createElement("div");
//     div.className = `msg ${sender}`;
//     div.textContent = text;
//     chatBox.appendChild(div);
//     chatBox.scrollTop = chatBox.scrollHeight;
// }
// topic
// async function startInterview() {
//     const topic = document.getElementById("topic").value.trim();
//     const level = document.getElementById("level").value;

//     const resp = await fetch("/api/start_interview", {
//         method: "POST",
//         headers: {"Content-Type": "application/json"},
//         body: JSON.stringify({ topic, level })
//     });
//     const data = await resp.json();
//     if (data.error) {
//         alert("Ошибка: " + JSON.stringify(data.error));
//         return;
//     }
//     sessionId = data.session_id;
//     document.getElementById("setup-section").classList.add("hidden");
//     document.getElementById("chat-section").classList.remove("hidden");

//     addMessage("Интервью началось! " + data.question, "bot");
// }

// async function sendAnswer() {
//     const input = document.getElementById("user-answer");
//     const answer = input.value.trim();
//     if (!answer) return;
//     addMessage(answer, "user");
//     input.value = "";

//     const resp = await fetch("/api/answer", {
//         method: "POST",
//         headers: {"Content-Type": "application/json"},
//         body: JSON.stringify({ session_id: sessionId, answer })
//     });
//     const data = await resp.json();

//     if (data.reasoning) {
//         addMessage("Оценка: " + data.reasoning + " (Баллы: " + data.score + ")", "bot");
//     }
//     if (data.next_question) {
//         addMessage(data.next_question, "bot");
//     }
//     if (data.finished) {
//         if (data.passed) {
//             addMessage("✅ Интервью завершено: Кандидат прошёл!", "bot");
//         } else {
//             addMessage("❌ Интервью завершено: Кандидат не прошёл.", "bot");
//         }
//         document.getElementById("chat-section").classList.add("hidden");
//     }
// }

// // Голосовой ввод
// const voiceBtn = document.getElementById("voice-btn");
// const userInput = document.getElementById("user-answer");
// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// if (SpeechRecognition) {
//     const recognition = new SpeechRecognition();
//     recognition.lang = 'ru-RU';
//     recognition.continuous = false;
//     recognition.interimResults = false;

//     voiceBtn.addEventListener("click", () => {
//         recognition.start();
//     });

//     recognition.addEventListener("result", (event) => {
//         const transcript = event.results[0][0].transcript;
//         userInput.value = transcript;
//         sendAnswer();
//     });

//     recognition.addEventListener("end", () => {
//         console.log("Распознавание завершено");
//     });

// } else {
//     alert("Ваш браузер не поддерживает голосовой ввод");
// }

document.addEventListener('DOMContentLoaded', function() {
    let sessionId = null;
    const chatBox = document.getElementById("chat-box");
    const setupSection = document.getElementById("setup-section");
    const chatSection = document.getElementById("chat-section");
    const userInput = document.getElementById("user-answer");
    const voiceBtn = document.getElementById("voice-btn");
    const levelSelect = document.getElementById("level");

    // Добавляем начальное сообщение
    addMessage("Добро пожаловать на онлайн-собеседование! Выберите уровень сложности и нажмите 'Начать собеседование'.", "bot");

    function addMessage(text, sender) {
        const div = document.createElement("div");
        div.className = `msg ${sender}`;
        div.innerHTML = `<strong>${sender === 'bot' ? 'Система' : 'Вы'}:</strong> ${text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    window.startInterview = async function() {
        const level = levelSelect.value;

        const resp = await fetch("/api/start_interview", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ level })
        });
        
        const data = await resp.json();
        if (data.error) {
            alert("Ошибка: " + JSON.stringify(data.error));
            return;
        }
        
        sessionId = data.session_id;
        setupSection.classList.add("hidden");
        chatSection.classList.remove("hidden");

        addMessage("Интервью началось! " + data.question, "bot");
    }

    window.sendAnswer = async function() {
        const answer = userInput.value.trim();
        if (!answer) return;
        
        addMessage(answer, "user");
        userInput.value = "";

        const resp = await fetch("/api/answer", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ session_id: sessionId, answer })
        });
        
        const data = await resp.json();

        if (data.next_question) {
            addMessage(data.next_question, "bot");
        }
        if (data.finished) {
            if (data.passed) {
                addMessage("✅ Интервью завершено: Кандидат прошёл!", "bot");
            } else {
                addMessage("❌ Интервью завершено: Кандидат не прошёл.", "bot");
            }
            // Не скрываем чат-секцию, чтобы пользователь видел историю
            userInput.disabled = true;
            document.querySelector('button[onclick="sendAnswer()"]').disabled = true;
            if (voiceBtn) voiceBtn.disabled = true;
        }
    }

    // Голосовой ввод
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
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


