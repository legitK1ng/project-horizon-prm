import os
import sys

# Add the current directory to path to import gateway
sys.path.append(os.getcwd())

from gateway.pipeline import _align

class MockSegment:
    def __init__(self, start, end, text):
        self.start = start
        self.end = end
        self.text = text
        self.seek = 100
        self.tokens = [1, 2, 3]
        self.temperature = 0.5
        self.avg_logprob = -0.5
        self.compression_ratio = 1.2
        self.no_speech_prob = 0.1

def test_schema():
    segments = [MockSegment(0.0, 2.0, "Hello world")]
    # Mock diarization as None for simplicity
    diarized, text = _align(segments, None)
    
    expected_fields = ["id", "seek", "start", "end", "text", "tokens", "temperature", "avg_logprob", "compression_ratio", "no_speech_prob"]
    
    print("\n--- Verifying Segment Schema ---")
    seg0 = diarized[0]
    missing = []
    for field in expected_fields:
        if field in seg0:
            print(f"[OK]  {field}: {seg0[field]}")
        else:
            print(f"[ERR] {field} is MISSING")
            missing.append(field)
            
    if missing:
        print(f"\nFAILED: Missing fields {missing}")
        sys.exit(1)
    else:
        print("\nSUCCESS: All OpenAI required fields present.")
        sys.exit(0)

if __name__ == "__main__":
    test_schema()
