from pathlib import Path
import subprocess, shutil, sys
root=Path(__file__).resolve().parents[1]; out=root/'research/dist'
if out.exists(): shutil.rmtree(out)
out.mkdir()
subprocess.run([sys.executable,'-m','pip','install','-r',str(root/'research/requirements.txt'),'--target',str(out),'--platform','manylinux2014_x86_64','--implementation','cp','--python-version','3.12','--only-binary=:all:'],check=True)
shutil.copy(root/'research/handler.py',out/'handler.py')
shutil.copytree(root/'research/vendor',out/'vendor',ignore=shutil.ignore_patterns('__pycache__'))
