import {
  atom,
  map,
  type MapStore,
  type ReadableAtom,
  type WritableAtom,
  onMount,
} from "nanostores";
import type {
  EditorDocument,
  ScrollPosition,
} from "@components/editor/codemirror/CodeMirrorEditor";
import { ActionRunner, type ActionStatus } from "@runtime/action-runner";
import { webcontainer } from "@webcontainer/index";
import type { ITerminal } from "@types/terminal";
import { unreachable } from "@lib/utils/unreachable";
import { EditorStore } from "./editor";
import { FilesStore, type FileMap } from "./files";
import { PreviewsStore } from "./previews";
import { TerminalStore } from "./terminal";
import { type ActionCore } from "@runtime/action-runner";
import { v4 as uuidv4 } from "uuid";
import { CodeTaskType, TaskStatus, type CodeTask } from "../shared/models/codeTask";
export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, "title" | "closed">;
export type ArtifactLoadingState = "loading" | "complete";

type Artifacts = MapStore<Record<string, ArtifactState>>;
type ArtifactStateMap = MapStore<Record<string, ArtifactLoadingState>>;

export type WorkbenchViewType = "code" | "preview";

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom("code");
  unsavedFiles: WritableAtom<Set<string>> =
    import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  currentArtifactId: WritableAtom<string | undefined> = atom(undefined);
  devServerRunning: WritableAtom<boolean> = atom(false);

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === "file") {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifications() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  addArtifact({ messageId, name }: { messageId: string; name: string }) {
    const artifact = this.#getArtifact(messageId);
    this.currentArtifactId.set(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id: messageId,
      title: name,
      closed: false,
      runner: new ActionRunner(webcontainer),
    });
  }

  closeArtifact(messageId: string) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable("Artifact not found");
    }

    this.artifacts.setKey(messageId, { ...artifact, closed: true });
  }

  updateArtifact({ messageId }: { messageId: string }, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async installDependencies(messageId: string) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable("Artifact not found");
    }

    const task: CodeTask = {
      id: `${messageId}:installDependencies`,
      type: CodeTaskType.INSTALL,
      status: TaskStatus.PENDING,
    };

    artifact.runner.addAction(task);
    artifact.runner.runAction(task);
  }

  async runDevServer(messageId: string) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable("Artifact not found");
    }

    if (this.devServerRunning.get()) {
      return;
    }

    const actionId = uuidv4();
    const task: CodeTask = {
      id: actionId,
      type: CodeTaskType.DEV_SERVER,
      status: TaskStatus.PENDING,
    };

    artifact.runner.addAction(task);
    artifact.runner.runAction(task);

    this.devServerRunning.set(true);
  }

  async setActionStatus(messageId: string, actionId: string, status: ActionStatus) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable("Artifact not found");
    }

    artifact.runner.setActionStatus(actionId, status);
  }

  async addAction(data: ActionCore) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable("Artifact not found");
    }

    artifact.runner.addAction(data.task);
  }

  async runAction(data: ActionCore) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);
    const artifacts = this.artifacts;

    if (!artifact) {
      unreachable("Artifact not found");
    }

    artifact.runner.runAction(data.task);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }
}

export const workbenchStore = new WorkbenchStore();
