import uuid
from qdrant_client import models
from fastembed import TextEmbedding
from Qdrant.Client import client  # Import your existing cloud connection
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

class ResearcherAgent:
    def __init__(self):
        self.client = client
        self.llm = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.collection = "Knowledge_Base"
        # FastEmbed is lightweight and runs locally on CPU
        self.encoder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        self._ensure_collection()

    def _ensure_collection(self):
        """Creates the text collection if it doesn't exist."""
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=models.VectorParams(
                    size=384,  # bge-small uses 384 dimensions
                    distance=models.Distance.COSINE
                )
            )
            print(f"📚 Created knowledge base: {self.collection}")

    def ingest_text(self, text: str, source: str = "Manual"):
        """Saves a chunk of text (e.g., from a PDF) into memory."""
        # Embed the text
        embedding = list(self.encoder.embed([text]))[0]
        
        # Upload to Qdrant
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding.tolist(),
                    payload={"text": text, "source": source}
                )
            ]
        )

    def search(self, query: str, limit: int = 3) -> str:
        """Retrieves relevant textbook pages and formats them as a string."""
        # 1. Convert query to vector
        query_vec = list(self.encoder.embed([query]))[0]
        
        # 2. Search Qdrant
        # CRITICAL FIX: Added 'with_payload=True' so we actually get the text back
        response = self.client.query_points(
            collection_name=self.collection,
            query=query_vec,
            limit=limit,
            with_payload=True 
        )

        hits = response.points

        # 3. Format as a single string (better for LLM Context)
        if not hits:
            return "No specific scientific manuals found for this issue."
            
        return "\n\n".join([
            f"[Source: {hit.payload.get('source', 'Unknown')}]\n{hit.payload.get('text', '')}" 
            for hit in hits
        ])