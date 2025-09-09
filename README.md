Веб‑приложение, которое:
1) оценивает резюме кандидата по выбранной специальности (русский/английский),  
2) запускает короткое онлайн‑собеседование с автооценкой ответов.

Фронтенд — статические HTML/CSS/JS‑страницы, которые рендерятся как шаблоны Flask.  
Бэкенд — Flask API (Python), векторная модель `sentence-transformers` для оценки резюме, OpenAI API для диалога на собеседовании, опционально TTS (озвучка).

---

Структура проекта

```
VTB_X-ON/
├── backend/
│   ├── app.py                  # точка входа (Flask)
│   ├── resume_check.py         # проверка резюме через sentence-transformers
│   ├── into_text.py            # извлечение текста из PDF/DOCX/TXT/RTF/DOC
│   ├── uploads/                # сюда сохраняются загруженные файлы
│   └── requirements.txt        # минимальные зависимости (оставили для истории)
└── frontend/                   # шаблоны и статика, отдаются Flask
    ├── index.html              # главная: загрузка резюме и старт интервью
    ├── interview.html          # чат собеседования
    ├── css/                    # стили
    └── js/                     # фронтенд‑логика
```

> Рендер шаблонов идет из `frontend/` (см. `template_folder` и `static_folder` в `app.py`).

---

 Предварительные требования

- Python 3.10+ (рекомендовано 3.10–3.12).  
- для соединения с API ChatGPT нужен VPN. (иначе собеседование не будет работать)
- Доступ в Интернет при первом запуске (скачиваются веса модели `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`).
- OpenAI API ключ для интервью (модель задаёт вопросы и оценивает ответы).  
  Создайте файл `.env` и положите рядом с `backend/app.py`:
  ```env
  OPENAI_API_KEY=sk-...your_key_here...
  ```
- (Опционально для озвучки) Системные утилиты для TTS/аудио:
  - Windows: обычно ничего дополнительно не нужно.
  - Ubuntu/Debian: `sudo apt-get install ffmpeg espeak-ng` (рекомендуется).
  - macOS: `brew install ffmpeg espeak` (если используете TTS).

> Если TTS/аудио не нужно, можно игнорировать зависимости `sounddevice` и `TTS` — всё остальное будет работать.

---
 Установка (пошагово, максимально подробно)

1) Распакуйте проект
Если получили архив, распакуйте его так, чтобы путь выглядел вроде:
```
.../VTB_X-ON/VTB_X-ON/
```

2) Создайте и активируйте виртуальное окружение
Windows (PowerShell):
```powershell
cd .\VTB_X-ON\VTB_X-ON
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux/macOS (bash/zsh):
```bash
cd ./VTB_X-ON/VTB_X-ON
python3 -m venv .venv
source .venv/bin/activate
```

Проверьте, что активировалось окружение (в начале строки терминала появится `(.venv)`).

3) Установите зависимости
Рекомендуемая (полная) сборка для запуска всего функционала:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> Альтернатива (минимальный набор из `backend/requirements.txt`):
> ```bash
> pip install -r backend/requirements.txt
> # затем по ошибкам доустановите недостающее: python-dotenv, openai, sentence-transformers, torch, PyPDF2, python-docx, textract и т.д.
> ```

Примечания по зависимостям:
- При установке `sentence-transformers` автоматически подтянется `torch`. На CPU это займёт больше времени и места.
- `textract` нужен только для чтения старых форматов (`.doc`, `.rtf`). Для стабильной работы достаточно `.pdf`, `.docx`, `.txt`. Если не хотите ставить `textract`, просто не загружайте резюме в старых форматах.

4) Настройте переменные окружения
Создайте файл `.env` рядом с `backend/app.py`:
```env
OPENAI_API_KEY=sk-...ваш_ключ...
(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)
```

5) Запустите сервер
Из корня проекта (где лежит этот README):
```bash
python backend/app.py
```
По умолчанию сервер поднимется на `http://0.0.0.0:5001` (см. конец `app.py`).

6) Откройте приложение в браузере
Перейдите на:
```
http://localhost:5001/
```
- **Главная страница** — загрузка резюме и выбор темы/языка.
- Кнопка "Начать собеседование" переведёт на `/interview` (или откроет соответствующий режим с чатом).

> Рекомендуем **Chrome/Edge**. Голосовой ввод в интервью использует Web Speech API — он лучше всего работает в Chromium‑браузерах.

---

Как это работает

Проверка резюме
- Бэкенд парсит текст резюме (`into_text.py`) из PDF/DOCX/TXT (а также DOC/RTF при наличии `textract`).
- В `resume_check.py` текст конвертируется в эмбеддинги (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`), сравнивается с выбранной специальностью и выдаётся **оценка (0–100)** и **порог прохождения**.
- Порог по умолчанию задан константой `PASSING_SCORE_RESUME = 40` внутри `backend/app.py`.

Интервью
- На `/interview` фронтенд обращается к API:
  - `POST /api/start_interview` — начало сессии (тема, язык, краткая инфа из резюме).
  - `POST /api/answer` — отправка ответа пользователя, получение следующего вопроса и баллов.
- Для генерации вопросов/оценки используется OpenAI (см. `.env`).
- (Опционально) TTS может синтезировать голосовые ответы бота.

---

Частые проблемы и решения

- **ModuleNotFoundError / ImportError** — поставьте недостающий пакет:
  ```bash
  pip install <имя_пакета>
  ```

- Torch не устанавливается/очень большой — можно поставить CPU‑сборку вручную с официального колеса PyTorch, либо работать на CPU (по умолчанию так и будет).

- Ошибка при чтении `.doc`/`.rtf` — установите `textract` и системные бинари, либо конвертируйте резюме в PDF/DOCX.

- OpenAI: невалидный ключ/лимиты — проверьте `OPENAI_API_KEY` и квоты вашего аккаунта.

- Порт 5001 занят — измените порт внизу `backend/app.py` (последняя строка с `app.run(...)`).

---


API

- `GET /` — главная страница (шаблон `frontend/index.html`).
- `POST /api/upload-resume` — загрузка резюме, параметры формы: `fullname`, `interview-topic`, `select_language`, файл `resume`.
- `GET /interview` — страница чата интервью (шаблон `frontend/interview.html`).
- `POST /api/start_interview` — старт сессии интервью.
- `POST /api/answer` — отправка ответа, возвращает оценку и следующий вопрос до завершения сессии.
