document.addEventListener('DOMContentLoaded', function() {
    // Обработка выбора файла
    const fileInput = document.getElementById('resume-file');
    const fileName = document.getElementById('file-name');
    
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileName.textContent = this.files[0].name;
        } else {
            fileName.textContent = '';
        }
    });
    
    // Обработка отправки формы
    const form = document.getElementById('resume-form');
    form.addEventListener('submit', handleFormSubmit);
});

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const fullname = formData.get('fullname');
    const resumeFile = formData.get('resume');
    
    if (!fullname.trim()) {
        showResult('Пожалуйста, введите ФИО', false, {});
        return;
    }
    
    if (!resumeFile || resumeFile.size === 0) {
        showResult('Пожалуйста, выберите файл резюме', false, {});
        return;
    }
    
    showLoading(true);

    // Отключаем кнопку, чтобы нельзя было повторно отправить форму
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    try {
        const response = await fetch('http://localhost:5001/api/upload-resume', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();

        if (data.success) {
            showResult(data.message, data.passed, data.data || {});
        } else {
            showResult(data.error || 'Произошла ошибка при обработке', false, {});
        }
        
    } catch (error) {
        showResult(`Ошибка соединения с сервером: ${error}`, false, {});
        console.error('Ошибка fetch:', error);
    } finally {
        showLoading(false);
        submitButton.disabled = false;
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const form = document.getElementById('resume-form');
    
    if (show) {
        loading.classList.remove('hidden');
        form.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
        form.classList.remove('hidden');
    }
}

function showResult(message, isSuccess, data) {
    const resultSection = document.getElementById('result-section');
    const resultMessage = document.getElementById('result-message');
    
    let resultHTML = `<div class="result-header">${message}</div>`;
    
    if (isSuccess && Object.keys(data).length > 0) {
        resultHTML += `
            <div class="result-details">
                <div class="score">Общий балл: <strong>${data.score}/100</strong></div>
                <div class="candidate">Кандидат: <strong>${data.candidate_name}</strong></div>
                
                ${data.matched_requirements && data.matched_requirements.length > 0 ? `
                <div class="requirements">
                    <h3>✅ Соответствует требованиям:</h3>
                    <ul>${data.matched_requirements.map(req => `<li>${req}</li>`).join('')}</ul>
                </div>` : ''}
                
                ${data.missing_requirements && data.missing_requirements.length > 0 ? `
                <div class="requirements">
                    <h3>❌ Не хватает:</h3>
                    <ul>${data.missing_requirements.map(req => `<li>${req}</li>`).join('')}</ul>
                </div>` : ''}
                
                <div class="details">
                    <p>${data.details}</p>
                </div>
                
                <div class="recommendation">
                    <strong>Рекомендация:</strong> ${data.recommendation}
                </div>
                
                <div class="analysis-date">
                    Анализ проведен: ${data.analysis_date}
                </div>
            </div>
        `;
    }
    
    resultMessage.innerHTML = resultHTML;
    resultMessage.className = isSuccess ? 'result-message success' : 'result-message error';
    resultSection.classList.remove('hidden');
}

function resetForm() {
    const form = document.getElementById('resume-form');
    const resultSection = document.getElementById('result-section');
    const fileName = document.getElementById('file-name');
    
    form.reset();
    fileName.textContent = '';
    resultSection.classList.add('hidden');
}
