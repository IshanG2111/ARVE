// Vulnerable: JavaScript SQL Injection
function findUser(db, userId) {
    const query = "SELECT * FROM users WHERE id = '" + userId + "'";
    return db.query(query);
}
