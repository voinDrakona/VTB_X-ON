const resumeForm = document.getElementById('resume-form');
const resultSection = document.getElementById('result-section');
const resultMessage = document.getElementById('result-message');
const loading = document.getElementById('loading');
const interviewBtn = document.getElementById('interview-btn');
const fileInput = document.getElementById('resume-file');
const fileNameDiv = document.getElementById('file-name');

let sessionId = null;
let recognition = null;
let isRecording = false;

// Показывать имя файла
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDiv.textContent = fileInput.files[0].name;
    } else {
        fileNameDiv.textContent = '';
    }
});

resumeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullname = document.getElementById('fullname').value.trim();
    if (!fullname || !fileInput.files.length) {
        alert("Заполните все поля и выберите файл резюме");
        return;
    }

    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);
    formData.append('fullname', fullname);

    loading.classList.remove('hidden');
    resultSection.classList.add('hidden');
    interviewBtn.classList.add('hidden'); // Гарантируем, что кнопка скрыта

    try {
        const response = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        loading.classList.add('hidden');

        if (data.error) {
            alert("Ошибка: " + data.error);
            return;
        }

        // Показать результат
        resultMessage.textContent = `${data.accepted ? "Резюме принято! ✅ Готовы к собеседованию?" : "Резюме отклонено ❌"}`;
        resultSection.classList.remove('hidden');

        // Показать кнопку интервью только если принято
        if (data.accepted) {
            interviewBtn.classList.remove('hidden');
            interviewBtn.classList.add('show');
            // Прокрутка к кнопке интервью
            document.querySelector('.interview-container').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }

    } catch (err) {
        loading.classList.add('hidden');
        console.error("Ошибка:", err);
        alert("Ошибка сервера: " + err.message);
    }
});

function resetForm() {
    resumeForm.reset();
    resultSection.classList.add('hidden');
    interviewBtn.classList.remove('show');
    interviewBtn.classList.add('hidden'); // Скрываем кнопку при сбросе
    fileNameDiv.textContent = '';
    
    // Прокрутка к началу формы
    window.scrollTo({ top: 0, behavior: 'smooth' });
}



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

// === Голосовой ввод ===
function initVoice() {
    if (!("webkitSpeechRecognition" in window)) {
        alert("Ваш браузер не поддерживает голосовой ввод 😢");
        return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById("user-answer").value = transcript;
        sendAnswer();
    };

    recognition.onerror = function(e) {
        console.error("Speech recognition error", e);
        isRecording = false;
        document.getElementById("voice-btn").textContent = "🎤 Говорить";
    };

    recognition.onend = function() {
        isRecording = false;
        document.getElementById("voice-btn").textContent = "🎤 Говорить";
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initVoice();

    const voiceBtn = document.getElementById("voice-btn");
    voiceBtn.addEventListener("click", () => {
        if (!recognition) return;
        if (!isRecording) {
            recognition.start();
            isRecording = true;
            voiceBtn.textContent = "🛑 Стоп";
        } else {
            recognition.stop();
            isRecording = false;
            voiceBtn.textContent = "🎤 Говорить";
        }
    });
});
