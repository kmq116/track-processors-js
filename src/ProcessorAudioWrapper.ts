import type { ProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import { TrackTransformer } from './transformers';

let backgroundMusic: any;
let musicOffset = 0;
let mixBuffer: Float32Array; // 预分配混音缓冲区
let abortController;
let processedStream;
let audio;
export default class ProcessorAudioWrapper<TransformerOptions extends Record<string, unknown>>
  implements TrackProcessor<Track.Kind>
{
  static get isSupported() {
    return (
      typeof MediaStreamTrackGenerator !== 'undefined' &&
      typeof MediaStreamTrackProcessor !== 'undefined'
    );
  }

  name: string;

  source?: MediaStreamVideoTrack;

  sourceSettings?: MediaTrackSettings;

  processor?: MediaStreamTrackProcessor<VideoFrame>;

  trackGenerator?: MediaStreamTrackGenerator<VideoFrame>;

  canvas?: OffscreenCanvas;

  sourceDummy?: HTMLMediaElement;

  processedTrack?: MediaStreamTrack;

  transformer: TrackTransformer<TransformerOptions>;

  context: AudioContext;

  constructor(transformer: TrackTransformer<TransformerOptions>, name: string) {
    this.name = name;
    // this.transformer = transformer;
    // this.transformer.restart;
  }

  // 加载背景音乐

  async init(opts: ProcessorOptions<Track.Kind>) {
    audio = document.getElementById('audioOutput');

    const { track, audioContext } = opts;

    if (!audioContext) {
      throw new Error('需要提供 AudioContext');
    }
    const processor = new MediaStreamTrackProcessor(track);
    const generator = new MediaStreamTrackGenerator('audio');
    console.log({ generator });

    const source = processor.readable;
    const sink = generator.writable;
    await loadBackgroundMusic('/test.mp3');
    processedStream = new MediaStream();
    processedStream.addTrack(generator);
    console.log({ processedStream });
    console.log(processedStream.getAudioTracks());
    // processedStream.getAudioTracks()[0].start();
    this.processedTrack = processedStream.getAudioTracks()[0];
    audio!.srcObject = processedStream;
    await audio!.play();

    const transformer = new TransformStream({ transform: mixAudioWithBackgroundMusic() });
    abortController = new AbortController();
    const signal = abortController.signal;
    console.log({ source });
    const promise = source.pipeThrough(transformer, { signal }).pipeTo(sink);
    promise.catch((e) => {
      if (signal.aborted) {
        console.log('Shutting down streams after abort.');
      } else {
        console.error('Error from stream transform:', e);
      }
      source.cancel(e);
      sink.abort(e);
    });

    function mixAudioWithBackgroundMusic() {
      const format = 'f32-planar';
      const micGain = 0.8;
      const musicGain = 0.2;

      return (data, controller) => {
        const nChannels = data.numberOfChannels;
        const nFrames = data.numberOfFrames;

        // 懒初始化混音缓冲区
        if (!mixBuffer || mixBuffer.length !== nFrames * nChannels) {
          mixBuffer = new Float32Array(nFrames * nChannels);
        }

        for (let c = 0; c < nChannels; c++) {
          const offset = nFrames * c;
          const samples = mixBuffer.subarray(offset, offset + nFrames);
          data.copyTo(samples, { planeIndex: c, format });

          if (backgroundMusic) {
            const musicChannel =
              backgroundMusic.channelData[c % backgroundMusic.channelData.length];
            const musicLength = backgroundMusic.length;

            for (let i = 0; i < nFrames; i++) {
              const musicIndex = (musicOffset + i) % musicLength;
              samples[i] = samples[i] * micGain + musicChannel[musicIndex] * musicGain;
            }
          }
        }

        if (backgroundMusic) {
          musicOffset = (musicOffset + nFrames) % backgroundMusic.length;
        }

        controller.enqueue(
          new AudioData({
            format,
            sampleRate: data.sampleRate,
            numberOfFrames: nFrames,
            numberOfChannels: nChannels,
            timestamp: data.timestamp,
            data: mixBuffer,
          }),
        );
      };
    }

    // // 创建 MediaStreamAudioSourceNode
    // const sourceNode = audioContext.createMediaStreamSource(new MediaStream([track]));

    // // 创建 GainNode 用于控制原始音频音量
    // const sourceGain = audioContext.createGain();
    // sourceGain.gain.value = 0.7; // 设置原始音频音量为 70%

    // // 创建 GainNode 用于控制背景音乐音量
    // const bgMusicGain = audioContext.createGain();
    // bgMusicGain.gain.value = 0.3; // 设置背景音乐音量为 30%

    // // 创建 AudioDestinationNode
    // const destination = audioContext.createMediaStreamDestination();

    // // 连接节点
    // sourceNode.connect(sourceGain);
    // sourceGain.connect(destination);

    // // 加载并播放背景音乐
    // try {
    //   const bgMusicBuffer = await this.loadBackgroundMusic(
    //     audioContext,
    //     'https://localhost:8080/test.mp3',
    //   );
    //   this.backgroundMusic = audioContext.createBufferSource();
    //   this.backgroundMusic.buffer = bgMusicBuffer;
    //   this.backgroundMusic.loop = true; // 循环播放背景音乐
    //   this.backgroundMusic.connect(bgMusicGain);
    //   bgMusicGain.connect(destination);
    //   this.backgroundMusic.start();
    // } catch (error) {
    //   console.error('加载背景音乐失败:', error);
    // }

    // // 创建 MediaStreamTrackGenerator
    // const generator = new MediaStreamTrackGenerator({ kind: 'audio' });

    // // 创建 AudioTrackProcessor
    // const processor = new AudioTrackProcessor(destination.stream.getAudioTracks()[0]);

    // // 连接处理器和生成器
    // processor.readable
    //   .pipeTo(generator.writable)
    //   .catch((e) => console.error('音频处理管道错误', e));

    // this.processedTrack = generator;

    // console.log('音频处理器初始化完成，已添加背景音乐');
    // this.processedTrack = this.trackGenerator as MediaStreamVideoTrack;
  }

  async restart(opts: ProcessorOptions<Track.Kind>) {
    await this.destroy();
    return this.init(opts);
  }

  async restartTransformer(...options: Parameters<(typeof this.transformer)['restart']>) {
    // @ts-ignore unclear why the restart method only accepts VideoTransformerInitOptions instead of either those or AudioTransformerInitOptions
    this.transformer.restart(options[0]);
  }

  async updateTransformerOptions(...options: Parameters<(typeof this.transformer)['update']>) {
    this.transformer.update(options[0]);
  }

  async destroy() {
    await this.transformer.destroy();
    this.trackGenerator?.stop();
  }
}

async function loadBackgroundMusic(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    backgroundMusic = {
      sampleRate: audioBuffer.sampleRate,
      channelData: channelData,
      length: audioBuffer.length,
    };
  } catch (error) {
    console.error('加载背景音乐时出错:', error);
  }
}
