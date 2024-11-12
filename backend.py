from typing import Union
from sanic_ext import Extend
from llama_cpp import Llama
from sanic import Sanic
from sanic.response import json
from sanic.response import text
from sanic.request import Request
from sanic.worker.manager import WorkerManager
from urllib.parse import urlparse
import re

def get_res(llama: Llama, query: str, intent: str) -> bool:
    output = llama.create_chat_completion(
        messages = [
            {"role": "system", "content": "You are an assistant that helps people stay on task."},
            {"role": "user", "content": f"""I'm giving you someone's search query as well as their intended productive task. You are to reply with 'YES' if the search query is on task, and 'NO' if it's not Be very strict. Search query: "{query}", intended task: "{intent}". Verdict:"""}
        ],
        max_tokens=48,
        stop=['.', '\n'],
    )
    text = output['choices'][0]['message']['content']
    print(text)
    res = text.replace(' ', '').replace('.', '').replace("'", '').replace(':', '').lower()          

    print(res)
    if res == 'yes' or res[:3] == 'yes':
        return True
    elif res == 'no' or res[:2] == 'no':
        return False

    print(f'failed to get a good response, raw output: {output}')
    raise RuntimeError('couldnt get a good response from model')
    

WorkerManager.THRESHOLD = 600  # Value is in 0.1s
app = Sanic('antidis')
app.config.CORS_ORIGINS = "*"
app.config.CORS_SEND_WILDCARD = True
Extend(app)

cors_headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}


@app.before_server_start
async def init(app, loop):
    app.ctx.llm = Llama(model_path='./llama3-antidis-finetuned.gguf', n_gpu_layers=-1)
    

@app.after_server_stop
async def close(app, loop):
    pass

def re_extract_query(url: str) -> str:
    match = re.search(r'[?&](q(?:uery)?=[^&]*)', url)
    if match:
        query_param = match.group(1)
        query_value = re.sub(r'\+', ' ', query_param.split('=')[1])
        return query_value
    
    # attempt to match wikipedia
    match = re.search(r'https://(?:[a-zA-Z-]+)\.wikipedia\.org/wiki/([^#/]+)', url)
    if match and match.group(1):
        return match.group(1).replace('_', ' ')

    # extract host+
    parsed = urlparse(url)
    host = parsed.netloc
    if host != '':
        return host.replace('www.', '')
    raise RuntimeError('could not extract query')


@app.route('/antidis', methods=['POST'])
async def antidis(request: Request):
    if not request.json:
        return json({'error': 'no json body'}, status=400, headers=cors_headers)

    query = ''
    try:
        query = re_extract_query(request.json['url'])
    except (KeyError, RuntimeError):
        return json({'error': 'could not extract url'}, status=400, headers=cors_headers)
    
    intent = ''
    try:
        intent = request.json['intent']
    except KeyError:
        return json({'error': 'could not extract intent'}, status=400, headers=cors_headers)
    
    print(f'query: {query}, intent: {intent}')
    try:
        return json({'result': get_res(app.ctx.llm, query, intent)}, headers=cors_headers)
    except RuntimeError:
        return json({'error': 'could not get good response from model'}, status=400, headers=cors_headers)


@app.route('/antidis', methods=['OPTIONS'])
async def handle_options(request):
    response = json({"message": "preflight request handled"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8082, workers=1)    # we can't use more than 1 worker because otherwise it will instantiate multiple llama models
