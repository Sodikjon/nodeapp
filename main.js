'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
    user: 'app',
    password: 'pass',
    host: '0.0.0.0',
    port: '33060',
});

function sendResponse(response, { status = statusOk, headers = {}, body = null }) {
    Object.entries(headers).forEach(function ([key, value]) {
        response.setHeader(key, value);
    });
    response.writeHead(status);
    response.end(body);
}

function sendJSON(response, body) {
    sendResponse(response, {
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

function map(columns) {
    return row => row.reduce((res, value, i) => ({ ...res, [columns[i].getColumnLabel()]: value }), {});
}

const methods = new Map();

methods.set('/posts.get', async ({ response, db }) => {
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = :removed')
        .bind('removed', false)
        .orderBy('id DESC')
        .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const posts = data.map(map(columns));
    sendJSON(response, posts);
});

methods.set('/posts.getById', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));

    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const post = data.map(map(columns));

    if (post.length === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    sendJSON(response, post[0]);
});

methods.set('/posts.post', async ({ response, searchParams, db }) => {
    if (!searchParams.has('content')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const content = searchParams.get('content');

    const postContent = content;

    const table = db.getTable('posts');

    const result = await table.insert('content')
        .values(postContent)
        .execute();
    const addedId = result.getAutoIncrementValue();

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', addedId)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));

    sendJSON(response, post[0]);
});

methods.set('/posts.edit', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    if (!searchParams.has('content')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));

    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const content = searchParams.get('content');

    const table = await db.getTable('posts');
    const result = await table.update()
        .set('content', content)
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const edited = result.getAffectedItemsCount();

    if (edited === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));

    sendJSON(response, post[0]);
});

methods.set('/posts.delete', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));
    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));


    const result = await table.update()
        .set('removed', true)
        .where('id = :id')
        .bind('id', id)
        .execute();

    const removed = result.getAffectedItemsCount();

    if (removed === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    sendJSON(response, post[0]);

});
methods.set('/posts.restore', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));
    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.update()
        .set('removed', false)
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', true)
        .execute();

    const restored = result.getAffectedItemsCount();

    if (restored === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));

    sendJSON(response, post[0]);
});
methods.set('/posts.like', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));

    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');
    const selectLikes = await table.select(['likes'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const likeData = selectLikes.fetchAll();

    if (likeData.length === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const likeColumns = selectLikes.getColumns();
    const likes = likeData.map(map(likeColumns))[0].likes;
    const anotherLikes = likes + 1;

    const result = await table.update()
        .set('likes', anotherLikes)
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const liked = result.getAffectedItemsCount();

    if (liked === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));

    sendJSON(response, post[0]);
});
methods.set('/posts.dislike', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));

    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');

    const selectLikes = await table.select(['likes'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const likeData = selectLikes.fetchAll();

    if (likeData.length === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const likeColumns = selectLikes.getColumns();
    const likes = likeData.map(map(likeColumns))[0].likes;
    const dislikes = likes - 1;

    const result = await table.update()
        .set('likes', dislikes)
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const liked = result.getAffectedItemsCount();

    if (liked === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const selectResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = :removed')
        .bind('id', id)
        .bind('removed', false)
        .execute();

    const data = selectResult.fetchAll();
    const columns = selectResult.getColumns();
    const post = data.map(map(columns));

    sendJSON(response, post[0]);
});

const server = http.createServer(async (request, response) => {
    const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    let session = null;
    try {
        session = await client.getSession();
        const db = await session.getSchema(schema);

        const params = {
            request,
            response,
            pathname,
            searchParams,
            db,
        };

        await method(params);
    } catch (e) {
        sendResponse(response, { status: statusInternalServerError });
    } finally {
        if (session !== null) {
            try {
                await session.close();
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen(port);