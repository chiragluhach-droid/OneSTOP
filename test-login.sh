#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"luhachchirag@gmail.com","password":"admin123secure"}' | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo "Login failed or no token"
  exit 1
fi
echo "Got token!"

echo "Schools HTTP Code:"
curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:5001/api/schools -H "Authorization: Bearer $TOKEN"
echo ""

echo "Teachers HTTP Code:"
curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:5001/api/teachers -H "Authorization: Bearer $TOKEN"
echo ""

echo "Requests HTTP Code:"
curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:5001/api/requests/admin/all -H "Authorization: Bearer $TOKEN"
echo ""
