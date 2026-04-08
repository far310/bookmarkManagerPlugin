import {
	ApiResponse,
	BookmarkAction,
	BookmarkNode,
	BookmarkTransferNode,
	BrowserHistoryItem,
} from '@src/types/bookmark';

function ok<T>(data: T): ApiResponse<T> {
	return { ok: true, data };
}

function fail(message: string): ApiResponse<never> {
	return { ok: false, error: message };
}

function toBookmarkNode(
	node: chrome.bookmarks.BookmarkTreeNode,
	folderPath?: string,
): BookmarkNode {
	return {
		id: node.id,
		parentId: node.parentId,
		title: node.title,
		url: node.url,
		folderPath,
		index: node.index,
		dateAdded: node.dateAdded,
		children: node.children?.map((child) => toBookmarkNode(child)),
	};
}

function toTransferNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkTransferNode {
	return {
		title: node.title,
		url: node.url,
		children: node.children?.map(toTransferNode),
	};
}

function toHistoryItem(item: chrome.history.HistoryItem): BrowserHistoryItem | null {
	if (!item.url) {
		return null;
	}

	return {
		id: item.id,
		title: item.title || item.url,
		url: item.url,
		lastVisitTime: item.lastVisitTime,
		visitCount: item.visitCount,
	};
}

function formatTimeForSearch(timestamp?: number): string {
	if (!timestamp) {
		return '';
	}

	const date = new Date(timestamp);
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	const hh = String(date.getHours()).padStart(2, '0');
	const mi = String(date.getMinutes()).padStart(2, '0');

	return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function flattenBookmarkNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
	const all: chrome.bookmarks.BookmarkTreeNode[] = [];

	const walk = (list: chrome.bookmarks.BookmarkTreeNode[]) => {
		for (const node of list) {
			all.push(node);
			if (node.children?.length) {
				walk(node.children);
			}
		}
	};

	walk(nodes);
	return all;
}

function normalizeFolderTitle(node: chrome.bookmarks.BookmarkTreeNode): string {
	const title = node.title.trim();
	return title || '(Untitled Folder)';
}

function createBookmarkContainerPathMap(
	nodes: chrome.bookmarks.BookmarkTreeNode[],
): Map<string, string> {
	const pathMap = new Map<string, string>();

	const walk = (
		list: chrome.bookmarks.BookmarkTreeNode[],
		parentFolders: string[],
	) => {
		for (const node of list) {
			pathMap.set(node.id, parentFolders.join(' / '));

			const nextParentFolders = node.url
				? parentFolders
				: [...parentFolders, normalizeFolderTitle(node)];

			if (node.children?.length) {
				walk(node.children, nextParentFolders);
			}
		}
	};

	walk(nodes, []);
	return pathMap;
}

function matchesBookmarkQuery(node: chrome.bookmarks.BookmarkTreeNode, query: string): boolean {
	const normalized = query.toLowerCase();
	const title = (node.title || '').toLowerCase();
	const url = (node.url || '').toLowerCase();
	const addedAt = formatTimeForSearch(node.dateAdded).toLowerCase();
	const timestamp = node.dateAdded ? String(node.dateAdded) : '';

	return [title, url, addedAt, timestamp].some((part) => part.includes(normalized));
}

function matchesHistoryQuery(item: chrome.history.HistoryItem, query: string): boolean {
	const normalized = query.toLowerCase();
	const title = (item.title || '').toLowerCase();
	const url = (item.url || '').toLowerCase();
	const visitedAt = formatTimeForSearch(item.lastVisitTime).toLowerCase();
	const visitCount = item.visitCount ? String(item.visitCount) : '';
	const typedCount = item.typedCount ? String(item.typedCount) : '';

	return [title, url, visitedAt, visitCount, typedCount].some((part) => part.includes(normalized));
}

function isValidUrl(url: string): boolean {
	return /^https?:\/\//.test(url);
}

