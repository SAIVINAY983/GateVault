import MySQLdb
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

db_user = os.environ.get('DB_USER', 'root')
db_password = os.environ.get('DB_PASSWORD', 'root')
db_host = os.environ.get('DB_HOST', 'localhost')
db_port = int(os.environ.get('DB_PORT', '3306'))
db_name = os.environ.get('DB_NAME', 'gatevault')

try:
    conn = MySQLdb.connect(user=db_user, passwd=db_password, host=db_host, port=db_port)
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
    print(f"Database '{db_name}' created or already exists.")
    conn.close()
except Exception as e:
    print(f"Failed to create database: {e}")
