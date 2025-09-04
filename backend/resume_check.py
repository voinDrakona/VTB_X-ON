import os
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
from into_text import extract_text_from_file  # если into_text.py в той же папке cv
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

def analyze_resume(file_path, passing_score=49):
    text = extract_text_from_file(file_path)

    job_description = """Ищем сильного Python-разработчика для работы в области глубокого обучения. Ключевое — уверенное владение основным стеком технологий: Python, библиотеки NumPy и Pandas, а также один из фреймворков — PyTorch или TensorFlow. Опыт работы с полным циклом ML-проекта: от сбора данных и feature engineering до обучения, развертывания и поддержки моделей. Пригодится знание инструментов для контроля версий (Git), контейнеризации (Docker) и мониторинга экспериментов (MLflow, WandB). Важны понимание математических основ ML, умение писать чистый и эффективный код, а также способность самостоятельно искать решения и работать в команде. Наличие реальных проектов и портфолио на GitHub будет большим плюсом."""

    job_embedding = model.encode(job_description, convert_to_tensor=True)
    resume_embedding = model.encode(text, convert_to_tensor=True)

    similarity = util.cos_sim(job_embedding, resume_embedding).item()
    rating = round(similarity * 100, 2)
    passed = rating > passing_score

    data = {
        'score': rating,
        'candidate_name': os.path.basename(file_path),
        'matched_requirements': [],
        'missing_requirements': [],
        'details': text[:200],
        'recommendation': 'Подходит' if passed else 'Не подходит',
        'analysis_date': datetime.now().isoformat()
    }
    print(rating)
    return {
        'success': True,
        'message': 'Резюме принято' if passed else 'Резюме отклонено',
        'passed': passed,
        'data': data,
    }
