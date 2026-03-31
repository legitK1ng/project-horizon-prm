"""
Windows Patches — AGENT-3a
Monkeypatches for pyannote.audio to work on Windows without torchcodec.
"""
import sys
import torch
import soundfile as sf
import pyannote.audio.core.io

def _soundfile_load(filepath):
    """Directly loads audio into the shape torchaudio would return, bypassing torchcodec entirely"""
    data, sample_rate = sf.read(filepath, dtype='float32')
    if data.ndim == 1:
        data = data.reshape(-1, 1)
    # sf returns (frames, channels). torchaudio expects (channels, frames)
    waveform = torch.from_numpy(data).T
    # Combine to mono by taking the mean across channels
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    return waveform, sample_rate

class BridgeMetadata:
    def __init__(self, info):
        self.sample_rate = info.sample_rate
        self.duration_seconds_from_header = info.num_frames / info.sample_rate

class BridgeAudioDecoder:
    def __init__(self, audio_arg):
        self.audio_arg = audio_arg
        waveform, sample_rate = _soundfile_load(self.audio_arg)
        class MockInfo:
            def __init__(self, w, s):
                self.sample_rate = s
                self.num_frames = w.shape[1]
        self.metadata = BridgeMetadata(MockInfo(waveform, sample_rate))
    
    def get_all_samples(self):
        waveform, sample_rate = _soundfile_load(self.audio_arg)
        class MockSamples:
            def __init__(self, w, s):
                self.data = w
                self.sample_rate = s
        return MockSamples(waveform, sample_rate)

    def get_samples_played_in_range(self, start, end):
        waveform, sample_rate = _soundfile_load(self.audio_arg)
        class MockSamples:
            def __init__(self, w, s):
                self.data = w
                self.sample_rate = s
        start_frame = int(float(start) * sample_rate)
        end_frame = int(float(end) * sample_rate)
        waveform_slice = waveform[:, start_frame:end_frame]
        return MockSamples(waveform_slice, sample_rate)

def apply_windows_patches():
    if sys.platform == "win32":
        print("[PATCH] Applying Windows audio decoder patches...", flush=True)
        pyannote.audio.core.io.AudioDecoder = BridgeAudioDecoder
