document.addEventListener('DOMContentLoaded', function() {
const resumeForm = document.getElementById('resume-form');
const resultSection = document.getElementById('result-section');
const resultMessage = document.getElementById('result-message');
const loadingOverlay = document.getElementById('loading-overlay');
const successOverlay = document.getElementById('success-overlay');
const mainContainer = document.getElementById('main-container');
const fileInput = document.getElementById('resume-file');
const fileNameDiv = document.getElementById('file-name');
const fileLabel = document.getElementById('file-label');
const topicSelect = document.getElementById('interview-topic');
const languageSelect = document.getElementById('select_language');
const submitBtn = document.getElementById('submit-btn');
const failureOverlay = document.getElementById('failure-overlay');

// Обработчик изменения выбора темы
topicSelect.addEventListener('change', function() {
    if (topicSelect.value !== '') {
        fileInput.disabled = false;
        fileLabel.classList.remove('disabled');
        fileLabel.querySelector('.file-text').textContent = 'Выберите файл';
    } else {
        fileInput.disabled = true;
        fileLabel.classList.add('disabled');
        fileLabel.querySelector('.file-text').textContent = 'Выберите файл (доступно после выбора языка и темы)';
        fileNameDiv.textContent = '';
        submitBtn.disabled = true;
    }
});

// Обработчик изменения выбора языка
languageSelect.addEventListener('change', function() {
    if (languageSelect.value !== '') {
        fileInput.disabled = false;
        fileLabel.classList.remove('disabled');
        fileLabel.querySelector('.file-text').textContent = 'Выберите файл';
    } else {
        fileInput.disabled = true;
        fileLabel.classList.add('disabled');
        fileLabel.querySelector('.file-text').textContent = 'Выберите файл (доступно после выбора языка и темы)';
        fileNameDiv.textContent = '';
        submitBtn.disabled = true;
    }
});

// Показывать имя файла и активировать кнопку отправки
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDiv.textContent = fileInput.files[0].name;
        // Проверяем, заполнены ли все обязательные поля
        const fullname = document.getElementById('fullname').value.trim();
        if (fullname && topicSelect.value && languageSelect) {
            submitBtn.disabled = false;
        }
    } else {
        fileNameDiv.textContent = '';
        submitBtn.disabled = true;
    }
});

// Проверка заполнения ФИО
document.getElementById('fullname').addEventListener('input', function() {
    const fullname = this.value.trim();
    const hasFile = fileInput.files.length > 0;
    const hasTopic = topicSelect.value !== '';
    
    submitBtn.disabled = !(fullname && hasFile && hasTopic);
});

resumeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullname = document.getElementById('fullname').value.trim();
    const topic = topicSelect.value;
    
    if (!fullname || !fileInput.files.length || !topic) {
        alert("Заполните все обязательные поля");
        return;
    }

    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);
    formData.append('fullname', fullname);
    formData.append('interview-topic', topic);

    // Показываем лоадер поверх всего
    mainContainer.classList.add('blurred');
    loadingOverlay.classList.add('visible');
    resultSection.classList.add('hidden'); // Гарантируем, что результат скрыт

    try {
        const response = await fetch('http://localhost:5001/api/upload-resume', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        // Скрываем лоадер после получения ответа
        loadingOverlay.classList.remove('visible');

        if (data.success) {
            // Сохраняем данные резюме в localStorage для использования в интервью
            localStorage.setItem('resume_data', JSON.stringify({
                resume_text: data.resume_text,
                topic: topic,
                language: languageSelect.value
            }));
            
            if (data.accepted) {
                // Показываем success-оверлей для принятых резюме
                successOverlay.classList.add('visible');
            } else {
                // Показываем failure-оверлей для отклоненных резюме
                showFailureDetails(data.message, data.errors || []);
                failureOverlay.classList.add('visible');
            }
        } else {
            // Показываем failure-оверлей для ошибок
            showFailureDetails(data.error || 'Произошла ошибка при обработке', []);
            failureOverlay.classList.add('visible');
        }

    } catch (err) {
        // Скрываем лоадер в случае ошибки
        loadingOverlay.classList.remove('visible');
        mainContainer.classList.remove('blurred');
        console.error("Ошибка:", err);
        // Показываем failure-оверлей для сетевых ошибок
        showFailureDetails("Ошибка сервера: " + err.message, []);
        failureOverlay.classList.add('visible');
    }
});

function showFailureDetails(message, errors) {
    const errorDetails = document.getElementById('error-details');
    errorDetails.innerHTML = '';

    if (message) {
        const messageElem = document.createElement('p');
        messageElem.textContent = message;
        messageElem.style.fontWeight = 'bold';
        errorDetails.appendChild(messageElem);
    }

    if (errors && errors.length > 0) {
        const list = document.createElement('ul');
        errors.forEach(error => {
            const item = document.createElement('li');
            item.textContent = error;
            list.appendChild(item);
        });
        errorDetails.appendChild(list);
    } else {
        errorDetails.innerHTML += '<p>Попробуйте проверить резюме на соответствие требованиям вакансии.</p>';
    }
}

window.resetForm = function() {
    resumeForm.reset();
    resultSection.classList.add('hidden');
    fileNameDiv.textContent = '';
    
    // Сбрасываем состояние формы
    fileInput.disabled = true;
    fileLabel.classList.add('disabled');
    fileLabel.querySelector('.file-text').textContent = 'Выберите файл (доступно после выбора темы)';
    submitBtn.disabled = true;
    
    // Убираем размытие и оверлеи
    mainContainer.classList.remove('blurred');
    successOverlay.classList.remove('visible');
    failureOverlay.classList.remove('visible');
    loadingOverlay.classList.remove('visible');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
});