function validateTransferNode(node: BookmarkTransferNode, path: string): string | null {
	if (!node.title?.trim()) {
		return `Missing title at ${path}`;
	}

	if (node.url && !isValidUrl(node.url.trim())) {
		return `Bookmark URL must start with http:// or https:// at ${path}`;
	}

	if (node.children) {
		for (let index = 0; index < node.children.length; index += 1) {
			const nestedPath = `${path}.children[${index}]`;
			const message = validateTransferNode(node.children[index], nestedPath);
			if (message) {
				return message;
			}
		}
	}

	return null;
}

function wrapChromeCall<T>(
	call: (cb: (value: T) => void) => void,
	fallbackError: string,
): Promise<T> {
	return new Promise((resolve, reject) => {
		call((value) => {
			const runtimeError = chrome.runtime.lastError;
			if (runtimeError) {
				reject(new Error(runtimeError.message || fallbackError));
				return;
			}
			resolve(value);
		});
	});
}

function getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
	return wrapChromeCall((cb) => chrome.bookmarks.getTree(cb), 'Failed to load bookmarks tree');
}

function searchBookmarks(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
	return wrapChromeCall(
		(cb) => chrome.bookmarks.search(query, cb),
		'Failed to search bookmarks',
	);
}

function searchBrowserHistory(
	query: string,
	maxResults = 30,
): Promise<chrome.history.HistoryItem[]> {
	return wrapChromeCall(
		(cb) =>
			chrome.history.search(
				{
					text: query,
					startTime: 0,
					maxResults,
				},
				cb,
			),
		'Failed to search browser history',
	);
}

function createBookmark(
	payload: chrome.bookmarks.CreateDetails,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
	return wrapChromeCall(
		(cb) => chrome.bookmarks.create(payload, cb),
		'Failed to create bookmark',
	);
}

function updateBookmark(
	id: string,
	payload: chrome.bookmarks.UpdateChanges,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
	return wrapChromeCall(
		(cb) => chrome.bookmarks.update(id, payload, cb),
		'Failed to update bookmark',
	);
}

function moveBookmark(
	id: string,
	destination: chrome.bookmarks.MoveDestination,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
	return wrapChromeCall(
		(cb) => chrome.bookmarks.move(id, destination, cb),
		'Failed to move bookmark',
	);
}

function removeBookmarkTree(id: string): Promise<void> {
	return new Promise((resolve, reject) => {
		chrome.bookmarks.removeTree(id, () => {
			const runtimeError = chrome.runtime.lastError;
			if (runtimeError) {
				reject(new Error(runtimeError.message || 'Failed to remove bookmark'));
				return;
			}
			resolve();
		});
	});
}

async function importTransferNode(
	node: BookmarkTransferNode,
	parentId: string,
): Promise<{ importedBookmarks: number; importedFolders: number }> {
	if (node.url) {
		await createBookmark({
			title: node.title.trim(),
			url: node.url.trim(),
			parentId,
		});
		return { importedBookmarks: 1, importedFolders: 0 };
	}

	const createdFolder = await createBookmark({
		title: node.title.trim(),
		parentId,
	});

	let importedBookmarks = 0;
	let importedFolders = 1;
	for (const childNode of node.children ?? []) {
		const nested = await importTransferNode(childNode, createdFolder.id);
		importedBookmarks += nested.importedBookmarks;
		importedFolders += nested.importedFolders;
	}

	return { importedBookmarks, importedFolders };
}

