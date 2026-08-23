const assert = require('node:assert/strict');
const test = require('node:test');

const { requireAiSelectionOwner } = require('../src/middleware/auth');

const OWNER_ID = '83b1656c-57b9-4e46-a79c-7203710c4a41';

function responseDouble() {
  return {
    statusCode: null,
    renderedView: null,
    __(key) { return key; },
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view) {
      this.renderedView = view;
      return this;
    },
  };
}

test('le propriétaire autorisé peut atteindre les routes Sélection IA', () => {
  const previousOwnerId = process.env.AI_SELECTION_OWNER_USER_ID;
  process.env.AI_SELECTION_OWNER_USER_ID = OWNER_ID;

  try {
    let continued = false;
    const res = responseDouble();
    requireAiSelectionOwner(
      { session: { user: { id: OWNER_ID } } },
      res,
      () => { continued = true; },
    );

    assert.equal(continued, true);
    assert.equal(res.statusCode, null);
  } finally {
    if (previousOwnerId === undefined) delete process.env.AI_SELECTION_OWNER_USER_ID;
    else process.env.AI_SELECTION_OWNER_USER_ID = previousOwnerId;
  }
});

test('tout autre utilisateur reçoit une page introuvable sur une URL Sélection IA', () => {
  const previousOwnerId = process.env.AI_SELECTION_OWNER_USER_ID;
  process.env.AI_SELECTION_OWNER_USER_ID = OWNER_ID;

  try {
    let continued = false;
    const res = responseDouble();
    requireAiSelectionOwner(
      { session: { user: { id: '96dea951-5faf-4424-bbe9-81b03684cf1f' } } },
      res,
      () => { continued = true; },
    );

    assert.equal(continued, false);
    assert.equal(res.statusCode, 404);
    assert.equal(res.renderedView, 'errors/404');
  } finally {
    if (previousOwnerId === undefined) delete process.env.AI_SELECTION_OWNER_USER_ID;
    else process.env.AI_SELECTION_OWNER_USER_ID = previousOwnerId;
  }
});
