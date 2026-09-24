# Safe: Parameterized SQL Query
def get_user_safe(cursor, request):
    user_id = request.args.get("id")
    query = "SELECT * FROM users WHERE id = %s"
    cursor.execute(query, (user_id,))
    return cursor.fetchone()
