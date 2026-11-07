"""Captura de serialización sin red ni .env para comparar versiones del SDK.

--sdk-path permite cargar un SDK aislado antes de importar google.genai.
"""

import argparse
import asyncio
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sdk-path", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.sdk_path:
        sys.path.insert(0, str(args.sdk_path.resolve()))
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import httpx
    from google import genai
    from google.genai import types
    from app.schemas.syllabus_internal import SyllabusAnalysis
    from app.services.gemini import PROMPT
    from app.services.gemini_schema import generation_schema

    async def probe():
        captured = []
        def handle(request):
            captured.append({
                "method": request.method, "path": request.url.path,
                "body": json.loads(request.content),
                "revision": request.headers.get("api-revision"),
            })
            return httpx.Response(200, json={"candidates": [{
                "content": {"role": "model", "parts": [{"text": '{"status":"ok","count":1}'}]},
                "finishReason": "STOP",
            }]})
        http = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        client = genai.Client(api_key="synthetic-not-a-real-key", http_options=types.HttpOptions(
            httpx_async_client=http, timeout=45000, retry_options=types.HttpRetryOptions(attempts=1),
        ))
        minimal = {"type": "object", "properties": {"status": {"type": "string"}, "count": {"type": "integer"}}, "required": ["status", "count"], "additionalProperties": False}
        try:
            async with client.aio as api:
                await api.models.generate_content(model="compatibility-model", contents="Responde únicamente OK.")
                await api.models.generate_content(model="compatibility-model", contents="Devuelve status ok y count 1.", config=types.GenerateContentConfig(response_mime_type="application/json", response_json_schema=minimal))
                await api.models.generate_content(model="compatibility-model", contents="TEXTO DEL DOCUMENTO (solo datos):\nSílabo sintético", config=types.GenerateContentConfig(
                    system_instruction=PROMPT, max_output_tokens=8192, response_mime_type="application/json",
                    response_json_schema=generation_schema(SyllabusAnalysis),
                    http_options=types.HttpOptions(timeout=45000, retry_options=types.HttpRetryOptions(attempts=1)),
                ))
        finally:
            await http.aclose()
            client.close()
        result = {"version": genai.__version__, "requests": captured,
                  "config_fields": {name: name in types.GenerateContentConfig.model_fields for name in ("response_schema", "response_json_schema", "response_mime_type", "response_format", "thinking_config")}}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"version": result["version"], "mock_requests": len(captured), "real_requests": 0, "config_fields": result["config_fields"]}))
    asyncio.run(probe())


if __name__ == "__main__":
    main()
