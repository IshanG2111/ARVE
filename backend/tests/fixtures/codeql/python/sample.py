from flask import request
import sqlite3

def lookup():
    value = request.args.get("id")
    return sqlite3.connect("app.db").execute(
        "select * from users where id=" + value
    ).fetchall()
