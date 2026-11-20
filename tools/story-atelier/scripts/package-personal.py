"""Build the personal download from an explicit allowlist, never from user data."""
from pathlib import Path
import json
import zipfile

project = Path(__file__).resolve().parent.parent
version = json.loads((project / 'package.json').read_text())['version']
root = f'GLHF_Story_Atelier_Personal_V{version}'
destination = project / 'offline' / f'Story_Atelier_Personal_V{version}.zip'
files = [
    ('offline/Story_Atelier_Offline.html', 'Story_Atelier_Offline.html'),
    ('offline/local-writer.mjs', 'local-writer.mjs'),
    ('offline/openai-agent.mjs', 'openai-agent.mjs'),
    ('offline/chatgpt-plan.mjs', 'chatgpt-plan.mjs'),
    ('offline/chatgpt-responses.mjs', 'chatgpt-responses.mjs'),
    ('offline/start-personal.mjs', 'start-personal.mjs'),
    ('offline/Start_Personal_Writer.cmd', 'Start_Personal_Writer.cmd'),
    ('offline/启动叙事工坊.cmd', '启动叙事工坊.cmd'),
    ('offline/Start_Personal_Writer.command', 'Start_Personal_Writer.command'),
    ('offline/个人版使用说明.txt', '先读我_个人版使用说明.txt'),
    ('examples/story/Clue_Counter.json', '示例/失物招领处.json'),
    ('examples/story/Clue_Counter_Reader.html', '示例/失物招领处_阅读版.html'),
]
for source, _ in files:
    if not (project / source).is_file():
        raise FileNotFoundError(source)
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for source, target in files:
        data = (project / source).read_bytes()
        if target.endswith('.cmd'):
            data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        entry = zipfile.ZipInfo(f'{root}/{target}')
        entry.create_system = 3
        entry.external_attr = (0o100755 if target.endswith('.command') else 0o100644) << 16
        bundle.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
print(destination)
