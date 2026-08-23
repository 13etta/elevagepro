const DEFAULT_OWNER_USER_ID = '83b1656c-57b9-4e46-a79c-7203710c4a41';

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function canAccessAiSelectionAgent(user) {
  const allowedUserId = normalizeId(
    process.env.AI_SELECTION_OWNER_USER_ID || DEFAULT_OWNER_USER_ID,
  );
  if (!allowedUserId || !user) return false;

  return normalizeId(user.id) === allowedUserId;
}

module.exports = {
  canAccessAiSelectionAgent,
};
