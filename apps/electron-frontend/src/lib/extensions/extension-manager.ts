import { ExtensionEventTypes, ExtensionManagerEvent, ExtensionManifest } from './extension.types';
import { getBackendUrl } from '@comflowy/common/config';
import { SlotEvent } from '@comflowy/common/utils/slot-event';
import { ExtensionMainApi } from "./extension-api-main";

/**
 * Manages front extentions extensions
 */
export class ExtensionManager {
  worker: Worker;
  extensionEvent = new SlotEvent<ExtensionManagerEvent>();
  /**
   * Constructor
   * @param params 
   */
  constructor(
    public extensions: ExtensionManifest[], 
    public api: ExtensionMainApi
  ) { }

  /**
   * initialize extensions
   */
  public async init() {
    const worker = new Worker(new URL('./worker/extension.worker.ts', import.meta.url));
    this.worker = worker;
    this.listenWorker();
    this.api.listenWorker(worker);

    // load all extensions
    for (const extensionManifest of this.extensions) {
      await this.loadExtension(extensionManifest);
    }
  }

  private listenWorker() {
    this.worker.onmessage = (event: MessageEvent<ExtensionManagerEvent>) => {
      const { type } = event.data;
      switch (type) {
        case ExtensionEventTypes.executeError:
          this.handleExtensionExecuteError(event.data);
          break;
      }
    };
  }

  private async loadExtension(extensionManifest: ExtensionManifest) {
    try {
      const mainContent = await this.fetchExtensionFileContent(extensionManifest, extensionManifest.main);
      this.worker.postMessage({
        type: ExtensionEventTypes.execute, data: {
          extension: extensionManifest,
          content: mainContent
        }
      });
    } catch (err) {
      this.extensionEvent.emit({
        type: ExtensionEventTypes.executeError,
        data: {
          extension: extensionManifest,
          error: err.message
        }
      })
      console.log("loadExtension error", err);
    }
  }

  private handleExtensionExecuteError(event: ExtensionManagerEvent) {
    const data = event.data;
    console.log("loadExtension:executeError", data);
    this.extensionEvent.emit({
      type: ExtensionEventTypes.executeError,
      data
    })
  }

  async fetchExtensionFileContent(extensionManifest: ExtensionManifest, filePath: string): Promise<string> {
    const url = getBackendUrl("/extensions/" + extensionManifest.id + "/" + filePath);
    return await fetch(url).then((res) => res.text());
  }
}