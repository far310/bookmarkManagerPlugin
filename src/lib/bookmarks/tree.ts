import { BookmarkNode } from '@src/types/bookmark';

function flattenFolders(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];

  const walk = (items: BookmarkNode[]) => {
    items.forEach((item) => {
      if (!item.url && item.parentId !== undefined) {
        result.push(item);
      }
      if (item.children?.length) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return result;
}

function folderIds(nodes: BookmarkNode[]): string[] {
  return flattenFolders(nodes).map((folder) => folder.id);
}

function stripFirstLayer(nodes: BookmarkNode[]): BookmarkNode[] {
  const stripped = nodes.flatMap((node) => node.children ?? []);
  return stripped.length > 0 ? stripped : nodes;
}

function isRootNode(node: BookmarkNode): boolean {
  return node.parentId === undefined;
}

export { flattenFolders, folderIds, stripFirstLayer, isRootNode };