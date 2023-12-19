import * as path from 'path';
import { getComfyUIDir } from "../utils/get-appdata-dir";
import { FolderPaths, MarketModel, ModelExt, ModelType } from './types';

export const supported_pt_extensions: ModelExt[] = ['.ckpt', '.pt', '.bin', '.pth', '.safetensors'];

export function getFolderNamesAndPaths() {
  const BASE_PATH = getComfyUIDir();
  const MODELS_DIR = `${BASE_PATH}/models`;
  const FOLDER_NAMES_AND_PATHS: FolderPaths = {
    checkpoints: [[`${MODELS_DIR}/checkpoints`], supported_pt_extensions],
    configs: [[`${MODELS_DIR}/configs`], ['.yaml']],
    loras: [[`${MODELS_DIR}/loras`], supported_pt_extensions],
    vae: [[`${MODELS_DIR}/vae`], supported_pt_extensions],
    clip: [[`${MODELS_DIR}/clip`], supported_pt_extensions],
    unet: [[`${MODELS_DIR}/unet`], supported_pt_extensions],
    'T2I-Adapter': [[`${MODELS_DIR}/clip`], supported_pt_extensions],
    'T2I-Style': [[`${MODELS_DIR}/unet`], supported_pt_extensions],
    clip_vision: [[`${MODELS_DIR}/clip_vision`], supported_pt_extensions],
    style_models: [[`${MODELS_DIR}/style_models`], supported_pt_extensions],
    embeddings: [[`${MODELS_DIR}/embeddings`], supported_pt_extensions],
    diffusers: [[`${MODELS_DIR}/diffusers`], ['folder']],
    vae_approx: [[`${MODELS_DIR}/vae_approx`], supported_pt_extensions],
    controlnet: [
      [`${MODELS_DIR}/controlnet`, `${MODELS_DIR}/t2i_adapter`],
      supported_pt_extensions,
    ],
    gligen: [[`${MODELS_DIR}/gligen`], supported_pt_extensions],
    upscale_models: [[`${MODELS_DIR}/upscale_models`], supported_pt_extensions],
    // custom_nodes: [[`${BASE_PATH}/custom_nodes`], []], // Adjust 'any' based on the actual value type
    hypernetworks: [[`${MODELS_DIR}/hypernetworks`], supported_pt_extensions],
    classifiers: [[`${MODELS_DIR}/classifiers`], { '': null }], // Adjust 'null' based on the actual value type
  };
  const OUTPUT_DIRECTORY = `${BASE_PATH}/output`;
  const TEMP_DIRECTORY = `${BASE_PATH}/temp`;
  const INPUT_DIRECTORY = `${BASE_PATH}/input`;
  return {
    BASE_PATH,
    MODELS_DIR,
    FOLDER_NAMES_AND_PATHS,
    OUTPUT_DIRECTORY,
    TEMP_DIRECTORY,
    INPUT_DIRECTORY
  };
}
export function getModelDir(type: ModelType, save_path: string = "default"): string {
  const {BASE_PATH, MODELS_DIR, FOLDER_NAMES_AND_PATHS} = getFolderNamesAndPaths();
  if (save_path !== 'default') {
    if (save_path.includes('..') || save_path.startsWith('/')) {
      console.warn(`[WARN] '${save_path}' is not allowed path. So it will be saved into 'models/etc'.`);
      return 'etc';
    } else {
      if (save_path.startsWith('custom_nodes')) {
        return `${BASE_PATH}/${save_path}`;
      } else {
        return `${MODELS_DIR}/${save_path}`;
      }
    }
  } else {
    const model_type = type;
    switch (model_type) {
      case 'checkpoints':
      case 'unclip':
        return FOLDER_NAMES_AND_PATHS.checkpoints[0][0];
      case 'VAE':
        return FOLDER_NAMES_AND_PATHS.vae[0][0];
      case 'lora':
        return FOLDER_NAMES_AND_PATHS.loras[0][0];
      case 'T2I-Adapter':
      case 'T2I-Style':
      case 'controlnet':
        return FOLDER_NAMES_AND_PATHS.controlnet[0][0];
      case 'clip_vision':
        return FOLDER_NAMES_AND_PATHS.clip_vision[0][0];
      case 'gligen':
        return FOLDER_NAMES_AND_PATHS.gligen[0][0];
      case 'upscale':
        return FOLDER_NAMES_AND_PATHS.upscale_models[0][0];
      case 'embeddings':
        return FOLDER_NAMES_AND_PATHS.embeddings[0][0];
      default:
        return 'etc';
    }
  }
}

export function getModelPath(data: MarketModel): string {
  const modelDir = getModelDir(data.type, data.save_path);
  return path.join(modelDir, data.filename); // Add the appropriate value for getModelPath
}