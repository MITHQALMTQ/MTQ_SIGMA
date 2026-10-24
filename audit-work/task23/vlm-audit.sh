#!/bin/bash
# VLM audit helper: $1 = output name, $2 = prompt, rest = images
out=$1; prompt=$2; shift 2
z-ai vision -p "$prompt" "$@" -o "$out" 2>/dev/null
python3 -c "
import json
d=json.load(open('$out'))
c=d.get('choices',[{}])[0].get('message',{}).get('content','') if isinstance(d,dict) and 'choices' in d else (d.get('content','') if isinstance(d,dict) else str(d))
print(c)"
