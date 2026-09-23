// Safe: JavaScript Parameterized Query
function findUserSafe(db, userId) {
    const query = "SELECT * FROM users WHERE id = ?";
    return db.query(query, [userId]);
}
