import { ApiResponse, BookmarkAction, BookmarkNode } from '@src/types/bookmark';

function ok<T>(data: T): ApiResponse<T> {
	return { ok: true, data };
}

function fail(message: string): ApiResponse<never> {
	return { ok: false, error: message };
}

function toBookmarkNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
	return {
		id: node.id,
		parentId: node.parentId,
		title: node.title,
		url: node.url,
		index: node.index,
		dateAdded: node.dateAdded,
		children: node.children?.map(toBookmarkNode),
	};
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

async function handleAction(action: BookmarkAction): Promise<ApiResponse<unknown>> {
	switch (action.type) {
		case 'LIST_BOOKMARKS': {
			const tree = await getTree();
			return ok(tree.map(toBookmarkNode));
		}

		case 'SEARCH_BOOKMARKS': {
			const query = action.payload.query.trim();
			if (!query) {
				return fail('Search query is required');
			}
			const matches = await searchBookmarks(query);
			return ok(matches.map(toBookmarkNode));
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
