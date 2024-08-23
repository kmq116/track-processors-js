import ProcessorAudioWrapper from './ProcessorAudioWrapper';
import ProcessorWrapper from './ProcessorWrapper';
import AudioInsertTransformer from './transformers/AudioInsertTransformer';
import BackgroundTransformer, {
  BackgroundOptions,
  SegmenterOptions,
} from './transformers/BackgroundTransformer';

export * from './transformers/types';
export { default as VideoTransformer } from './transformers/VideoTransformer';
export { ProcessorWrapper, type BackgroundOptions, type SegmenterOptions, BackgroundTransformer };

export const BackgroundBlur = (blurRadius: number = 10, segmenterOptions?: SegmenterOptions) => {
  return BackgroundProcessor({ blurRadius, segmenterOptions }, 'background-blur');
};

export const VirtualBackground = (imagePath: string, segmenterOptions?: SegmenterOptions) => {
  return BackgroundProcessor({ imagePath, segmenterOptions }, 'virtual-background');
};

export const BackgroundProcessor = (options: BackgroundOptions, name = 'background-processor') => {
  // console.log('初始化 函数BackgroundProcessor', ProcessorWrapper);

  const isProcessorSupported = ProcessorWrapper.isSupported && BackgroundTransformer.isSupported;
  if (!isProcessorSupported) {
    throw new Error('processor is not supported in this browser');
  }
  // console.log('初始化 函数BackgroundProcessor', { options, name });
  const processor = new ProcessorWrapper(new BackgroundTransformer(options), name);
  return processor;
};

export const AudioInsert = (options: any, name = 'audio-processor') => {
  console.log('初始化 函数AudioInsert', { options, name });
  const processor = new ProcessorAudioWrapper(options, name);
  return processor;
};
