exports.up = function(knex) {
  return knex.schema.createTable('ratings', function(table) {
    table.increments('id').primary();
    table.string('userEmail').notNullable();
    table.integer('rentalId').notNullable();
    table.integer('rating').notNullable();
    table.string('comment', 2000).nullable();
    table.timestamp('dateTime').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ratings');
};
