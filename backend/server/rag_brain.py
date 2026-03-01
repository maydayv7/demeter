import sys
import os
import uuid
import pypdf
from qdrant_client import models
from fastembed import TextEmbedding

# --- PATH FIX: Add project root to system path ---
# This ensures we can import your 'Qdrant.Client' connection
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../'))
sys.path.append(project_root)
# -------------------------------------------------

from Qdrant.Client import client  # Uses your existing Cloud connection

# --- CONFIGURATION ---
COLLECTION_NAME = "Knowledge_Base"
VECTOR_SIZE = 384  # Standard size for 'bge-small-en-v1.5'
DOCS_FOLDER = os.path.join(project_root, "Knowledge_Base") # <--- Folder Name

def init_collection():
    """
    Creates the collection if it doesn't exist.
    """
    if client.collection_exists(COLLECTION_NAME):
        print(f"ℹ️  Collection '{COLLECTION_NAME}' already exists. Appending data...")
    else:
        print(f"🔨 Creating new collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE, 
                distance=models.Distance.COSINE
            )
        )
        print("✅ Collection created.")

def extract_text_from_pdf(pdf_path):
    """
    Reads a PDF file page by page and returns the full text.
    """
    text = ""
    try:
        reader = pypdf.PdfReader(pdf_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"❌ Error reading PDF {pdf_path}: {e}")
    return text

def chunk_text(text, chunk_size=500, overlap=50):
    """
    Splits long text into smaller overlapping pieces.
    Overlap helps preserve context between chunks.
    """
    if not text:
        return []
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size - overlap)]

def ingest_docs():
    # 1. Setup Collection & Model
    init_collection()
    
    print("🧠 Loading Embedding Model (bge-small-en)...")
    # This runs locally on your CPU (Fast & Free)
    model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    
    # 2. Check if folder exists
    if not os.path.exists(DOCS_FOLDER):
        os.makedirs(DOCS_FOLDER)
        print(f"⚠️ Created folder '{DOCS_FOLDER}'. Please put your PDFs there and run this script again!")
        return

    # 3. Scan for files
    files = [f for f in os.listdir(DOCS_FOLDER) if f.endswith(('.pdf', '.txt'))]
    if not files:
        print(f"📭 No files found in '{DOCS_FOLDER}'. Add some PDFs!")
        return

    print(f"📚 Found {len(files)} documents. Starting ingestion...")
    total_chunks = 0

    for file_name in files:
        file_path = os.path.join(DOCS_FOLDER, file_name)
        print(f"   📄 Processing: {file_name}")

        # A. Extract Text
        content = ""
        if file_name.endswith('.pdf'):
            content = extract_text_from_pdf(file_path)
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

        if not content.strip():
            print(f"      ⚠️ Skipping empty file.")
            continue

        # B. Chunk Text
        chunks = chunk_text(content)
        if not chunks:
            continue
            
        # C. Convert to Vectors (Embed)
        # FastEmbed handles the list of strings automatically
        embeddings = list(model.embed(chunks))

        # D. Prepare Points for Qdrant
        points = []
        for i, (text_chunk, vector) in enumerate(zip(chunks, embeddings)):
            points.append(models.PointStruct(
                id=str(uuid.uuid4()),  # Generate a random ID for this chunk
                vector=vector.tolist(),
                payload={
                    "text": text_chunk,
                    "source": file_name,
                    "chunk_id": i
                }
            ))

        # E. Upload Batch
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        total_chunks += len(points)
        print(f"      ✅ Uploaded {len(points)} chunks.")

    print(f"\n🎉 Success! Knowledge Base now contains {total_chunks} searchable segments.")

if __name__ == "__main__":
    ingest_docs()