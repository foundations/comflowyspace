import {
  type Edge,
  type Node,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  type XYPosition,
  type Connection as FlowConnecton,
  OnNodesDelete,
  OnEdgesDelete,
} from 'reactflow';
import {
  type GalleryItem,
  type QueueItem,
  type NodeId,
  type NodeInProgress,
  type PropertyKey,
  SDNode,
  type Widget,
  type WidgetKey,
  NODE_IDENTIFIER,
  Connection
} from '../comfui-interfaces'

export type OnPropChange = (node: NodeId, property: PropertyKey, value: any) => void

import * as Y from "yjs";
import { WorkflowDocumentUtils } from './workflow-doc';
import { PersistedFullWorkflow, PersistedWorkflowConnection, PersistedWorkflowDocument, PersistedWorkflowNode, retrieveLocalWorkflow, saveLocalWorkflow, throttledUpdateDocument} from "../local-storage";

import { create } from 'zustand'
import { createPrompt, deleteFromQueue, getQueue, getWidgetLibrary as getWidgets, sendPrompt } from '../comfyui-bridge/bridge';
import {
  writeWorkflowToFile,
} from '../comfyui-bridge/export-import';

import { getBackendUrl } from '../config'
import exifr from 'exifr'

import { uuid } from '../utils';

export interface AppState {
  counter: number
  clientId?: string

  // workflow document store in yjs
  workflow: PersistedFullWorkflow | null;
  doc: Y.Doc;
  nodeSelection: string[]; 
  edgeSelection: string[];
  undoManager?: Y.UndoManager;

  // old storage structure
  nodes: Node[]
  edges: Edge[]
  graph: Record<NodeId, SDNode>
  widgets: Record<WidgetKey, Widget>
  widgetCategory: any;

  // document mutation handler
  onYjsDocUpdate: () => void;
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onNodesDelete: OnNodesDelete
  onEdgesDelete: OnEdgesDelete
  onPropChange: OnPropChange
  onAddNode: (widget: Widget, node: SDNode, pos: XYPosition) => void
  onDuplicateNode: (id: NodeId) => void

  // job queue
  queue: QueueItem[]

  // gallery
  gallery: GalleryItem[]

  nodeInProgress?: NodeInProgress
  promptError?: string
  previewedImageIndex?: number
  onConnect: OnConnect

  onSubmit: () => Promise<void>
  onDeleteFromQueue: (id: number) => Promise<void>
  onInit: () => Promise<void>
  onLoadWorkflow: (persisted: PersistedFullWorkflow) => void
  onExportWorkflow: () => void
  onNewClientId: (id: string) => void
  onQueueUpdate: () => Promise<void>
  onNodeInProgress: (id: NodeId, progress: number) => void
  onImageSave: (id: NodeId, images: string[]) => void
  onPreviewImage: (id: number) => void
  onPreviewImageNavigate: (next: boolean) => void
  onHideImagePreview: () => void
  onLoadImageWorkflow: (image: string) => void
}

export const AppState = {
  getValidConnections(state: AppState): Connection[] {
    return state.edges.flatMap((e) =>
      e.sourceHandle !== undefined && e.sourceHandle !== null && e.targetHandle !== undefined && e.targetHandle !== null
        ? [{ source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle }]
        : []
    )
  },
  addNode(state: AppState, widget: Widget, node: PersistedWorkflowNode): AppState {
    if (node.id === "6t34yy46") {
      console.log("adding node 6t34yy46", node.position);
    }
    const maxZ = state.nodes
      .map((n) => n.zIndex ?? 0)
      .concat([0])
      .reduce((a, b) => Math.max(a, b))

    const item = {
      id: node.id,
      data: {
        widget,
        value: node.value
      },
      selected: !!node.selected,
      position: node.position ?? { x: 0, y: 0 },
      type: NODE_IDENTIFIER,
      zIndex: maxZ + 1,
    }
    return {
      ...state,
      nodes: applyNodeChanges([{ type: 'add', item }], state.nodes),
      graph: { ...state.graph, [node.id]: node.value }
    }
  },
  addConnection(state: AppState, connection: PersistedWorkflowConnection): AppState {
    return { ...state, edges: addEdge(connection, state.edges) }
  },
  toPersisted(state: AppState): PersistedWorkflowDocument {
    const { doc } = state;
    return WorkflowDocumentUtils.toJson(doc);
  },
}

