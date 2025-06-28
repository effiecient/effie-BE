
interface TreeNode {
  id: string;
  type: string;
  children?: Record<string, TreeNode>;
}

export function flattenDataInTree(node: TreeNode): { allIds: string[]; folderIds: string[] } {
  const allIds: string[] = [];
  const folderIds: string[] = [];
  
  function traverse(currentNode: TreeNode) {
    allIds.push(currentNode.id);
    if (currentNode.type === 'folder') {
      folderIds.push(currentNode.id);
    }
    
    if (currentNode.children) {
      Object.values(currentNode.children).forEach(traverse);
    }
  }

  traverse(node);
  return { allIds, folderIds };
}
