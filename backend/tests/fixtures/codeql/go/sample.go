package main

import (
    "database/sql"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request, db *sql.DB) {
    value := r.URL.Query().Get("id")
    _, _ = db.Query("select * from users where id=" + value)
}
