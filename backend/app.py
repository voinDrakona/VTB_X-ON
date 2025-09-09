import os
import uuid
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from openai import OpenAI
import sounddevice as sd
from TTS.api import TTS

from resume_check import analyze_resume 
from into_text import extract_text_from_file

PASSING_SCORE_RESUME    = 49
COUNT_QUESTIONS         = 5
PASSING_SCORE_INTERVIEW = 3

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

# -------------------- Инициализация --------------------
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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

def speak_text_local(text, language="en"):
    # если язык не указан или пустой → ставим "en" по умолчанию
    if not language:
        language = "en"

    # синтез речи
    audio = tts.tts(
        text=text,
        speaker="Claribel Dervla",  # выбери подходящий голос
        language=language
    )
    sd.play(audio, samplerate=tts.synthesizer.output_sample_rate)
    sd.wait()

# -------------------- Логика интервью --------------------
class InterviewState:
    def __init__(self, language="en"):
        self.topic = ""
        self.level = ""
        self.resume_text = ""
        self.language = language  # язык по умолчанию
        self.story_messages = []
        self.scores = []
        self.finished = False


sessions = {}

# Создаём system prompt + сразу первый вопрос от GPT
def start_interview_with_resume(state):
    # Определяем язык для промпта на основе выбранного языка
    language_prompt = ""
    if state.language == "ru":
        language_prompt = "Проводи собеседование на русском языке."
    elif state.language == "en":
        language_prompt = "Conduct the interview in English."
    # Добавьте другие языки по необходимости
    
    system_prompt = (
        "Ты — строгий технический интервьюер.\n"
        "Задавай вопросы на основе резюме кандидата и указанной темы.\n"
        "Формат: только текст вопроса, без нумерации, без Markdown, без жирного текста.\n\n"
        "После ответа кандидата ты должен оценить его по системе:\n"
        "1 = очень плохо, 2 = плохо, 3 = средне, 4 = хорошо, 5 = отлично.\n"
        "Ты должен выдавать JSON с оценкой: {\"score\": int, \"reasoning\": str}.\n"
        f"Вот резюме кандидата:\n{state.resume_text}\n\n"
        f"Вот специальность для кандидата:\n{state.topic}\n\n"
        f"{language_prompt}\n\n"
        "Выдели направление и начни интервью с первого вопроса по ней."
        "Ты можешь задавать более углублённые вопросы исходя из предыдущих вопросов"
    )

    state.story_messages = [
        {"role": "system", "content": system_prompt},
    ]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=state.story_messages
    )

    first_question = response.choices[0].message.content.strip()
    print("gpt_response:", first_question)
    speak_text_local(first_question, state.language)
    state.story_messages.append({"role": "assistant", "content": first_question})

    return first_question


def evaluate_answer(answer, state):
    state.story_messages.append({"role": "user", "content": answer})

    # Добавляем информацию о языке в промпт для оценки
    language_prompt = ""
    if state.language == "ru":
        language_prompt = "Отвечай на русском языке."
    elif state.language == "en":
        language_prompt = "Respond in English."
    
    eval_answer = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Ты интервьюер."
                    f"Проанализируй историю общения:\n{state.story_messages}\n\n"
                    "и составь следующий вопрос собеседования."
                    "Оцени последний ответ кандидата строго в JSON: "
                    "{\"score\": int, \"reasoning\": str, \"next question\": str}. "
                    f"{language_prompt}\n"
                    "Не задавай вопросы, не пиши лишний текст."
                )
            },
            {"role": "user", "content": answer}
        ],
        response_format={"type": "json_object"}
    )

    evaluation = json.loads(eval_answer.choices[0].message.content)
    next_question = evaluation["next question"]
    print("gpt_next_question:", next_question)
    speak_text_local(next_question, state.language)
    state.story_messages.append({"role": "assistant", "content": next_question})

    state.scores.append(evaluation["score"])

    return evaluation

# -------------------- Роуты --------------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    try:
        fullname = request.form.get('fullname')
        topic = request.form.get('interview-topic')
        language = request.form.get('select_language')

        if 'resume' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не найден'})

        file = request.files['resume']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'})

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            result = analyze_resume(filepath, PASSING_SCORE_RESUME, topic)

            resume_text = extract_text_from_file(filepath)
            result['resume_text'] = resume_text
            result['language'] = language  # Добавляем язык в ответ

            # добавь поле accepted
            result['accepted'] = result.get("passed", False)

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
    resume_text = data.get("resume_text")
    language = data.get("language", "en")  # Получаем язык из запроса, по умолчанию английский
    topic = data.get("topic", "")

    # Создаем новое состояние интервью с указанным языком
    state = InterviewState(language=language)
    state.resume_text = resume_text
    state.topic = topic

    session_id = str(uuid.uuid4())
    first_question = start_interview_with_resume(state)

    sessions[session_id] = state

    return jsonify({"session_id": session_id, "question": first_question})


@app.route('/api/answer', methods=['POST'])
def post_answer():
    data = request.json
    session_id = data.get("session_id")
    answer = data.get("answer")
    language = data.get("language", "en")  # Получаем язык из запроса

    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    state = sessions[session_id]
    
    # Обновляем язык в состоянии, если он передан
    if language:
        state.language = language

    evaluation = evaluate_answer(answer, state)

    finished = len(state.scores) >= COUNT_QUESTIONS
    passed = finished and (sum(state.scores) / len(state.scores) >= PASSING_SCORE_INTERVIEW)

    if finished:
        state.finished = True
        next_question = None

    return jsonify({
        "reasoning": evaluation["reasoning"],
        "score": evaluation["score"],
        "next_question": evaluation["next question"],
        "finished": finished,
        "passed": passed
    })


# -------------------- Запуск --------------------
if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')