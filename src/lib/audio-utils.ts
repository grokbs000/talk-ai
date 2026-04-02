export class AudioRecorder {
  private audioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onDataCallback: ((base64Data: string) => void) | null = null;

  constructor(sharedContext: AudioContext) {
    this.audioContext = sharedContext;
  }

  async start(onData: (base64Data: string) => void) {
    this.onDataCallback = onData;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const inputSampleRate = this.audioContext!.sampleRate;
      
      let pcm16: Int16Array;
      
      if (inputSampleRate === 16000) {
        pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
      } else {
        // Downsample to 16000 Hz using linear interpolation
        const ratio = inputSampleRate / 16000;
        const newLength = Math.floor(inputData.length / ratio);
        pcm16 = new Int16Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const dataIndex = i * ratio;
          const indexFloor = Math.floor(dataIndex);
          const indexCeil = Math.min(inputData.length - 1, indexFloor + 1);
          const weight = dataIndex - indexFloor;
          
          // Linear interpolation
          const interpolated = inputData[indexFloor] * (1 - weight) + inputData[indexCeil] * weight;
          let s = Math.max(-1, Math.min(1, interpolated));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
      }

      // Convert to base64
      const buffer = new ArrayBuffer(pcm16.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(i * 2, pcm16[i], true); // little endian
      }

      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      if (this.onDataCallback) {
        this.onDataCallback(base64);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    // We do NOT close the shared audioContext here
    this.onDataCallback = null;
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private unlockNode: AudioBufferSourceNode | null = null;

  init() {
    if (!this.audioContext) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        // Play a silent buffer to truly unlock mobile audio on interaction
        const buffer = this.audioContext.createBuffer(1, 1, 24000);
        this.unlockNode = this.audioContext.createBufferSource();
        this.unlockNode.buffer = buffer;
        this.unlockNode.connect(this.audioContext.destination);
        this.unlockNode.start(0);

        this.nextPlayTime = this.audioContext.currentTime;
      } catch (e) {
        console.error("Failed to initialize AudioContext", e);
      }
    }
  }

  resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(console.error);
    }
  }

  getAudioContext() {
    return this.audioContext;
  }

  playBase64(base64: string) {
    if (!this.audioContext) return;

    // Aggressively try to resume context on iOS exactly when audio needs to play
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(console.error);
    }

    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // PCM 16-bit little endian
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      let currentTime = this.audioContext.currentTime;
      // Add a tiny buffer (50ms) to prevent stutter on mobile due to execution delays
      if (this.nextPlayTime < currentTime + 0.05) {
        this.nextPlayTime = currentTime + 0.05;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (e) {
      console.error("Failed to play audio chunk:", e);
    }
  }

  stop() {
    this.nextPlayTime = this.audioContext ? this.audioContext.currentTime : 0;
  }
}

export const globalAudioPlayer = new AudioPlayer();