async function handleAction(action: BookmarkAction): Promise<ApiResponse<unknown>> {
	switch (action.type) {
		case 'LIST_BOOKMARKS': {
			const tree = await getTree();
			return ok(tree.map((node) => toBookmarkNode(node)));
		}

		case 'EXPORT_BOOKMARKS': {
			const tree = await getTree();
			const rootChildren = tree.flatMap((item) => item.children ?? []);
			return ok({
				exportedAt: new Date().toISOString(),
				nodes: rootChildren.map(toTransferNode),
			});
		}

		case 'SEARCH_BOOKMARKS': {
			const query = action.payload.query.trim();
			if (!query) {
				return fail('Search query is required');
			}

			const tree = await getTree();
			const roots = tree.flatMap((item) => item.children ?? []);
			const containerPathMap = createBookmarkContainerPathMap(roots);
			const allNodes = flattenBookmarkNodes(roots);
			const matches = allNodes.filter((node) => matchesBookmarkQuery(node, query)).slice(0, 100);
			return ok(matches.map((node) => toBookmarkNode(node, containerPathMap.get(node.id))));
		}

		case 'SEARCH_BROWSER_HISTORY': {
			const query = action.payload.query.trim();
			if (!query) {
				return fail('Search query is required');
			}

			const maxResults = Math.min(Math.max(action.payload.maxResults ?? 30, 1), 100);
			const historyPoolSize = Math.max(maxResults * 5, 100);
			const candidates = await searchBrowserHistory('', historyPoolSize);
			const matches = candidates.filter((item) => matchesHistoryQuery(item, query)).slice(0, maxResults);
			return ok(matches.map(toHistoryItem).filter((item): item is BrowserHistoryItem => item !== null));
		}

		case 'IMPORT_BOOKMARKS': {
			const { nodes, parentId } = action.payload;
			if (!Array.isArray(nodes) || nodes.length === 0) {
				return fail('Import data is empty');
			}

			for (let index = 0; index < nodes.length; index += 1) {
				const path = `nodes[${index}]`;
				const message = validateTransferNode(nodes[index], path);
				if (message) {
					return fail(message);
				}
			}

			const tree = await getTree();
			const fallbackParentId = tree[0]?.children?.[0]?.id;
			const resolvedParentId = parentId?.trim() || fallbackParentId;
			if (!resolvedParentId) {
				return fail('Unable to resolve target folder for import');
			}

			let importedBookmarks = 0;
			let importedFolders = 0;

			for (const node of nodes) {
				const imported = await importTransferNode(node, resolvedParentId);
				importedBookmarks += imported.importedBookmarks;
				importedFolders += imported.importedFolders;
			}

			return ok({ importedBookmarks, importedFolders });
		}

		case 'CREATE_BOOKMARK': {
			const { title, url, parentId } = action.payload;
			if (!title.trim()) {
				return fail('Title is required');
			}
			if (url && !/^https?:\/\//.test(url)) {
				return fail('Bookmark URL must start with http:// or https://');
			}

			const created = await createBookmark({
				title: title.trim(),
				...(url ? { url: url.trim() } : {}),
				...(parentId ? { parentId } : {}),
			});
			return ok(toBookmarkNode(created));
		}

		case 'RENAME_BOOKMARK': {
			const { id, title } = action.payload;
			if (!id.trim()) {
				return fail('Bookmark id is required');
			}
			if (!title.trim()) {
				return fail('Title is required');
			}
			const updated = await updateBookmark(id, { title: title.trim() });
			return ok(toBookmarkNode(updated));
		}

		case 'MOVE_BOOKMARK': {
			const { id, parentId, index } = action.payload;
			if (!id.trim() || !parentId.trim()) {
				return fail('Bookmark id and target folder id are required');
			}
			const moved = await moveBookmark(id, {
				parentId,
				...(typeof index === 'number' ? { index } : {}),
			});
			return ok(toBookmarkNode(moved));
		}

		case 'DELETE_BOOKMARK': {
			const { id } = action.payload;
			if (!id.trim()) {
				return fail('Bookmark id is required');
			}
			await removeBookmarkTree(id);
			return ok({ id });
		}

		default:
			return fail('Unsupported action');
	}
}

chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
	const action = request as BookmarkAction;

	handleAction(action)
		.then((response) => {
			sendResponse(response);
		})
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : 'Internal background error';
			sendResponse(fail(message));
		});

	return true;
});

console.log('background bookmark manager loaded');
