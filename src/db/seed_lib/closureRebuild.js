/**
 * Closure-table rebuild helper — used by seeders and the locationService.
 *
 * Portable application-level walk (works on MySQL 8+ and SQLite; no `WITH RECURSIVE`
 * dependency). Truncates `location_ancestors` and re-inserts the closure rows in chunks.
 *
 * depth = 0 rows are self-references; depth > 0 rows are true ancestors.
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import('sequelize').Sequelize} Sequelize
 */
async function rebuildClosure(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const all = await queryInterface.sequelize.query(
      'SELECT id, parent_id FROM locations',
      { transaction, type: Sequelize.QueryTypes.SELECT },
    );
    const byId = new Map(all.map((r) => [r.id, r]));

    const rows = [];
    for (const node of all) {
      rows.push({ ancestor_id: node.id, descendant_id: node.id, depth: 0 });

      let depth = 1;
      let current = node;
      const seen = new Set([node.id]);
      while (current.parent_id && byId.has(current.parent_id) && depth < 50) {
        const parent = byId.get(current.parent_id);
        if (seen.has(parent.id)) break; // cycle guard
        seen.add(parent.id);
        rows.push({ ancestor_id: parent.id, descendant_id: node.id, depth });
        current = parent;
        depth += 1;
      }
    }

    await queryInterface.bulkDelete('location_ancestors', {}, { transaction });
    if (rows.length) {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await queryInterface.bulkInsert('location_ancestors', rows.slice(i, i + CHUNK), {
          transaction,
        });
      }
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = { rebuildClosure };
