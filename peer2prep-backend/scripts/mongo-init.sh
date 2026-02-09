#!/bin/bash

echo "⏳ Waiting for MongoDB to be ready..."
until mongosh --host mongo --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
  sleep 2
done

echo "✅ MongoDB is ready. Initiating replica set..."

mongosh --host mongo <<EOF
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongo:27017" }]
})
EOF