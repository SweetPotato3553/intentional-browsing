"""Check source/assets and produce a versioned verification manifest after tests."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess

project = Path(__file__).resolve().parents[1]
ext = project / 'extension'
node = shutil.which('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
for file in list(ext.glob('*.js')) + list((project/'tests').glob('*.cjs')):
    subprocess.run([node, '--check', str(file)], check=True)
for file in ext.rglob('*.json'):
    if '_metadata' not in file.parts:
        json.loads(file.read_text(encoding='utf-8'))
manifest=json.loads((ext/'manifest.json').read_text(encoding='utf-8'))
assert manifest['version']=='1.0.0'
assert json.loads((project/'package.json').read_text())['version']==manifest['version']
assert set(manifest['permissions'])=={'storage','alarms','declarativeNetRequestWithHostAccess'}
assert len(manifest['host_permissions'])==6
assert manifest['web_accessible_resources'][0]['resources']==['bilibili.html','xiaohongshu.html']
assert "frame-ancestors 'none'" in manifest['content_security_policy']['extension_pages']
assets=[manifest['background']['service_worker'],manifest['action']['default_popup']]
for script in manifest['content_scripts']:
    assets+=script['js']+script['css']
    assert script['js'].index('route.js')<script['js'].index('theme.js')
for file in ext.glob('*.html'):
    assets+=re.findall(r'(?:src|href)="([^":?#]+\.(?:js|css))"',file.read_text(encoding='utf-8'))
for asset in assets:
    assert (ext/asset).is_file(),asset
rules=json.loads((ext/'rules.json').read_text())
assert len(rules)==2 and all(r['action']['type']=='redirect' for r in rules)
assert re.fullmatch(rules[1]['condition']['regexFilter'],'https://www.xiaohongshu.com/explore?focus_login=1')
assert 'mode: "open"' not in (ext/'guard.js').read_text(encoding='utf-8')
reports={}
names=['release-results.json','theme-results.json','friend-results.json','reliability-results.json']
names += [f'{suite}-{theme}.json' for theme in ['zen','playful','friend'] for suite in ['native-login','floating-toolbar']]
for name in names:
    report=json.loads((project/'tests/artifacts'/name).read_text(encoding='utf-8'))
    assert report['status']=='passed',name
    reports[name]=len(report['results'])
checksums={f.relative_to(ext).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(ext.rglob('*')) if f.is_file() and '_metadata' not in f.parts}
summary={'version':manifest['version'],'date':'2026-10-28','status':'passed','scenarios':sum(reports.values()),'reports':reports,'extension_sha256':checksums,'scope':'Isolated Edge, mocked websites; production closed-shadow release tests; instrumented UI/fault test copies. No live account sign-in or store publication.'}
(project/'VERIFICATION.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"PASS static verification; {summary['scenarios']} browser scenarios; wrote VERIFICATION.json")