export const useAppStore = create<AppState>((set, get) => ({
  workflow: null,
  doc: new Y.Doc(),
  graph: {},
  nodes: [],
  edges: [],
  nodeSelection: [],
  edgeSelection: [],

  // properties
  counter: 0,
  widgets: {},
  widgetCategory: {},
  queue: [],
  gallery: [],
  /**
   * AppStore Initialization Entry 
   */
  onInit: async () => {
    const widgets = await getWidgets()
    const widgetCategory = generateWidgetCategories(widgets);
    console.log("widgets", widgets);
    set({ widgets, widgetCategory })
  },
  /**
   * Everytime update yjs doc, recalculate nodes and edges
   */
  onYjsDocUpdate: () => {
    set((st) => {
      const workflowMap = st.doc.getMap("workflow");
      const workflow = workflowMap.toJSON() as PersistedWorkflowDocument;

      throttledUpdateDocument({
        ...st.workflow!,
        snapshot: workflow
      });

      let state: AppState = { ...st, nodes: [], edges: [], graph: {} }
      for (const [key, node] of Object.entries(workflow.nodes)) {
        const widget = state.widgets[node.value.widget]
        if (widget !== undefined) {
          state = AppState.addNode(state, widget, node);
        } else {
          console.warn(`Unknown widget ${node.value.widget}`)
        }
      }
      for (const connection of workflow.connections) {
        state = AppState.addConnection(state, connection)
      }
      const {nodeSelection, edgeSelection} = st;
      state.nodes.forEach(node => {
        if (nodeSelection.includes(node.id)) {
          node.selected = true;
        }
      });
      state.edges.forEach(edge => {
        if (edgeSelection.includes(edge.id)) {
          edge.selected = true;
        }
      });
      return {
        ...state,
      }
    }, true)
  },
  /**
   * Mutation actions
   * @param changes 
   */
  onNodesChange: (changes) => {
    // console.log("nodes change", changes);
    const { doc, onYjsDocUpdate, nodeSelection } = get();
    WorkflowDocumentUtils.onNodesChange(doc, changes);
    set((st) => {
      let newNodeSelection = [...nodeSelection];
      changes.forEach(change => {
        if (change.type === 'select') {
          if (change.selected) {
            newNodeSelection = [...newNodeSelection, change.id];
          } else {
            newNodeSelection = newNodeSelection.filter(id => id !== change.id);
          }
        }
      })
      return {
        ...st,
        nodeSelection: newNodeSelection
      }
    });
    onYjsDocUpdate();
  },
  onEdgesChange: (changes) => {
    // console.log("edges change", changes);
    // set((st) => ({ edges: applyEdgeChanges(changes, st.edges) }))
    const { doc, onYjsDocUpdate, edgeSelection } = get();
    WorkflowDocumentUtils.onEdgesChange(doc, changes);
    set((st) => {
      let newEdgeSelection = [...edgeSelection];
      changes.forEach(change => {
        if (change.type === 'select') {
          if (change.selected) {
            newEdgeSelection = [...newEdgeSelection, change.id];
          } else {
            newEdgeSelection = newEdgeSelection.filter(id => id !== change.id);
          }
        }
      })
      return {
        ...st,
        edgeSelectionSelection: newEdgeSelection
      }
    });
    onYjsDocUpdate();
  },
  onNodesDelete: (changes: Node[]) => {
    const { doc, onYjsDocUpdate, } = get();
    WorkflowDocumentUtils.onNodesDelete(doc, changes.map(node => node.id));
    onYjsDocUpdate();
  },
  onEdgesDelete: (changes: Edge[]) => {
    const { doc, onYjsDocUpdate } = get();
    WorkflowDocumentUtils.onEdgesDelete(doc, changes.map(edge => edge.id));
    onYjsDocUpdate();
  },
  onConnect: (connection: FlowConnecton) => {
    // console.log("on connet");
    const { doc, onYjsDocUpdate } = get();
    WorkflowDocumentUtils.addConnection(doc, connection);
    onYjsDocUpdate();
    // set((st) => AppState.addConnection(st, connection))
  },
  onPropChange: (id, key, value) => {
    console.log("change prop", id, key, value);
    const { doc, onYjsDocUpdate } = get();
    WorkflowDocumentUtils.onPropChange(doc, {
      id,
      key,
      value
    });
    onYjsDocUpdate();
  },
  onAddNode: (widget: Widget, node: SDNode, position) => {
    console.log("add node")
    const { doc, onYjsDocUpdate } = get();
    WorkflowDocumentUtils.onNodesAdd(doc, [{
      id: "node-" + uuid(),
      position,
      value: node
    }]);
    onYjsDocUpdate();
  },
  onDuplicateNode: (id) => {
    console.log("duplicated node")
    const st = get();
    const item = st.graph[id]
    const node = st.nodes.find((n) => n.id === id)
    const position = node?.position
    const moved = position !== undefined ? { ...position, y: position.y + 100 } : { x: 0, y: 0 }
    const doc = st.doc;
    WorkflowDocumentUtils.onNodesAdd(doc, [{
      id: "node-" + uuid(),
      position: moved,
      value: item
    }])
    st.onYjsDocUpdate();
  },
  /**
   * Workflow load & persisted
   * @param workflow 
   */
  onLoadWorkflow: (workflow) => {
    const st = get();
    const doc = WorkflowDocumentUtils.fromJson({
      id: workflow.id,
      title:workflow.title,
      nodes: workflow.snapshot.nodes,
      connections: workflow.snapshot.connections
    });
    set(st => {
      return {
        ...st,
        workflow,
        undoManager: new Y.UndoManager(doc.getMap("workflow")),
        doc,
      }
    });
    st.onYjsDocUpdate();
  },
  onExportWorkflow: () => {
    writeWorkflowToFile(AppState.toPersisted(get()))
  },
  onSubmit: async () => {
    const state = get()
    const docJson = WorkflowDocumentUtils.toJson(state.doc);
    const res = await sendPrompt(createPrompt(docJson, state.widgets, state.clientId))
    set({ promptError: res.error })
  },
  onDeleteFromQueue: async (id) => {
    await deleteFromQueue(id)
    await get().onQueueUpdate()
  },
  onNewClientId: (id) => {
    set({ clientId: id })
  },
  onQueueUpdate: async () => {
    set({ queue: await getQueueItems(get().clientId) })
  },
  onNodeInProgress: (id, progress) => {
    set({ nodeInProgress: { id, progress } })
  },
  onImageSave: (id, images) => {
    set((st) => ({
      gallery: st.gallery.concat(images.map((image) => ({ image }))),
      graph: {
        ...st.graph,
        [id]: { ...st.graph[id], images },
      },
    }))
  },
  onPreviewImage: (index) => {
    set({ previewedImageIndex: index })
  },
  onPreviewImageNavigate: (next) => {
    set((st) => {
      if (st.previewedImageIndex === undefined) {
        return {}
      }
      const idx = next ? st.previewedImageIndex - 1 : st.previewedImageIndex + 1
      return idx < 0 || idx === st.gallery.length ? {} : { previewedImageIndex: idx }
    })
  },
  onHideImagePreview: () => {
    set({ previewedImageIndex: undefined })
  },
  onLoadImageWorkflow: (image) => {
    void exifr.parse(getBackendUrl(`/view/${image}`)).then((res) => {
      get().onLoadWorkflow(JSON.parse(res.workflow))
    })
  },
}));

async function getQueueItems(clientId?: string): Promise<QueueItem[]> {
  const history = await getQueue()
  // hacky way of getting the queue
  const queue = history.queue_running
    .concat(history.queue_pending)
    .filter(([i, id, graph, client]) => client.client_id === clientId)
    .map(([i, id, graph]) => {
      const prompts = Object.values(graph).flatMap((node) =>
        node.class_type === 'CLIPTextEncode' && node.inputs.text !== undefined ? [node.inputs.text] : []
      )
      const checkpoint = Object.values(graph).find((node) => node.class_type.startsWith('CheckpointLoader'))
      const model = checkpoint?.inputs?.ckpt_name
      return { id, prompts, model }
    })
  return queue
}

function generateWidgetCategories(widgets: Record<string, Widget>) {
  const categories = {};

  Object.keys(widgets).forEach((key) => {
      const widget = widgets[key];
      const categoryPath = widget.category.split('/');

      let currentCategory:any = categories;

      categoryPath.forEach((category, index) => {
          if (!currentCategory[category]) {
              currentCategory[category] = {};
          }

          if (index === categoryPath.length - 1) {
              currentCategory[category][key] = widget;
          }

          currentCategory = currentCategory[category];
      });
  });

  return categories;
};