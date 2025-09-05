const resumeForm = document.getElementById('resume-form');
const resultSection = document.getElementById('result-section');
const resultMessage = document.getElementById('result-message');
const loading = document.getElementById('loading');
const interviewBtn = document.getElementById('interview-btn');
const fileInput = document.getElementById('resume-file');
const fileNameDiv = document.getElementById('file-name');

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


