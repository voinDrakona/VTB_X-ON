import os
import PyPDF2
from docx import Document

def extract_text_from_file(filename):
    _, file_extension = os.path.splitext(filename)
    file_extension = file_extension.lower()
    
    try:
        extractors = {
            '.txt': _extract_txt,
            '.pdf': _extract_pdf,
            '.docx': _extract_docx,
            '.doc': _extract_doc,
            '.rtf': _extract_rtf,
        }
        
        extractor = extractors.get(file_extension, _extract_with_textract)
        return extractor(filename)
        
    except Exception as e:
        return f"Ошибка при обработке файла {filename}: {str(e)}"

def _extract_txt(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        return file.read()

def _extract_pdf(filename):
    text = ""
    with open(filename, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
    return text

def _extract_docx(filename):
    doc = Document(filename)
    return '\n'.join([paragraph.text for paragraph in doc.paragraphs])

def _extract_doc(filename):
    return _extract_with_textract(filename)

def _extract_rtf(filename):
    return _extract_with_textract(filename)

def _extract_with_textract(filename):
    text = textract.process(filename)
    return text.decode('utf-8')

