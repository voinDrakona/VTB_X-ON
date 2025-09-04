import os
import uuid
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from openai import OpenAI

# -------------------- Инициализация --------------------
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

from resume_check import analyze_resume 
from into_text import extract_text_from_file

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), '../frontend'),
    static_folder=os.path.join(os.path.dirname(__file__), '../frontend')
)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# -------------------- Вспомогательные --------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# -------------------- Логика интервью --------------------
class InterviewState:
    def __init__(self, topic, level, resume_text):
        self.topic = topic
        self.level = level
        self.resume_text = resume_text
        self.messages = []   # история диалога
        self.scores = []
        self.finished = False


sessions = {}


def start_interview_with_resume(resume_text, topic, level):
    """Создаём system prompt + сразу первый вопрос от GPT"""
    system_prompt = (
        "Ты — строгий технический интервьюер.\n"
        "Задавай вопросы на основе резюме кандидата и указанной темы.\n"
        "Формат: только текст вопроса, без нумерации, без Markdown, без жирного текста.\n\n"
        "После ответа кандидата ты должен оценить его по системе:\n"
        "1 = очень плохо, 2 = плохо, 3 = средне, 4 = хорошо, 5 = отлично.\n"
        "Ты должен выдавать JSON с оценкой: {\"score\": int, \"reasoning\": str}.\n"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Вот резюме кандидата:\n{resume_text}\n\nНачни интервью с первого вопроса по теме {topic}, уровень {level}."}
    ]

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )

    first_q = resp.choices[0].message.content.strip()
    messages.append({"role": "assistant", "content": first_q})

    return messages, first_q


def evaluate_answer(messages, answer):
    # добавляем ответ кандидата в историю
    messages.append({"role": "user", "content": answer})

    # GPT генерирует следующий вопрос (без оценки)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )
    next_q = resp.choices[0].message.content.strip()

    # сохраняем только следующий вопрос в историю
    messages.append({"role": "assistant", "content": next_q})

    # отдельный запрос для оценки ответа (НЕ пишем это в messages!)
    eval_resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Ты интервьюер. Оцени последний ответ кандидата строго в JSON: "
                    "{\"score\": int, \"reasoning\": str}. "
                    "Не задавай вопросы, не пиши лишний текст."
                )
            },
            {"role": "user", "content": answer}
        ],
        response_format={"type": "json_object"}
    )

    evaluation = json.loads(eval_resp.choices[0].message.content)

    return evaluation, next_q



# -------------------- Роуты --------------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    try:
        fullname = request.form.get('fullname')

        if 'resume' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не найден'})

        file = request.files['resume']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'})

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            # Анализируем резюме
            result = analyze_resume(filepath)
            rating = result['data']['score']
            result['accepted'] = rating >= 60

            # Извлекаем текст для интервью
            resume_text = extract_text_from_file(filepath)
            result['resume_text'] = resume_text

            return jsonify(result)

        else:
            return jsonify({'success': False, 'error': 'Недопустимый формат файла'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/interview')
def interview_page():
    return render_template('interview.html')


@app.route('/api/start_interview', methods=['POST'])
def start_interview():
    data = request.json
    topic = data.get("topic")
    level = data.get("level")
    resume_text = data.get("resume_text")

    session_id = str(uuid.uuid4())
    messages, first_q = start_interview_with_resume(resume_text, topic, level)

    state = InterviewState(topic, level, resume_text)
    state.messages = messages
    sessions[session_id] = state

    return jsonify({"session_id": session_id, "question": first_q})


@app.route('/api/answer', methods=['POST'])
def post_answer():
    data = request.json
    session_id = data.get("session_id")
    answer = data.get("answer")

    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    state = sessions[session_id]

    evaluation, next_q = evaluate_answer(state.messages, answer)
    state.scores.append(evaluation["score"])

    finished = len(state.scores) >= 5  # допустим 5 вопросов максимум
    passed = finished and (sum(state.scores) / len(state.scores) >= 3)

    if finished:
        state.finished = True
        next_q = None

    return jsonify({
        "reasoning": evaluation["reasoning"],
        "score": evaluation["score"],
        "next_question": next_q,
        "finished": finished,
        "passed": passed
    })


# -------------------- Запуск --------------------
if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')
