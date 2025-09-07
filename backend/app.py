import os
import uuid
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from openai import OpenAI
import subprocess
# import simpleaudio  # для воспроизведения .wav
import tempfile
import torch
import sounddevice as sd
from TTS.api import TTS

from resume_check import analyze_resume 
from into_text import extract_text_from_file

PASSING_SCORE_RESUME    = 49
COUNT_QUESTIONS         = 5
PASSING_SCORE_INTERVIEW = 3

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

model, _ = torch.hub.load(
    repo_or_dir='snakers4/silero-models',
    model='silero_tts',
    language='ru',
    speaker='v3_1_ru'
)

# Настройки
sample_rate = 48000
speaker = 'baya'  # варианты: 'aidar', 'baya', 'kseniya', 'xenia', 'eugene'


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

# def speak_text_local(text):
#     subprocess.run(["say", "-v", "Milena", text])

def speak_text_local(text):
    audio = tts.tts(text, speaker="Claribel Dervla", language="ru")
    sd.play(audio, samplerate=tts.synthesizer.output_sample_rate)

# def speak_text_local(text: str):
#     audio = model.apply_tts(text=text, speaker=speaker, sample_rate=sample_rate)

#     # Воспроизведение через динамики
#     sd.play(audio, sample_rate)
#     sd.wait()

# -------------------- Логика интервью --------------------
class InterviewState:
    def __init__(self):
        self.topic = ""
        self.level = ""
        self.resume_text = ""
        self.story_messages = []
        self.scores = []
        self.finished = False


sessions = {}
state = InterviewState()

# Создаём system prompt + сразу первый вопрос от GPT
def start_interview_with_resume():
    system_prompt = (
        "Ты — строгий технический интервьюер.\n"
        "Задавай вопросы на основе резюме кандидата и указанной темы.\n"
        "Формат: только текст вопроса, без нумерации, без Markdown, без жирного текста.\n\n"
        "После ответа кандидата ты должен оценить его по системе:\n"
        "1 = очень плохо, 2 = плохо, 3 = средне, 4 = хорошо, 5 = отлично.\n"
        "Ты должен выдавать JSON с оценкой: {\"score\": int, \"reasoning\": str}.\n"
        f"Вот резюме кандидата:\n{state.resume_text}\n\n"
        f"Вот специальность для кандидата:\n{state.topic}\n\n"
        f"Выдели направление и начни интервью с первого вопроса по ней."
        "Ты можешь залавать более углублённые впросы исходя из предыдущих вопросов"
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
    speak_text_local(first_question)
    state.story_messages.append({"role": "assistant", "content": first_question})

    return first_question


# # Получили ответ безработного
# def evaluate_answer(answer):
#     state.story_messages.append({"role": "user", "content": answer})

#     response = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=[
#             {
#                 "role": "assistant",
#                 "content": (
#                     f"Проанализируй историюю общения:\n{state.story_messages}\n\n"
#                     "и составь следующий вопрос собеседования."
#                     "не пиши лишний текст."
#                 )
#             }
#         ],
#     )
#     next_question = response.choices[0].message.content.strip()
#     print("gpt_next_question:", next_question)
#     speak_text_local(next_question)
#     state.story_messages.append({"role": "assistant", "content": next_question})

#     # отдельный запрос для оценки ответа (НЕ пишем это в messages!)
#     eval_answer = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=[
#             {
#                 "role": "system",
#                 "content": (
#                     "Ты интервьюер. Оцени последний ответ кандидата строго в JSON: "
#                     "{\"score\": int, \"reasoning\": str}. "
#                     "Не задавай вопросы, не пиши лишний текст."
#                 )
#             },
#             {"role": "user", "content": answer}
#         ],
#         response_format={"type": "json_object"}
#     )

#     evaluation = json.loads(eval_answer.choices[0].message.content)
#     state.scores.append(evaluation["score"])

#     return evaluation, next_question

def evaluate_answer(answer):
    state.story_messages.append({"role": "user", "content": answer})

    eval_answer = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Ты интервьюер."
                    f"Проанализируй историюю общения:\n{state.story_messages}\n\n"
                    "и составь следующий вопрос собеседования."
                    "Оцени последний ответ кандидата строго в JSON: "
                    "{\"score\": int, \"reasoning\": str, \"next question\": str}. "
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
    speak_text_local(next_question)
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

        if 'resume' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не найден'})

        file = request.files['resume']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Файл не выбран'})

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            # result = analyze_resume(filepath, PASSING_SCORE_RESUME)
            result = analyze_resume(filepath, PASSING_SCORE_RESUME, topic)

            state.resume_text = extract_text_from_file(filepath)
            result['resume_text'] = state.resume_text

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

    session_id = str(uuid.uuid4())
    first_question = start_interview_with_resume()

    sessions[session_id] = state

    return jsonify({"session_id": session_id, "question": first_question})


@app.route('/api/answer', methods=['POST'])
def post_answer():
    data = request.json
    session_id = data.get("session_id")
    answer = data.get("answer")

    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404

    state = sessions[session_id]

    evaluation = evaluate_answer(answer)

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
