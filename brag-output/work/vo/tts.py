import sys, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro('/tmp/claude-0/tts/kokoro-v1.0.onnx', '/tmp/claude-0/tts/voices-v1.0.bin')
LINES = {
 'l1': "Someone's climbing the racking.",
 'l2': "With Zeus Protect, anyone can report it from their phone. What they saw, where, and how urgent.",
 'l3': "And it lands straight on the health and safety manager's dashboard.",
 'l4': "Training, fire safety, COSHH, risk assessments, equipment. One hub for the whole job.",
 'l5': "Zeus Protect. Spot it. Report it. Sorted.",
}
voice = sys.argv[1]; speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
for key, text in LINES.items():
    s, sr = k.create(text, voice=voice, speed=speed, lang='en-gb')
    sf.write(f'{voice}_{key}.wav', s, sr)
    print(voice, key, round(len(s)/sr, 2))
