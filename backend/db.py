# File: db.py

import os
import mysql.connector

from dotenv import load_dotenv
load_dotenv()

# Kết nối csdl
def connect_db():
    try:
        return mysql.connector.connect(
            host=os.getenv("MYSQL_HOST"),
            user=os.getenv("MYSQL_USER"),
            password=os.getenv("MYSQL_PASSWORD"),
            database=os.getenv("MYSQL_DATABASE")
        )
    except mysql.connector.Error as err:
        raise RuntimeError(f"Không thể kết nối MySQL: {err}")
