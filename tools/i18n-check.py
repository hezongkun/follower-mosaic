# i18n check: no CJK text in code outside the dictionaries (comments ignored).
import re,sys,glob
CJK=re.compile(r'[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]')
files=[f for pat in ['web/index.html','extension/*.js','extension/*.html','extension/lib/*.js','cli/*.mjs','fetch/fetch-followers.js'] for f in glob.glob(pat)]
skip={'extension/lib/i18n.js','extension/test-extension.mjs','extension/test-overlay.mjs','extension/lib/fonts-data.js'}
bad=0
for f in files:
    if f in skip: continue
    s=open(f).read()
    if f=='web/index.html': s=re.sub(r'/\*XAM-I18N-START\*/.*?/\*XAM-I18N-END\*/','',s,flags=re.S); s=re.sub(r'/\*XAM-FONT-DATA-START\*/.*?/\*XAM-FONT-DATA-END\*/','',s,flags=re.S)
    if f=='fetch/fetch-followers.js': s=re.sub(r'const MSG = \{.*?\n  \};','',s,flags=re.S)
    s=re.sub(r'/\*.*?\*/','',s,flags=re.S)
    for i,l in enumerate(s.split('\n'),1):
        code=re.sub(r'(^|\s)//.*$','',l)
        if CJK.search(code): print(f'{f}:{i}: {l.strip()[:110]}'); bad+=1
print('CJK leftovers:',bad); sys.exit(1 if bad else 0)
