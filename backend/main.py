from sanic_ext import Extend
from llama_cpp import Llama
from sanic import Sanic
from sanic.response import json
from sanic.request import Request
from sanic.worker.manager import WorkerManager
from urllib.parse import urlparse
import re
import msgspec
import asyncpg
from dotenv import dotenv_values



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
    config = dotenv_values(".env")
    app.ctx.llm = Llama(model_path='./llama3-antidis-finetuned.gguf', n_gpu_layers=-1)
    app.ctx.db = await asyncpg.create_pool(config["DSN"])
    print("setup!")
    

@app.after_server_stop
async def close(app, loop):
    await app.ctx.db.close()

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

class PushAssignmentRequest(msgspec.Struct):
    class_name: str
    title: str
    due_date: str
    assignment_info: str
    time_to_complete: int

class SignUpRequest(msgspec.Struct):
    name: str

class JoinClassRequest(msgspec.Struct):
    student_name: str
    class_name: str

class FetchAssignmentsRequest(msgspec.Struct):
    student_name: str

@app.route("/sign_up", methods=["POST"])
async def sign_up(request):
    signup_data = msgspec.json.decode(request.body, type=SignUpRequest)

    existing = await app.ctx.db.fetchval(
        "SELECT name FROM students WHERE name = $1",
        signup_data.name
    )
    
    if existing:
        return json({"success": False, "error": "Student already exists"}, status=400)
    
    await app.ctx.db.execute(
        "INSERT INTO students (name, classes, assignments) VALUES ($1, $2, $3)",
        signup_data.name,
        [],  # empty classes
        []   # empty assignments
    )
    
    return json({"success": True, "message": "Student created successfully"})


@app.route("/join_class", methods=["POST"])
async def join_class(request):
    join_data = msgspec.json.decode(request.body, type=JoinClassRequest)
    
    class_exists = await app.ctx.db.fetchval(
        "SELECT name FROM classes WHERE name = $1",
        join_data.class_name
    )
    
    if not class_exists:
        return json({"success": False, "error": "Class doesn't exist"}, status=400)
    
    student_exists = await app.ctx.db.fetchval(
        "SELECT name FROM students WHERE name = $1",
        join_data.student_name
    )
    
    if not student_exists:
        return json({"success": False, "error": "Student doesn't exist"}, status=400)
    
    # Check if student is already in the class
    already_joined = await app.ctx.db.fetchval(
        "SELECT EXISTS(SELECT 1 FROM students WHERE name = $1 AND $2 = ANY(classes))",
        join_data.student_name,
        join_data.class_name
    )
    
    if already_joined:
        return json({"success": False, "error": "Student already in class"}, status=400)
    
    await app.ctx.db.execute(
        "UPDATE students SET classes = array_append(classes, $1) WHERE name = $2",
        join_data.class_name,
        join_data.student_name
    )
    
    # Add student to class members
    await app.ctx.db.execute(
        "UPDATE classes SET members = array_append(members, $1) WHERE name = $2",
        join_data.student_name,
        join_data.class_name
    )
    
    return json({"success": True, "joined": True})
    

@app.route("/fetch_assignments", methods=["POST"])
async def fetch_assignments(request):
    fetch_data = msgspec.json.decode(request.body, type=FetchAssignmentsRequest)
    
    student = await app.ctx.db.fetchrow(
        "SELECT assignments, classes FROM students WHERE name = $1",
        fetch_data.student_name
    )
    
    if not student:
        return json({"success": False, "error": "Student not found"}, status=404)
    
    # Store assignments by class
    assignments_by_class = {class_name: [] for class_name in student['classes']}
    
    # Parse each assignment and organize by class
    for assignment_json in student['assignments']:
        assignment = msgspec.json.decode(assignment_json.encode(), type=dict)
        
        simple_assignment = {
            "title": assignment["title"],
            "due_date": assignment["due_date"],
            "assignment_info": assignment["assignment_info"],
            "time_to_complete": assignment["time_to_complete"]
        }
        
        # Add assignment to all classes the student is in
        for class_name in student['classes']:
            assignments_by_class[class_name].append(simple_assignment)
    
    return json({
        "success": True,
        "assignments": assignments_by_class
    })


@app.route("/push_assignment", methods=["POST"])
async def push_assignment(request):
    assign = msgspec.json.decode(request.body, type=PushAssignmentRequest)
    
    assignment_json = msgspec.json.encode({
        "title": assign.title,
        "due_date": assign.due_date,
        "assignment_info": assign.assignment_info,
        "time_to_complete": assign.time_to_complete
    }).decode('utf-8')
    
    students = await app.ctx.db.fetch("SELECT name FROM students WHERE $1 = ANY(classes);", assign.class_name)
    
    # Add the new assignment to their assignments array
    for student in students:
        await app.ctx.db.execute(
            "UPDATE students SET assignments = array_append(assignments, $1) WHERE name = $2",
            assignment_json,
            student['name']
        )
    
    return json({"success": True, "students_updated": len(students)})
    
class CreateClassRequest(msgspec.Struct):
    class_name: str

class ListClassesResponse(msgspec.Struct):
    classes: list[dict]

@app.route("/create_class", methods=["POST"])
async def create_class(request):
    class_data = msgspec.json.decode(request.body, type=CreateClassRequest)
    
    existing = await app.ctx.db.fetchval(
        "SELECT name FROM classes WHERE name = $1",
        class_data.class_name
    )
    
    if existing:
        return json({"success": False, "error": "Class already exists"}, status=400)
    
    await app.ctx.db.execute(
        "INSERT INTO classes (name, members) VALUES ($1, $2)",
        class_data.class_name,
        []  # empty members list
    )
    
    return json({"success": True, "message": "Class created successfully"})

@app.route("/list_classes", methods=["GET"])
async def list_classes(request):
    classes = await app.ctx.db.fetch("SELECT name, members FROM classes")
    
    class_list = [
        {
            "name": cls["name"],
            "student_count": len(cls["members"])
        }
        for cls in classes
    ]
    
    return json({
        "success": True,
        "classes": class_list
    })

@app.route("/class_assignments/<class_name>", methods=["GET"])
async def class_assignments(request, class_name):
    class_name = class_name.replace("%20", " ")
    students = await app.ctx.db.fetchrow(
        "SELECT members FROM classes WHERE name = $1",
        class_name
    )
    
    if not students:
        return json({"success": False, "error": "Class not found"}, status=404)
    
    assignments_data = await app.ctx.db.fetch(
        "SELECT name, assignments FROM students WHERE name = ANY($1)",
        students["members"]
    )
    
    all_assignments = []
    for student in assignments_data:
        for assignment_json in student["assignments"]:
            assignment = msgspec.json.decode(assignment_json.encode(), type=dict)
            assignment["student_name"] = student["name"]
            all_assignments.append(assignment)
    
    # Sort assignments by due date
    sorted_assignments = sorted(all_assignments, key=lambda x: x["due_date"], reverse=True)
    
    return json({
        "success": True,
        "assignments": sorted_assignments
    })


@app.route("/class_students/<class_name>", methods=["GET"])
async def class_students(request, class_name):
    class_name = class_name.replace("%20", " ")
    class_data = await app.ctx.db.fetchrow(
        "SELECT members FROM classes WHERE name = $1",
        class_name
    )
    
    if not class_data:
        return json({"success": False, "error": "Class not found"}, status=404)
    
    return json({
        "success": True,
        "students": class_data["members"]
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8082, workers=4)