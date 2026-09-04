"""Bounded file validation; deliberately not a malware-scanning claim."""
from io import BytesIO
import zipfile
from PIL import Image

MAX_BYTES = 10 * 1024 * 1024
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
EXTENSIONS = {'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','text/plain':'.txt',DOCX:'.docx'}


def validate_document(content, declared_type):
    if not content or len(content)>MAX_BYTES: raise ValueError('Files must contain data and be 10 MB or smaller.')
    declared_type=(declared_type or '').split(';',1)[0].lower()
    detected=None
    if content.startswith(b'%PDF-'):
        detected='application/pdf'
        if any(marker in content for marker in [b'/JavaScript',b'/JS ',b'/Launch',b'/EmbeddedFile',b'/OpenAction',b'/RichMedia']):
            raise ValueError('Active or embedded PDF content is not supported.')
        if b'%%EOF' not in content[-4096:]: raise ValueError('Invalid PDF file.')
    elif content.startswith((b'\x89PNG\r\n\x1a\n',b'\xff\xd8\xff',b'RIFF')):
        with Image.open(BytesIO(content)) as picture:
            if picture.width*picture.height>25_000_000: raise ValueError('Image dimensions are too large.')
            detected={'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}.get(picture.format)
            picture.verify()
    elif content.startswith(b'PK\x03\x04'):
        with zipfile.ZipFile(BytesIO(content)) as package:
            files=package.infolist(); names={f.filename for f in files}
            if len(files)>500 or sum(f.file_size for f in files)>50*1024*1024: raise ValueError('Document archive exceeds limits.')
            if not {'[Content_Types].xml','word/document.xml'}.issubset(names): raise ValueError('Unsupported archive.')
            for f in files:
                if f.flag_bits & 1 or '..' in f.filename.split('/') or f.filename.startswith('/') or '\\' in f.filename:
                    raise ValueError('Unsafe document archive.')
                if any(x in f.filename.lower() for x in ['vbaproject','embeddings/','activex/']): raise ValueError('Active document content is not supported.')
                if f.filename.endswith('.rels') and b'TargetMode="External"' in package.read(f): raise ValueError('External document references are not supported.')
            detected=DOCX
    else:
        try:
            text=content.decode('utf-8')
            if any(ord(c)<32 and c not in '\r\n\t' for c in text): raise ValueError('Binary data is not a text document.')
            detected='text/plain'
        except UnicodeDecodeError:
            raise ValueError('Unsupported file content. Use PDF, an image, text, or DOCX.')
    if not detected or declared_type not in {detected,'application/octet-stream',''}: raise ValueError('The file content does not match its declared type.')
    return detected


def scan_document(content, content_type):
    """Integration point for a future isolated scanner. No external transmission.

    Validation plus private storage and attachment-only handling are current
    safeguards, not proof that arbitrary uploaded documents are malware-free.
    """
    return None


def normalize_avatar(content):
    """Decode and re-encode an actual raster image; strip EXIF and active data."""
    if not content or len(content)>5*1024*1024: raise ValueError('Image must be 5 MB or smaller')
    with Image.open(BytesIO(content)) as picture:
        if picture.format not in {'PNG','JPEG','WEBP'} or picture.width*picture.height>25_000_000:
            raise ValueError('Use a bounded PNG, JPEG or WebP image')
        out=BytesIO()
        picture.convert('RGBA').save(out,format='PNG')
        result=out.getvalue()
    if len(result)>5*1024*1024: raise ValueError('Decoded image exceeds size limit')
    return result


def validate_audio(content, declared):
    """Container signatures, not a claim of full media/malware validation."""
    if not content or len(content)>25*1024*1024: raise ValueError('Audio must be 25 MB or smaller')
    detected = (content.startswith((b'ID3',b'OggS',b'fLaC',b'\x1aE\xdf\xa3')) or
        content[:4]==b'RIFF' and content[8:12]==b'WAVE' or content[4:8]==b'ftyp' or
        len(content)>2 and content[0]==255 and content[1]&224==224)
    if not detected: raise ValueError('Unsupported audio container')
    return content
