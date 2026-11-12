/** How a node asks the editor to open the result viewer for it. */

export const INSPECT_EVENT = 'bedrock_branching_inspect';

/** Called from a node: asks the editor to open the viewer for that node. */
export function requestInspect(nodeId: string): void {
  window.dispatchEvent(new CustomEvent(INSPECT_EVENT, { detail: { nodeId } }));
}
